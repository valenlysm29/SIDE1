"""Build dressed, skinned GLBs from the pinned CC0 MakeHuman graphical assets.

Requires numpy. No MakeHuman application code is imported. Coordinates, proxy
weights, UV seams, skin weights and textures are preserved in the GLB export.
Run from any directory; sources and third-party licenses live beside this file.
"""
from pathlib import Path
import json
import math
import re
import struct
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(__file__).parent / 'character_sources'
ASSETS = SOURCE / 'system_assets'
OUTPUT = ROOT / 'assets/models3d'


def obj(path):
    positions, uvs, faces = [], [], []
    group = 'default'
    for line in path.read_text().splitlines():
        t = line.split()
        if not t or t[0].startswith('#'):
            continue
        if t[0] == 'v':
            positions.append(list(map(float, t[1:4])))
        elif t[0] == 'vt':
            uvs.append(list(map(float, t[1:3])))
        elif t[0] == 'g':
            group = t[1]
        elif t[0] == 'f':
            corners = [(int(s.split('/')[0])-1, int(s.split('/')[1])-1 if '/' in s and s.split('/')[1] else 0) for s in t[1:]]
            for i in range(1, len(corners)-1):
                faces.append((group, [corners[0], corners[i], corners[i+1]]))
    return np.array(positions), np.array(uvs), faces


def proxy(path, base, weights):
    """Barycentric fitting of clothing/hair, with the asset's axis scale factors."""
    rows, deleted = [], set()
    mode, scale = '', np.ones(3)
    text = path.read_text()
    for line in text.splitlines():
        t = line.split()
        if not t or t[0].startswith('#'):
            continue
        if t[0] in ('x_scale', 'y_scale', 'z_scale'):
            axis = 'xyz'.index(t[0][0])
            scale[axis] = abs(base[int(t[1]), axis]-base[int(t[2]), axis])/float(t[3])
        elif t[0] == 'verts':
            mode = 'verts'
        elif t[0] == 'delete_verts':
            mode = 'delete'
        elif mode == 'verts' and t[0].isdigit():
            if len(t) == 1:
                rows.append(([int(t[0])]*3, [1, 0, 0], [0, 0, 0]))
            elif len(t) >= 9:
                rows.append((list(map(int, t[:3])), list(map(float, t[3:6])), list(map(float, t[6:9]))))
    if 'delete_verts' in text:
        for match in re.finditer(r'(\d+)(?:\s*-\s*(\d+))?', text.split('delete_verts', 1)[1]):
            a, b = match.groups()
            deleted.update(range(int(a), int(b or a)+1))
    refs = np.array([r[0] for r in rows])
    factors = np.array([r[1] for r in rows])
    offsets = np.array([r[2] for r in rows])
    fitted = (base[refs]*factors[:, :, None]).sum(axis=1) + offsets*scale
    # Negative barycentric coordinates are valid geometrically, but not as skin weights.
    skin = np.maximum((weights[refs]*factors[:, :, None]).sum(axis=1), 0)
    skin /= np.maximum(skin.sum(axis=1, keepdims=True), 1e-9)
    return fitted, skin, deleted


class GLB:
    def __init__(self):
        self.data = bytearray()
        self.doc = dict(asset={'version':'2.0', 'generator':'SIDE CC0 anatomical character pipeline', 'copyright':'MakeHuman graphical assets CC0; see tools/character_sources'},
                        scene=0, scenes=[{'nodes':[0]}], nodes=[{'name':'SIDE_Character','children':[]}],
                        meshes=[], skins=[], materials=[], textures=[], images=[], samplers=[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}],
                        animations=[], buffers=[], bufferViews=[], accessors=[])
        self.texture_cache = {}

    def view(self, data):
        while len(self.data) % 4:
            self.data.append(0)
        index = len(self.doc['bufferViews'])
        self.doc['bufferViews'].append({'buffer':0, 'byteOffset':len(self.data), 'byteLength':len(data)})
        self.data.extend(data)
        return index

    def accessor(self, values, kind, dtype='<f4'):
        a = np.asarray(values, dtype=dtype)
        component = {'<f4':5126,'<u2':5123,'<u4':5125}[dtype]
        entry = {'bufferView':self.view(a.tobytes()),'componentType':component,'count':len(a),'type':kind}
        if kind != 'MAT4':
            b = a.reshape(len(a), -1)
            entry.update(min=b.min(axis=0).tolist(), max=b.max(axis=0).tolist())
        self.doc['accessors'].append(entry)
        return len(self.doc['accessors'])-1

    def texture(self, path):
        key = str(path.resolve())
        if key not in self.texture_cache:
            idx = len(self.doc['images'])
            self.doc['images'].append({'name':path.name,'mimeType':'image/png','bufferView':self.view(path.read_bytes())})
            self.doc['textures'].append({'source':idx,'sampler':0})
            self.texture_cache[key] = len(self.doc['textures'])-1
        return self.texture_cache[key]

    def material(self, name, folder=None, roughness=.7, diffuse=None, hair=False, eye=False):
        data = {'name':name, 'pbrMetallicRoughness':{'metallicFactor':0, 'roughnessFactor':roughness}, 'doubleSided':hair}
        maps = {}
        if folder:
            for line in next(folder.glob('*.mhmat')).read_text().splitlines():
                t = line.split()
                if len(t) == 2 and t[0].endswith('Texture'):
                    candidate = folder / t[1]
                    if candidate.exists():
                        maps[t[0]] = candidate
        if diffuse:
            maps['diffuseTexture'] = diffuse
        if 'diffuseTexture' in maps:
            data['pbrMetallicRoughness']['baseColorTexture'] = {'index':self.texture(maps['diffuseTexture'])}
        if 'normalmapTexture' in maps:
            data['normalTexture'] = {'index':self.texture(maps['normalmapTexture']), 'scale':.6 if hair else .75}
        if hair:
            data.update(alphaMode='MASK', alphaCutoff=.35)
        if eye:
            # The authored atlas uses alpha=0 on the outer corneal shell. Mask it
            # here; clearcoat supplies the wet highlight without an opaque veil.
            data.update(alphaMode='MASK', alphaCutoff=.5)
            data['extensions'] = {'KHR_materials_clearcoat':{'clearcoatFactor':1,'clearcoatRoughnessFactor':.08}}
            self.doc.setdefault('extensionsUsed', []).append('KHR_materials_clearcoat')
        self.doc['materials'].append(data)
        return len(self.doc['materials'])-1

    def mesh(self, name, vertices, uv, faces, weights, material, scale, floor):
        faces = [corners for _, corners in faces]
        vi = np.array([[c[0] for c in f] for f in faces])
        normals = np.zeros_like(vertices)
        n = np.cross(vertices[vi[:,1]]-vertices[vi[:,0]], vertices[vi[:,2]]-vertices[vi[:,0]])
        for i in range(3):
            np.add.at(normals, vi[:,i], n)
        normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-9)
        unique, indices = {}, []
        for f in faces:
            for key in f:
                if key not in unique:
                    unique[key] = len(unique)
                indices.append(unique[key])
        ids = np.array([v for v, _ in unique])
        coords = vertices[ids].copy()
        coords[:,1] -= floor
        coords *= scale
        # glTF's image origin is the top left; OBJ UV's origin is the bottom left.
        tex = uv[[t for _, t in unique]].copy()
        tex[:,1] = 1-tex[:,1]
        top = np.argsort(weights[ids], axis=1)[:, -4:]
        skin = np.take_along_axis(weights[ids], top, axis=1)
        skin /= np.maximum(skin.sum(axis=1,keepdims=True),1e-9)
        top[skin == 0] = 0
        attrs = {'POSITION':self.accessor(coords,'VEC3'),'NORMAL':self.accessor(normals[ids],'VEC3'),
                 'TEXCOORD_0':self.accessor(tex,'VEC2'),'JOINTS_0':self.accessor(top,'VEC4','<u2'),
                 'WEIGHTS_0':self.accessor(skin,'VEC4')}
        mesh_id = len(self.doc['meshes'])
        self.doc['meshes'].append({'name':name,'primitives':[{'attributes':attrs,'indices':self.accessor(indices,'SCALAR','<u4'),'material':material}]})
        node_id = len(self.doc['nodes'])
        self.doc['nodes'].append({'name':name,'mesh':mesh_id,'skin':0})
        self.doc['scenes'][0]['nodes'].append(node_id)

    def save(self, path):
        for node in self.doc['nodes']:
            if node.get('children') == []:
                del node['children']
        for mesh in self.doc['meshes']:
            for primitive in mesh['primitives']:
                for index in primitive['attributes'].values():
                    self.doc['bufferViews'][self.doc['accessors'][index]['bufferView']]['target'] = 34962
                self.doc['bufferViews'][self.doc['accessors'][primitive['indices']]['bufferView']]['target'] = 34963
        while len(self.data)%4:
            self.data.append(0)
        self.doc['buffers'] = [{'byteLength':len(self.data)}]
        if 'extensionsUsed' in self.doc:
            self.doc['extensionsUsed'] = sorted(set(self.doc['extensionsUsed']))
        raw = json.dumps(self.doc,separators=(',',':')).encode()
        raw += b' '*((-len(raw))%4)
        path.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(raw)+len(self.data))+struct.pack('<I4s',len(raw),b'JSON')+raw+struct.pack('<I4s',len(self.data),b'BIN\0')+self.data)


def quaternion(x=0, y=0, z=0):
    cx, cy, cz = np.cos(np.array([x,y,z])/2)
    sx, sy, sz = np.sin(np.array([x,y,z])/2)
    return [sx*cy*cz+cx*sy*sz, cx*sy*cz-sx*cy*sz, cx*cy*sz+sx*sy*cz, cx*cy*cz-sx*sy*sz]


def rig_and_animations(glb, rig, names, base, scale, floor):
    heads = {name:base[rig['joints'][bone['head']]].mean(axis=0) for name,bone in rig['bones'].items()}
    for name in names:
        bone = rig['bones'][name]
        head = heads[name].copy()
        parent = bone['parent']
        if parent:
            head -= heads[parent]
        else:
            head[1] -= floor
        glb.doc['nodes'].append({'name':name.replace('.','_'),'translation':(head*scale).tolist(),'children':[]})
    for i,name in enumerate(names):
        parent = rig['bones'][name]['parent']
        glb.doc['nodes'][names.index(parent)+1 if parent else 0]['children'].append(i+1)
    inverse = []
    for name in names:
        h = heads[name].copy();h[1] -= floor
        m = np.eye(4);m[:3,3] = -h*scale
        inverse.append(m.T.flatten())
    glb.doc['skins'].append({'joints':list(range(1,len(names)+1)),'inverseBindMatrices':glb.accessor(inverse,'MAT4'),'skeleton':names.index('root')+1})
    for clip,duration in [('Idle',4),('Walk',1.2),('Gesture',2.4)]:
        times = np.linspace(0,duration,49)
        animation = {'name':clip,'samplers':[],'channels':[]}
        input_id = glb.accessor(times,'SCALAR')
        for name in ['upperarm01.L','upperarm01.R','lowerarm01.L','lowerarm01.R','upperleg01.L','upperleg01.R','lowerleg01.L','lowerleg01.R','head','spine01']:
            values = []
            sign = 1 if name.endswith('.L') else -1
            for t in times:
                phase = 2*math.pi*t/duration
                walk = math.sin(phase) if clip=='Walk' else 0
                x=y=z=0
                if name.startswith('upperarm'):
                    z = -.51*sign
                    x = -.08 + .34*walk*sign
                    if clip=='Gesture' and sign==-1:
                        x -= .65*math.sin(math.pi*t/duration)**2
                elif name.startswith('lowerarm'):
                    x = .72 + .06*abs(walk)
                elif name.startswith('upperleg'):
                    z = -.10*sign;x = -.36*walk*sign
                elif name.startswith('lowerleg'):
                    x = .04+.48*max(0,walk*sign)
                elif name=='head':
                    y = .025*math.sin(phase)
                    x = .06*math.sin(phase) if clip=='Gesture' else .008*math.sin(phase)
                elif name=='spine01':
                    x = .012*math.sin(phase);y = .025*walk
                values.append(quaternion(x,y,z))
            output_id = glb.accessor(values,'VEC4')
            animation['channels'].append({'sampler':len(animation['samplers']),'target':{'node':names.index(name)+1,'path':'rotation'}})
            animation['samplers'].append({'input':input_id,'output':output_id,'interpolation':'LINEAR'})
        glb.doc['animations'].append(animation)


def build(gender, casual=False):
    base, uv, body_faces = obj(SOURCE/'base.obj')
    for line in (SOURCE/f'caucasian-{gender}-young.target').read_text().splitlines():
        t = line.split()
        if len(t)==4 and t[0].isdigit():
            base[int(t[0])] += np.array(list(map(float,t[1:])))
    rig = json.loads((SOURCE/'default.mhskel').read_text())
    names = list(rig['bones'])
    weights = np.zeros((len(base),len(names)))
    for name, rows in json.loads((SOURCE/'default_weights.mhw').read_text())['weights'].items():
        for v,w in rows:
            weights[v,names.index(name)] = w
    weights /= np.maximum(weights.sum(axis=1,keepdims=True),1e-9)
    suit = ('male_casualsuit04' if casual else 'male_elegantsuit01') if gender=='male' else 'female_elegantsuit01'
    items = [('clothes',suit,'Tailored_clothing',.82),('clothes','shoes01','Leather_shoes',.38),
             ('hair','short02' if gender=='male' else 'long01','Hair',.56),
             ('eyebrows','eyebrow001','Eyebrows',.8),('eyelashes','eyelashes01','Eyelashes',.65)]
    fitted, removed = [], set()
    for kind,key,name,roughness in items:
        folder = ASSETS/kind/key
        p, tex, faces = obj(folder/f'{key}.obj')
        p, skin, deleted = proxy(folder/f'{key}.mhclo',base,weights)
        assert len(p)>max(v for _,f in faces for v,_ in f),key
        fitted.append((name,p,tex,faces,skin,folder,roughness))
        removed.update(deleted)
    body_faces = [(g,f) for g,f in body_faces if g=='body' and not all(v in removed for v,_ in f)]
    floor = min(p[:,1].min() for _,p,*_ in fitted)
    scale = (1.78 if gender=='male' else 1.69)/(base[:,1].max()-floor)
    glb = GLB()
    rig_and_animations(glb,rig,names,base,scale,floor)
    skin_folder = ASSETS/'skins'/f'young_caucasian_{gender}'
    material = glb.material('Skin',skin_folder,roughness=.56)
    glb.mesh('Face_neck_hands',base,uv,body_faces,weights,material,scale,floor)
    for name,p,tex,faces,skin,folder,roughness in fitted:
        material = glb.material(name,folder,roughness,hair=name in ('Hair','Eyebrows','Eyelashes'))
        glb.mesh(name,p,tex,faces,skin,material,scale,floor)
    # The eye proxy fits the eyelids and follows the head rig, with a wet clear coat.
    folder = ASSETS/'eyes/high-poly'
    p, tex, faces = obj(folder/'high-poly.obj')
    p, skin, _ = proxy(folder/'high-poly.mhclo',base,weights)
    material = glb.material('Eyes',roughness=.22,diffuse=SOURCE/'brown_eye.png',eye=True)
    glb.mesh('Eyes',p,tex,faces,skin,material,scale,floor)
    path = OUTPUT/f'npc_realistic_{gender}{"_casual" if casual else ""}.glb'
    glb.save(path)
    triangles = sum(glb.doc['accessors'][m['primitives'][0]['indices']]['count']//3 for m in glb.doc['meshes'])
    print(path.name,round(path.stat().st_size/1048576,2),'MiB',triangles,'triangles',len(names),'bones',flush=True)


if __name__=='__main__':
    OUTPUT.mkdir(parents=True,exist_ok=True)
    build('male')
    build('female')
    build('male',casual=True)
