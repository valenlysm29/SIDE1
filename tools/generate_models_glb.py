import os, math
import numpy as np
import trimesh
from trimesh.transformations import translation_matrix, rotation_matrix
from trimesh.visual.material import PBRMaterial

OUT='/mnt/data/side_glb_upgrade/UNIFORME_ADECUADO_3D_REF_REALISMO/assets/models3d'
os.makedirs(OUT, exist_ok=True)

def rgba(hexv, a=255):
    return [(hexv>>16)&255,(hexv>>8)&255,hexv&255,a]

def material(name, color, rough=.65, metal=.05):
    return PBRMaterial(name=name, baseColorFactor=rgba(color), metallicFactor=metal, roughnessFactor=rough)

MATS={
    'skin':material('Skin',0xd7a47a,.82,0), 'skin2':material('SkinDark',0x9a6548,.82,0),
    'shirt':material('Shirt',0xf0f2f4,.6,.02), 'shirt_blue':material('ShirtBlue',0x315a91,.55,.03),
    'pants':material('Pants',0x1d2b3c,.62,.03), 'shoe':material('Shoes',0x4a3025,.6,.08),
    'hair':material('Hair',0x3b2a20,.8,0), 'hair2':material('HairDark',0x16181b,.8,0),
    'tie':material('Tie',0x2f67c2,.45,.05), 'metal':material('Metal',0x303942,.32,.65),
    'gold':material('Gold',0xd8b84d,.22,.78), 'black':material('Black',0x11161c,.35,.18),
    'white':material('White',0xe8edf2,.5,.05), 'wood':material('Wood',0x6c4b34,.68,.04),
    'glass':material('Glass',0x8fc9e8,.18,.05), 'fabric':material('Fabric',0x334a65,.92,0),
    'brown':material('LeatherBrown',0x9b6238,.46,.05), 'tan':material('LeatherTan',0xc28a5c,.46,.05),
    'blue':material('LeatherBlue',0x405b75,.44,.07), 'cream':material('Cream',0xe7d9bf,.52,.03),
    'red':material('AccentRed',0xa3263a,.45,.08), 'green':material('Green',0x456c55,.68,.02),
}

def apply_mat(mesh, mat):
    mesh.visual.material = mat
    return mesh

def add(scene, mesh, name, transform=None, parent=None):
    if transform is None: transform=np.eye(4)
    scene.add_geometry(mesh, node_name=name, geom_name=name+'_geo', parent_node_name=parent, transform=transform)


def box(ext, mat, name, pos=(0,0,0), rot=None):
    m=trimesh.creation.box(extents=ext)
    apply_mat(m,mat)
    T=translation_matrix(pos)
    if rot:
        axis,ang=rot
        T=T@rotation_matrix(ang,axis)
    return m,T

def sphere(radius, mat, name, pos=(0,0,0), scale=(1,1,1), sub=2):
    m=trimesh.creation.icosphere(subdivisions=sub, radius=radius)
    m.apply_scale(scale)
    apply_mat(m,mat)
    return m, translation_matrix(pos)

def capsule(radius,height,mat,name,pos=(0,0,0),scale=(1,1,1),rot=None,count=(16,16)):
    # trimesh capsule total height includes cylinder + hemispheres
    m=trimesh.creation.capsule(height=max(.001,height-2*radius), radius=radius, count=count)
    m.apply_scale(scale)
    apply_mat(m,mat)
    T=translation_matrix(pos)
    if rot:
        axis,ang=rot; T=T@rotation_matrix(ang,axis)
    return m,T

def cyl(radius,height,mat,name,pos=(0,0,0),rot=None,sections=20):
    m=trimesh.creation.cylinder(radius=radius,height=height,sections=sections)
    apply_mat(m,mat)
    T=translation_matrix(pos)
    if rot:
        axis,ang=rot; T=T@rotation_matrix(ang,axis)
    return m,T

def torus(major,minor,mat,name,pos=(0,0,0),rot=None,major_sections=32,minor_sections=10):
    m=trimesh.creation.torus(major_radius=major, minor_radius=minor, major_sections=major_sections, minor_sections=minor_sections)
    apply_mat(m,mat)
    T=translation_matrix(pos)
    if rot:
        axis,ang=rot; T=T@rotation_matrix(ang,axis)
    return m,T

def export(scene,name):
    data=scene.export(file_type='glb')
    with open(os.path.join(OUT,name),'wb') as f: f.write(data)
    print(name, len(data))


def human(female=False, staff=False):
    sc=trimesh.Scene(base_frame='Root')
    skin=MATS['skin'] if not female else MATS['skin2']
    shirt=MATS['shirt'] if staff else (MATS['shirt_blue'] if not female else material('ShirtFemale',0xb76f63,.62,.02))
    pants=MATS['pants']
    hair=MATS['hair2'] if female else MATS['hair']
    torso_w=.40 if female else .46
    # smoother torso and hips
    m,T=capsule(.20,.62,shirt,'Torso',(0,1.12,0),scale=(torso_w/.40,1,.62)); add(sc,m,'Torso',T)
    m,T=capsule(.16,.22,pants,'Hips',(0,.76,0),scale=(1.15 if female else 1,1,.72)); add(sc,m,'Hips',T)
    m,T=sphere(.19,skin,'Head',(0,1.67,.0),scale=(.96,1.06,.94),sub=2); add(sc,m,'Head',T)
    m,T=cyl(.052,.12,skin,'Neck',(0,1.48,0),sections=16); add(sc,m,'Neck',T)
    # hair cap + back hair
    m,T=sphere(.195,hair,'Hair',(0,1.73,-.012),scale=(1,0.72,1),sub=2); add(sc,m,'Hair',T)
    if female:
        m,T=capsule(.13,.36,hair,'HairBack',(0,1.54,-.10),scale=(1.2,1,.65)); add(sc,m,'HairBack',T)
    # limbs (capsules rotate around their center; AnimationMixer rotates them)
    for side,sgn in [('L',-1),('R',1)]:
        m,T=capsule(.07,.40,shirt,'Arm_'+side,(sgn*.31,1.13,0),scale=(.9,1,.9)); add(sc,m,'Arm_'+side,T)
        m,T=capsule(.055,.33,skin,'Forearm_'+side,(sgn*.31,.80,0),scale=(.9,1,.9)); add(sc,m,'Forearm_'+side,T)
        m,T=sphere(.07,skin,'Hand_'+side,(sgn*.31,.59,.015),scale=(.82,1.05,.78),sub=1); add(sc,m,'Hand_'+side,T)
        m,T=capsule(.075,.62,pants,'Leg_'+side,(sgn*.115,.40,0),scale=(1,1,.94)); add(sc,m,'Leg_'+side,T)
        m,T=box((.17,.10,.29),MATS['shoe'],'Shoe_'+side,(sgn*.115,.055,.055)); add(sc,m,'Shoe_'+side,T)
    if staff:
        m,T=box((.055,.30,.025),MATS['tie'],'Tie',(0,1.13,.145)); add(sc,m,'Tie',T)
        # collar
        m,T=box((.11,.045,.02),MATS['white'],'CollarL',(-.06,1.40,.13),rot=((0,0,1),-.35)); add(sc,m,'CollarL',T)
        m,T=box((.11,.045,.02),MATS['white'],'CollarR',(.06,1.40,.13),rot=((0,0,1),.35)); add(sc,m,'CollarR',T)
    return sc


def bag(kind):
    sc=trimesh.Scene(base_frame='Root')
    if kind=='esencial':
        main,trim=MATS['tan'],MATS['brown']
        m,T=box((.90,.55,.35),main,'BagBody',(0,.30,0)); add(sc,m,'BagBody',T)
        m,T=box((.88,.16,.37),main,'Flap',(0,.54,.01),rot=((1,0,0),-.08)); add(sc,m,'Flap',T)
        for x in (-.26,.26):
            m,T=box((.10,.38,.05),trim,'Strap'+str(x),(x,.34,.20)); add(sc,m,'Strap'+str(x),T)
            m,T=box((.11,.10,.04),MATS['gold'],'Buckle'+str(x),(x,.30,.23)); add(sc,m,'Buckle'+str(x),T)
        m,T=torus(.29,.035,trim,'Handle',(0,.65,0),rot=((1,0,0),math.pi/2)); add(sc,m,'Handle',T)
    elif kind=='urbano':
        main=MATS['cream']; trim=MATS['brown']
        m,T=capsule(.25,.62,main,'BagBody',(0,.32,0),scale=(1.65,1,.72)); add(sc,m,'BagBody',T)
        m,T=box((.60,.04,.04),MATS['metal'],'Zip',(0,.56,.21)); add(sc,m,'Zip',T)
        m,T=box((.86,.14,.34),trim,'Base',(0,.09,0)); add(sc,m,'Base',T)
        for x in (-.18,.18):
            m,T=torus(.20,.028,trim,'Handle'+str(x),(x,.67,0),rot=((1,0,0),math.pi/2)); add(sc,m,'Handle'+str(x),T)
    else:
        main=MATS['blue']; trim=MATS['cream']
        m,T=box((.88,.58,.32),main,'BagBody',(0,.30,0)); add(sc,m,'BagBody',T)
        m,T=box((.47,.48,.07),trim,'CenterStrap',(0,.31,.19)); add(sc,m,'CenterStrap',T)
        m,T=cyl(.065,.05,MATS['gold'],'Button',(0,.27,.24),rot=((1,0,0),math.pi/2),sections=20); add(sc,m,'Button',T)
        for x in (-.31,.31):
            m,T=torus(.08,.021,MATS['gold'],'Ring'+str(x),(x,.54,.0),rot=((1,0,0),math.pi/2)); add(sc,m,'Ring'+str(x),T)
        m,T=torus(.39,.04,MATS['black'],'Handle',(0,.82,0),rot=((1,0,0),math.pi/2)); add(sc,m,'Handle',T)
    return sc


def checkout():
    sc=trimesh.Scene(base_frame='Root')
    # large minimalist counter with conveyor
    for mesh_,name,pos in [
        (box((4.9,.92,1.35),MATS['black'],'CounterBase',(0,.46,0)),'CounterBase',(0,0,0)),
        (box((4.95,.08,1.40),MATS['white'],'CounterTop',(0,.96,0)),'CounterTop',(0,0,0)),
        (box((2.0,.05,.82),MATS['metal'],'Conveyor',(.95,1.04,0)),'Conveyor',(0,0,0)),
    ]:
        m,T=mesh_; add(sc,m,name,T)
    m,T=box((.62,.18,.48),MATS['metal'],'Scanner',(-.55,1.10,-.18)); add(sc,m,'Scanner',T)
    m,T=box((.08,.28,.08),MATS['black'],'ScreenStand',(-.20,1.25,-.12)); add(sc,m,'ScreenStand',T)
    m,T=box((.54,.32,.07),MATS['black'],'Screen',(-.20,1.47,-.16),rot=((1,0,0),-.35)); add(sc,m,'Screen',T)
    m,T=box((.42,.06,.28),MATS['white'],'Keypad',(-.85,1.05,.18)); add(sc,m,'Keypad',T)
    m,T=box((.35,.18,.30),MATS['black'],'Printer',(.00,1.08,.24)); add(sc,m,'Printer',T)
    m,T=cyl(.09,.22,MATS['white'],'ReceiptRoll',(.0,1.17,.24),rot=((0,1,0),math.pi/2),sections=18); add(sc,m,'ReceiptRoll',T)
    return sc


def shelf():
    sc=trimesh.Scene(base_frame='Root')
    # boutique shelf with metal frame and three wood shelves
    for x in (-1.1,1.1):
        m,T=box((.09,2.35,.09),MATS['metal'],'Post'+str(x),(x,1.175,0)); add(sc,m,'Post'+str(x),T)
    for y in (.42,1.15,1.88):
        m,T=box((2.35,.10,.64),MATS['wood'],'Shelf'+str(y),(0,y,0)); add(sc,m,'Shelf'+str(y),T)
    m,T=box((2.45,.08,.12),MATS['gold'],'Header',(0,2.30,-.26)); add(sc,m,'Header',T)
    return sc


def sofa():
    sc=trimesh.Scene(base_frame='Root')
    m,T=capsule(.25,.72,MATS['fabric'],'Seat',(0,.36,0),scale=(5.2,1,1.45),rot=((0,1,0),math.pi/2)); add(sc,m,'Seat',T)
    m,T=capsule(.22,.65,MATS['fabric'],'Back',(0,.84,.28),scale=(5.5,1,1.05),rot=((0,1,0),math.pi/2)); add(sc,m,'Back',T)
    for x in (-1.35,1.35):
        m,T=box((.12,.45,.12),MATS['metal'],'Leg'+str(x),(x,.18,0)); add(sc,m,'Leg'+str(x),T)
    return sc

for filename, scene in [
    ('npc_male.glb',human(False,False)),('npc_female.glb',human(True,False)),('npc_staff.glb',human(False,True)),
    ('bag_esencial.glb',bag('esencial')),('bag_urbano.glb',bag('urbano')),('bag_premium.glb',bag('premium')),
    ('checkout.glb',checkout()),('shelf.glb',shelf()),('sofa.glb',sofa())]:
    export(scene,filename)
