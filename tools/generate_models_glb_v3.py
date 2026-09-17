"""
Genera dos modelos GLB nuevos para el personal de tienda de SIDE, inspirados
en las dos imágenes de referencia de vestuario ejecutivo:

  - npc_exec_male.glb   -> traje azul marino, corbata, lentes
  - npc_exec_female.glb -> blazer/chaleco crema sin mangas, pantalón sastre
                            beige, cabello oscuro ondulado

Sigue exactamente el mismo estilo low-poly / PBR por primitivas que
tools/generate_models_glb_v2.py, para que ambos modelos combinen
visualmente con el resto de assets/models3d/*.glb del proyecto.

Cómo ejecutarlo (dentro de la carpeta del proyecto SIDE):
    pip install trimesh numpy pygltflib
    python tools/generate_models_glb_v3.py

Los archivos se escriben en assets/models3d/.
"""

import os, math
import numpy as np
import trimesh
from trimesh.transformations import translation_matrix, rotation_matrix
from trimesh.visual.material import PBRMaterial

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, 'assets', 'models3d')
os.makedirs(OUT, exist_ok=True)


def rgba(v, a=255):
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255, a]


def material(name, color, rough=.58, metal=.03):
    return PBRMaterial(name=name, baseColorFactor=rgba(color), metallicFactor=metal, roughnessFactor=rough)


def mat_apply(mesh, mat):
    mesh.visual.material = mat
    return mesh


def add_geo(sc, mesh, node, geom=None, parent='Root', T=None):
    if T is None:
        T = np.eye(4)
    sc.add_geometry(mesh, node_name=node, geom_name=geom or node + '_geo', parent_node_name=parent, transform=T)


def empty(sc, node, parent='Root', pos=(0, 0, 0), rot=None):
    T = translation_matrix(pos)
    if rot:
        T = T @ rotation_matrix(rot[1], rot[0])
    sc.graph.update(frame_to=node, frame_from=parent, matrix=T)


def box(ext, mat=None):
    if mat is None:
        mat = material('White', 0xf3f4f2, .45, .02)
    return mat_apply(trimesh.creation.box(extents=ext), mat)


def sphere(r, mat, scale=(1, 1, 1), sub=2):
    m = trimesh.creation.icosphere(subdivisions=sub, radius=r)
    m.apply_scale(scale)
    return mat_apply(m, mat)


def capsule(r, h, mat, scale=(1, 1, 1), sections=(16, 16)):
    m = trimesh.creation.capsule(height=max(.001, h - 2 * r), radius=r, count=sections)
    m.apply_scale(scale)
    return mat_apply(m, mat)


def cyl(r, h, mat, sections=20):
    return mat_apply(trimesh.creation.cylinder(radius=r, height=h, sections=sections), mat)


def torus(R, r, mat):
    return mat_apply(trimesh.creation.torus(major_radius=R, minor_radius=r, major_sections=32, minor_sections=12), mat)


def frustum(wtop, wbot, h, dtop, dbot, mat):
    y0 = -h / 2
    y1 = h / 2
    verts = []
    for y, w, d in [(y0, wbot, dbot), (y1, wtop, dtop)]:
        verts += [[-w / 2, y, -d / 2], [w / 2, y, -d / 2], [w / 2, y, d / 2], [-w / 2, y, d / 2]]
    faces = [[0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6], [0, 4, 5], [0, 5, 1], [1, 5, 6], [1, 6, 2], [2, 6, 7], [2, 7, 3], [3, 7, 4], [3, 4, 0]]
    m = trimesh.Trimesh(vertices=np.array(verts), faces=np.array(faces), process=True)
    return mat_apply(m, mat)


def child_mesh(sc, parent, node, mesh, pos=(0, 0, 0), rot=None):
    T = translation_matrix(pos)
    if rot:
        T = T @ rotation_matrix(rot[1], rot[0])
    add_geo(sc, mesh, node, parent=parent, T=T)


# Reusa los mismos tonos base de piel/zapato que generate_models_glb_v2.py
SKIN_LIGHT = material('SkinLight', 0xe0b48c, .72, 0)
SKIN_MED = material('SkinMed', 0xcd8f66, .72, 0)
SHOE = material('LeatherShoes', 0x2a2015, .40, .12)


def human_exec(female, top_hex, pants_hex, hair_hex, skin_mat, tie_hex=None, glasses=False, buttons=False):
    """Cuerpo humano low-poly, mismo plan de proporciones que human() en
    generate_models_glb_v2.py, con colores y accesorios parametrizados."""
    sc = trimesh.Scene(base_frame='Root')
    top = material('Top', top_hex, .55, .04)
    pants = material('Pants', pants_hex, .56, .03)
    hair_mat = material('Hair', hair_hex, .76, 0)

    torso = frustum(.48 if not female else .43, .34 if not female else .30, .55, .25, .20, top)
    add_geo(sc, torso, 'Torso', T=translation_matrix((0, 1.15, 0)))
    hips = frustum(.34, .39 if female else .35, .19, .21, .22, pants)
    add_geo(sc, hips, 'Hips', T=translation_matrix((0, .77, 0)))
    neck = cyl(.052, .12, skin_mat, 18)
    add_geo(sc, neck, 'Neck', T=translation_matrix((0, 1.48, 0)))
    head = sphere(.185, skin_mat, (.94, 1.08, .92), 3)
    add_geo(sc, head, 'Head', T=translation_matrix((0, 1.67, 0)))

    for x in (-.185, .185):
        add_geo(sc, sphere(.038, skin_mat, (.45, .75, .32), 1), f'Ear_{x}', T=translation_matrix((x, 1.67, 0)))
    add_geo(sc, frustum(.035, .025, .055, .035, .03, skin_mat), 'Nose', T=translation_matrix((0, 1.635, .172)) @ rotation_matrix(math.pi / 2, (1, 0, 0)))
    for x in (-.058, .058):
        add_geo(sc, sphere(.024, material('EyeWhite', 0xf3f4f2), (.95, .58, .32), 2), f'EyeWhite_{x}', T=translation_matrix((x, 1.69, .168)))
        add_geo(sc, sphere(.010, material('EyeIris', 0x10151b), (1, 1, .55), 1), f'Eye_{x}', T=translation_matrix((x, 1.69, .184)))
    add_geo(sc, box((.075, .012, .012), material('Mouth', 0x7d3f42, .55, 0)), 'Mouth', T=translation_matrix((0, 1.585, .178)))

    # cabello: capa base + mechones laterales/traseros ondulados para look femenino largo
    add_geo(sc, sphere(.193, hair_mat, (1.02, .70, 1.0), 3), 'Hair', T=translation_matrix((0, 1.745, -.005)))
    if female:
        child_mesh(sc, 'Root', 'HairBack', capsule(.12, .40, hair_mat, (1.3, 1, .7)), (0, 1.56, -.105))
        child_mesh(sc, 'Root', 'HairSideL', capsule(.055, .36, hair_mat, (1, 1, .75)), (-.15, 1.55, -.02), ((0, 0, 1), -.08))
        child_mesh(sc, 'Root', 'HairSideR', capsule(.055, .36, hair_mat, (1, 1, .75)), (.15, 1.55, -.02), ((0, 0, 1), .08))
    else:
        child_mesh(sc, 'Root', 'HairFront', box((.28, .055, .11), hair_mat), (-.01, 1.82, .06), ((0, 0, 1), -.08))

    # lentes (opcional): dos aros + puente, estilo montura fina
    if glasses:
        frame_mat = material('GlassesFrame', 0x1c1c1c, .4, .35)
        lens_mat = material('GlassesLens', 0xbcd6e6, .15, .1)
        for x in (-.062, .062):
            add_geo(sc, torus(.028, .006, frame_mat), f'GlassFrame_{x}', T=translation_matrix((x, 1.692, .175)) @ rotation_matrix(math.pi / 2, (0, 1, 0)))
            add_geo(sc, sphere(.024, lens_mat, (1, 1, .12), 2), f'GlassLens_{x}', T=translation_matrix((x, 1.692, .175)))
        add_geo(sc, box((.032, .006, .006), frame_mat), 'GlassBridge', T=translation_matrix((0, 1.692, .173)))

    # brazos y piernas articulados (mismo esquema que human())
    for side, sgn in [('L', -1), ('R', 1)]:
        empty(sc, f'Arm_{side}', 'Root', (sgn * .285, 1.35, 0))
        child_mesh(sc, f'Arm_{side}', f'Arm_{side}_Mesh', capsule(.064, .34, top, (.95, 1, .9)), (0, -.17, 0))
        empty(sc, f'Forearm_{side}', f'Arm_{side}', (0, -.34, 0))
        child_mesh(sc, f'Forearm_{side}', f'Forearm_{side}_Mesh', capsule(.052, .30, skin_mat, (.94, 1, .9)), (0, -.15, 0))
        empty(sc, f'Hand_{side}', f'Forearm_{side}', (0, -.30, .01))
        child_mesh(sc, f'Hand_{side}', f'Hand_{side}_Mesh', sphere(.065, skin_mat, (.75, 1.0, .58), 2), (0, -.035, .015))
        empty(sc, f'Leg_{side}', 'Root', (sgn * .105, .68, 0))
        child_mesh(sc, f'Leg_{side}', f'Thigh_{side}', frustum(.135, .11, .34, .15, .14, pants), (0, -.17, 0))
        empty(sc, f'Knee_{side}', f'Leg_{side}', (0, -.34, 0))
        child_mesh(sc, f'Knee_{side}', f'Calf_{side}', frustum(.11, .085, .31, .14, .12, pants), (0, -.155, 0))
        child_mesh(sc, f'Knee_{side}', f'Shoe_{side}', box((.17, .10, .30), SHOE), (0, -.34, .055))

    if tie_hex is not None:
        # corbata + cuello de camisa + solapas de saco (look de traje formal)
        add_geo(sc, box((.06, .31, .025), material('Tie', tie_hex, .43, .05)), 'Tie', T=translation_matrix((0, 1.16, .137)))
        for x, a in [(-.06, -.38), (.06, .38)]:
            child_mesh(sc, 'Root', f'Collar{x}', box((.12, .045, .02), material('Collar', 0xf5f5f4)), (x, 1.415, .132), ((0, 0, 1), a))
        for x, a in [(-.10, -.30), (.10, .30)]:
            child_mesh(sc, 'Root', f'Lapel{x}', frustum(.09, .035, .28, .025, .02, top), (x, 1.24, .14), ((0, 0, 1), a))
    elif buttons:
        # fila de botones al frente, look de chaleco/blazer abotonado
        button_mat = material('Button', 0xcaa25a, .35, .5)
        for y in (1.24, 1.10, 0.96):
            add_geo(sc, sphere(.012, button_mat), f'Button_{y}', T=translation_matrix((0, y, .135)))
    else:
        add_geo(sc, box((.36, .045, .225), material('Belt', 0x10151b)), 'Belt', T=translation_matrix((0, .84, 0)))

    return sc


def export(sc, name):
    data = sc.export(file_type='glb')
    with open(os.path.join(OUT, name), 'wb') as f:
        f.write(data)
    print(name, len(data), 'bytes')


if __name__ == '__main__':
    exec_male = human_exec(
        female=False, top_hex=0x2c4a72, pants_hex=0x24344a, hair_hex=0x14100d,
        skin_mat=SKIN_LIGHT, tie_hex=0x3f78c9, glasses=True, buttons=False,
    )
    exec_female = human_exec(
        female=True, top_hex=0xf2ede2, pants_hex=0xc9a877, hair_hex=0x2a2019,
        skin_mat=SKIN_MED, tie_hex=None, glasses=False, buttons=True,
    )
    export(exec_male, 'npc_exec_male.glb')
    export(exec_female, 'npc_exec_female.glb')
