import os, math
import numpy as np
import trimesh
from trimesh.transformations import translation_matrix, rotation_matrix
from trimesh.visual.material import PBRMaterial

BASE=os.path.dirname(os.path.dirname(__file__))
OUT=os.path.join(BASE,'assets','models3d')
os.makedirs(OUT, exist_ok=True)

def rgba(v,a=255): return [(v>>16)&255,(v>>8)&255,v&255,a]
def material(name,color,rough=.58,metal=.03): return PBRMaterial(name=name,baseColorFactor=rgba(color),metallicFactor=metal,roughnessFactor=rough)
M={
'skin':material('Skin',0xd7a47a,.72,0),'skin_dark':material('SkinDark',0x9b684d,.72,0),'white':material('White',0xf3f4f2,.45,.02),
'navy':material('Navy',0x183047,.5,.03),'pants':material('Pants',0x1c2733,.56,.03),'shoe':material('LeatherShoes',0x3c2b23,.42,.12),
'hair':material('Hair',0x33251e,.76,0),'black':material('Black',0x10151b,.34,.22),'metal':material('Metal',0x323b43,.25,.72),
'chrome':material('Chrome',0xb7c1c9,.18,.9),'gold':material('Gold',0xd2ad44,.22,.82),'wood':material('Wood',0x6e4d35,.63,.03),
'blue':material('BlueLeather',0x294a64,.38,.05),'tan':material('TanLeather',0xc18b60,.38,.04),'brown':material('BrownLeather',0x8c5635,.38,.05),
'cream':material('CreamLeather',0xe2d4bb,.46,.03),'glass':material('Glass',0x9bcce5,.10,.08),'fabric':material('Fabric',0x35465a,.86,0),
'red':material('Red',0x9d3040,.42,.06),'rubber':material('Rubber',0x121416,.83,.02),'asphalt':material('Asphalt',0x292f35,.95,0),
}

def mat_apply(mesh,mat): mesh.visual.material=mat; return mesh

def add_geo(sc,mesh,node,geom=None,parent='Root',T=None):
    if T is None:T=np.eye(4)
    sc.add_geometry(mesh,node_name=node,geom_name=geom or node+'_geo',parent_node_name=parent,transform=T)

def empty(sc,node,parent='Root',pos=(0,0,0),rot=None):
    T=translation_matrix(pos)
    if rot: T=T@rotation_matrix(rot[1],rot[0])
    sc.graph.update(frame_to=node,frame_from=parent,matrix=T)

def box(ext,mat=None):
    if mat is None: mat=M['white']
    return mat_apply(trimesh.creation.box(extents=ext),mat)
def sphere(r,mat,scale=(1,1,1),sub=2):
    m=trimesh.creation.icosphere(subdivisions=sub,radius=r);m.apply_scale(scale);return mat_apply(m,mat)
def capsule(r,h,mat,scale=(1,1,1),sections=(16,16)):
    m=trimesh.creation.capsule(height=max(.001,h-2*r),radius=r,count=sections);m.apply_scale(scale);return mat_apply(m,mat)
def cyl(r,h,mat,sections=20): return mat_apply(trimesh.creation.cylinder(radius=r,height=h,sections=sections),mat)
def torus(R,r,mat): return mat_apply(trimesh.creation.torus(major_radius=R,minor_radius=r,major_sections=32,minor_sections=12),mat)

def frustum(wtop,wbot,h,dtop,dbot,mat):
    y0=-h/2;y1=h/2
    verts=[]
    for y,w,d in [(y0,wbot,dbot),(y1,wtop,dtop)]:
        verts += [[-w/2,y,-d/2],[w/2,y,-d/2],[w/2,y,d/2],[-w/2,y,d/2]]
    faces=[[0,1,2],[0,2,3],[4,6,5],[4,7,6],[0,4,5],[0,5,1],[1,5,6],[1,6,2],[2,6,7],[2,7,3],[3,7,4],[3,4,0]]
    m=trimesh.Trimesh(vertices=np.array(verts),faces=np.array(faces),process=True)
    return mat_apply(m,mat)

def child_mesh(sc,parent,node,mesh,pos=(0,0,0),rot=None):
    T=translation_matrix(pos)
    if rot:T=T@rotation_matrix(rot[1],rot[0])
    add_geo(sc,mesh,node,parent=parent,T=T)

def human(female=False,staff=False):
    sc=trimesh.Scene(base_frame='Root')
    skin=M['skin_dark'] if female else M['skin']
    cloth=M['white'] if staff else material('TopFemale' if female else 'TopMale',0xb56f62 if female else 0x32679a,.62,.02)
    pants=material('Denim',0x263a53,.66,.02) if female and not staff else M['pants']
    # torso with actual shoulder/waist taper
    torso=frustum(.48 if not female else .43,.34 if not female else .30,.55,.25,.20,cloth)
    add_geo(sc,torso,'Torso',T=translation_matrix((0,1.15,0)))
    hips=frustum(.34,.39 if female else .35,.19,.21,.22,pants);add_geo(sc,hips,'Hips',T=translation_matrix((0,.77,0)))
    neck=cyl(.052,.12,skin,18);add_geo(sc,neck,'Neck',T=translation_matrix((0,1.48,0)))
    head=sphere(.185,skin,(.94,1.08,.92),3);add_geo(sc,head,'Head',T=translation_matrix((0,1.67,0)))
    # ears / nose / eyes / mouth
    for x in (-.185,.185): add_geo(sc,sphere(.038,skin,(.45,.75,.32),1),f'Ear_{x}',T=translation_matrix((x,1.67,0)))
    add_geo(sc,frustum(.035,.025,.055,.035,.03,skin),'Nose',T=translation_matrix((0,1.635,.172))@rotation_matrix(math.pi/2,(1,0,0)))
    for x in (-.058,.058):
        add_geo(sc,sphere(.024,M['white'],(.95,.58,.32),2),f'EyeWhite_{x}',T=translation_matrix((x,1.69,.168)))
        add_geo(sc,sphere(.010,M['black'],(1,1,.55),1),f'Eye_{x}',T=translation_matrix((x,1.69,.184)))
    add_geo(sc,box((.075,.012,.012),material('Mouth',0x7d3f42,.55,0)),'Mouth',T=translation_matrix((0,1.585,.178)))
    # override mouth material by geometry
    sc.geometry['Mouth_geo'].visual.material=material('Mouth',0x7d3f42,.55,0)
    # hair cap and style
    add_geo(sc,sphere(.193,M['hair'],(1.02,.70,1.0),3),'Hair',T=translation_matrix((0,1.745,-.005)))
    if female:
        child_mesh(sc,'Root','HairBack',capsule(.12,.40,M['hair'],(1.3,1,.7)),(0,1.56,-.105))
        child_mesh(sc,'Root','HairSideL',capsule(.055,.36,M['hair'],(1,1,.75)),(-.15,1.55,-.02),((0,0,1),-.08))
        child_mesh(sc,'Root','HairSideR',capsule(.055,.36,M['hair'],(1,1,.75)),(.15,1.55,-.02),((0,0,1),.08))
    else:
        child_mesh(sc,'Root','HairFront',box((.28,.055,.11),M['hair']),(-.01,1.82,.06),((0,0,1),-.08))
    # shoulders + articulated arms
    for side,sgn in [('L',-1),('R',1)]:
        empty(sc,f'Arm_{side}','Root',(sgn*.285,1.35,0))
        child_mesh(sc,f'Arm_{side}',f'Arm_{side}_Mesh',capsule(.064,.34,cloth,(.95,1,.9)),(0,-.17,0))
        empty(sc,f'Forearm_{side}',f'Arm_{side}',(0,-.34,0))
        child_mesh(sc,f'Forearm_{side}',f'Forearm_{side}_Mesh',capsule(.052,.30,skin,(.94,1,.9)),(0,-.15,0))
        empty(sc,f'Hand_{side}',f'Forearm_{side}',(0,-.30,.01))
        child_mesh(sc,f'Hand_{side}',f'Hand_{side}_Mesh',sphere(.065,skin,(.75,1.0,.58),2),(0,-.035,.015))
        # articulated leg with thigh + calf
        empty(sc,f'Leg_{side}','Root',(sgn*.105,.68,0))
        child_mesh(sc,f'Leg_{side}',f'Thigh_{side}',frustum(.135,.11,.34,.15,.14,pants),(0,-.17,0))
        empty(sc,f'Knee_{side}',f'Leg_{side}',(0,-.34,0))
        child_mesh(sc,f'Knee_{side}',f'Calf_{side}',frustum(.11,.085,.31,.14,.12,pants),(0,-.155,0))
        child_mesh(sc,f'Knee_{side}',f'Shoe_{side}',box((.17,.10,.30),M['shoe']),(0,-.34,.055))
        sc.geometry[f'Shoe_{side}_geo'].visual.material=M['shoe']
    # clothing details
    if staff:
        add_geo(sc,box((.06,.31,.025)),'Tie',T=translation_matrix((0,1.16,.137)));sc.geometry['Tie_geo'].visual.material=material('Tie',0x285b9a,.43,.05)
        for x,a in [(-.06,-.38),(.06,.38)]:
            child_mesh(sc,'Root',f'Collar{x}',box((.12,.045,.02),M['white']),(x,1.415,.132),((0,0,1),a))
        # jacket lapels
        for x,a in [(-.10,-.30),(.10,.30)]:
            child_mesh(sc,'Root',f'Lapel{x}',frustum(.09,.035,.28,.025,.02,M['navy']),(x,1.24,.14),((0,0,1),a))
    else:
        # belt + shirt hem
        add_geo(sc,box((.36,.045,.225)),'Belt',T=translation_matrix((0,.84,0)));sc.geometry['Belt_geo'].visual.material=M['black']
    return sc

def bag(kind):
    sc=trimesh.Scene(base_frame='Root')
    if kind=='esencial':
        main,trim=M['tan'],M['brown']
        add_geo(sc,capsule(.16,.55,main,(2.55,1,1.05)),'BagBody',T=translation_matrix((0,.30,0))@rotation_matrix(math.pi/2,(0,0,1)))
        add_geo(sc,frustum(.80,.88,.23,.32,.35,main),'Flap',T=translation_matrix((0,.53,.04)))
        for x in (-.26,.26):
            add_geo(sc,box((.085,.38,.055)),f'Strap{x}',T=translation_matrix((x,.35,.20)));sc.geometry[f'Strap{x}_geo'].visual.material=trim
            add_geo(sc,torus(.065,.014,M['gold']),f'Buckle{x}',T=translation_matrix((x,.30,.235))@rotation_matrix(math.pi/2,(1,0,0)))
        add_geo(sc,torus(.29,.032,trim),'Handle',T=translation_matrix((0,.67,0))@rotation_matrix(math.pi/2,(1,0,0)))
        # subtle seam strips
        add_geo(sc,box((.82,.022,.024)),'Seam',T=translation_matrix((0,.15,.185)));sc.geometry['Seam_geo'].visual.material=trim
    elif kind=='urbano':
        main,trim=M['cream'],M['brown']
        add_geo(sc,capsule(.22,.60,main,(1.85,1,.82)),'BagBody',T=translation_matrix((0,.31,0))@rotation_matrix(math.pi/2,(0,0,1)))
        add_geo(sc,frustum(.82,.90,.15,.40,.42,trim),'Base',T=translation_matrix((0,.105,0)))
        add_geo(sc,box((.62,.035,.035)),'Zip',T=translation_matrix((0,.57,.215)));sc.geometry['Zip_geo'].visual.material=M['chrome']
        for x in (-.19,.19): add_geo(sc,torus(.20,.026,trim),f'Handle{x}',T=translation_matrix((x,.69,0))@rotation_matrix(math.pi/2,(1,0,0)))
        add_geo(sc,box((.50,.20,.025)),'Pocket',T=translation_matrix((0,.32,.235)));sc.geometry['Pocket_geo'].visual.material=material('Pocket',0xe9e1d3,.5,.02)
    else:
        main,trim=M['blue'],M['cream']
        add_geo(sc,frustum(.78,.91,.55,.30,.36,main),'BagBody',T=translation_matrix((0,.30,0)))
        add_geo(sc,frustum(.42,.34,.46,.07,.07,trim),'CenterStrap',T=translation_matrix((0,.32,.195)))
        add_geo(sc,cyl(.063,.05,M['gold'],20),'Button',T=translation_matrix((0,.25,.235))@rotation_matrix(math.pi/2,(1,0,0)))
        for x in (-.30,.30): add_geo(sc,torus(.075,.018,M['gold']),f'Ring{x}',T=translation_matrix((x,.55,0))@rotation_matrix(math.pi/2,(1,0,0)))
        add_geo(sc,torus(.39,.035,M['black']),'Handle',T=translation_matrix((0,.83,0))@rotation_matrix(math.pi/2,(1,0,0)))
        # side piping
        for x in (-.43,.43): add_geo(sc,box((.025,.46,.34)),f'Piping{x}',T=translation_matrix((x,.30,0)));sc.geometry[f'Piping{x}_geo'].visual.material=material('Piping',0xc88762,.4,.04)
    return sc

def checkout():
    sc=trimesh.Scene(base_frame='Root')
    add_geo(sc,frustum(4.75,4.95,.92,1.18,1.36,M['black']),'CounterBase',T=translation_matrix((0,.46,0)))
    add_geo(sc,box((4.98,.07,1.42)),'CounterTop',T=translation_matrix((0,.96,0)));sc.geometry['CounterTop_geo'].visual.material=M['white']
    add_geo(sc,box((2.0,.045,.80)),'Conveyor',T=translation_matrix((.95,1.035,0)));sc.geometry['Conveyor_geo'].visual.material=material('Conveyor',0x23282d,.76,.12)
    # scanner housing + glowing plate
    add_geo(sc,frustum(.58,.68,.18,.40,.48,M['metal']),'Scanner',T=translation_matrix((-.58,1.10,-.10)))
    add_geo(sc,box((.42,.025,.28)),'ScannerGlass',T=translation_matrix((-.58,1.205,-.10)));sc.geometry['ScannerGlass_geo'].visual.material=material('ScannerGlass',0x4aa9d8,.12,.35)
    # screen pedestal
    add_geo(sc,cyl(.045,.30,M['black'],14),'ScreenStand',T=translation_matrix((-.16,1.25,-.12)))
    add_geo(sc,box((.58,.34,.065)),'Screen',T=translation_matrix((-.16,1.48,-.18))@rotation_matrix(-.30,(1,0,0)));sc.geometry['Screen_geo'].visual.material=M['black']
    add_geo(sc,box((.48,.25,.018)),'ScreenFace',T=translation_matrix((-.16,1.48,-.215))@rotation_matrix(-.30,(1,0,0)));sc.geometry['ScreenFace_geo'].visual.material=material('ScreenFace',0x1a4568,.18,.15)
    add_geo(sc,frustum(.34,.42,.13,.22,.28,M['white']),'CardTerminal',T=translation_matrix((-1.02,1.09,.25))@rotation_matrix(.12,(1,0,0)))
    add_geo(sc,box((.38,.18,.28)),'Printer',T=translation_matrix((.02,1.08,.24)));sc.geometry['Printer_geo'].visual.material=M['black']
    add_geo(sc,box((1.35,.10,.42)),'BaggingTray',T=translation_matrix((-1.65,1.03,.03)));sc.geometry['BaggingTray_geo'].visual.material=M['chrome']
    # front chrome strips
    for x in (-1.8,1.8): add_geo(sc,box((.9,.035,.035)),f'Chrome{x}',T=translation_matrix((x,.78,.69)));sc.geometry[f'Chrome{x}_geo'].visual.material=M['chrome']
    return sc

def shelf():
    sc=trimesh.Scene(base_frame='Root')
    for x in (-1.10,1.10):
        add_geo(sc,box((.075,2.30,.075)),f'Post{x}',T=translation_matrix((x,1.15,0)));sc.geometry[f'Post{x}_geo'].visual.material=M['metal']
    for y in (.42,1.13,1.84):
        add_geo(sc,box((2.32,.085,.66)),f'Shelf{y}',T=translation_matrix((0,y,0)));sc.geometry[f'Shelf{y}_geo'].visual.material=M['wood']
        add_geo(sc,box((2.15,.022,.025)),f'Light{y}',T=translation_matrix((0,y-.065,.32)));sc.geometry[f'Light{y}_geo'].visual.material=material('WarmLight',0xffd89a,.18,.1)
    add_geo(sc,box((2.40,.09,.14)),'Header',T=translation_matrix((0,2.28,-.25)));sc.geometry['Header_geo'].visual.material=M['gold']
    add_geo(sc,box((2.24,2.05,.025)),'BackPanel',T=translation_matrix((0,1.22,-.34)));sc.geometry['BackPanel_geo'].visual.material=material('BackPanel',0x202832,.78,.02)
    return sc

def sofa():
    sc=trimesh.Scene(base_frame='Root')
    add_geo(sc,capsule(.22,.70,M['fabric'],(5.2,1,1.45)),'Seat',T=translation_matrix((0,.36,0))@rotation_matrix(math.pi/2,(0,1,0)))
    add_geo(sc,capsule(.20,.62,M['fabric'],(5.35,1,1.05)),'Back',T=translation_matrix((0,.84,.28))@rotation_matrix(math.pi/2,(0,1,0)))
    for x in (-1.35,1.35):
        add_geo(sc,box((.10,.40,.10)),f'Leg{x}',T=translation_matrix((x,.18,0)));sc.geometry[f'Leg{x}_geo'].visual.material=M['metal']
    for x in (-.75,.75): add_geo(sc,box((.52,.28,.10)),f'Cushion{x}',T=translation_matrix((x,.55,.27)));sc.geometry[f'Cushion{x}_geo'].visual.material=material('Cushion',0x50657e,.9,0)
    return sc

def sedan():
    sc=trimesh.Scene(base_frame='Root')
    bodymat=material('Body',0x3a6ca2,.28,.36)
    add_geo(sc,frustum(2.25,2.45,.52,1.02,1.15,bodymat),'CarBody',T=translation_matrix((0,.50,0))@rotation_matrix(math.pi/2,(0,1,0)))
    add_geo(sc,frustum(1.22,1.55,.46,.92,1.02,bodymat),'CarCabin',T=translation_matrix((-.05,.92,0))@rotation_matrix(math.pi/2,(0,1,0)))
    # windshield panes
    for x,a in [(-.57,-.55),(.57,.55)]:
        add_geo(sc,box((.55,.32,.025)),f'Glass{x}',T=translation_matrix((x,.95,0))@rotation_matrix(a,(0,0,1))@rotation_matrix(math.pi/2,(0,1,0)));sc.geometry[f'Glass{x}_geo'].visual.material=M['glass']
    for wx in (-.82,.82):
      for wz in (-.51,.51):
        add_geo(sc,cyl(.235,.18,M['rubber'],18),f'Wheel{wx}{wz}',T=translation_matrix((wx,.25,wz))@rotation_matrix(math.pi/2,(1,0,0)))
        add_geo(sc,cyl(.10,.185,M['chrome'],16),f'Rim{wx}{wz}',T=translation_matrix((wx,.25,wz))@rotation_matrix(math.pi/2,(1,0,0)))
    for x in (-1.19,1.19):
        add_geo(sc,box((.08,.16,.90)),f'Bumper{x}',T=translation_matrix((x,.36,0)));sc.geometry[f'Bumper{x}_geo'].visual.material=M['black']
    return sc

def streetlamp():
    sc=trimesh.Scene(base_frame='Root')
    add_geo(sc,cyl(.065,4.35,M['metal'],14),'Pole',T=translation_matrix((0,2.17,0)))
    add_geo(sc,box((.90,.055,.055)),'Arm',T=translation_matrix((.42,4.15,0)));sc.geometry['Arm_geo'].visual.material=M['metal']
    add_geo(sc,frustum(.26,.34,.15,.30,.34,M['black']),'Lamp',T=translation_matrix((.84,4.03,0)))
    add_geo(sc,box((.24,.02,.25)),'LampGlass',T=translation_matrix((.84,3.95,0)));sc.geometry['LampGlass_geo'].visual.material=material('LampGlow',0xffe8ac,.16,.04)
    return sc

def export(sc,name):
    data=sc.export(file_type='glb')
    with open(os.path.join(OUT,name),'wb') as f:f.write(data)
    print(name,len(data))

models={
'npc_male.glb':human(False,False),'npc_female.glb':human(True,False),'npc_staff.glb':human(False,True),
'bag_esencial.glb':bag('esencial'),'bag_urbano.glb':bag('urbano'),'bag_premium.glb':bag('premium'),
'checkout.glb':checkout(),'shelf.glb':shelf(),'sofa.glb':sofa(),'car_sedan.glb':sedan(),'streetlamp.glb':streetlamp()
}
for fn,sc in models.items():export(sc,fn)
