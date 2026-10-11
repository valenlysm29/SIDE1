"""Temporary Blender inspection helper; FBX input is data, never executed."""
import bpy, json, pathlib, sys, math
from mathutils import Vector

source=pathlib.Path(sys.argv[sys.argv.index('--')+1]); output=pathlib.Path(sys.argv[sys.argv.index('--')+2]);output.mkdir(parents=True,exist_ok=True)
results=[]
for i,file in enumerate(sorted(source.glob('*.fbx'))):
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    try:
        bpy.ops.import_scene.fbx(filepath=str(file),automatic_bone_orientation=False)
        meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
        arms=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
        bpy.context.scene.frame_set(0)
        corners=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
        if not corners: raise RuntimeError('no mesh')
        low=Vector([min(c[k] for c in corners) for k in range(3)]); high=Vector([max(c[k] for c in corners) for k in range(3)])
        center=(low+high)/2;size=high-low
        data={'file':file.name,'meshes':len(meshes),'arms':len(arms),'vertices':sum(len(o.data.vertices) for o in meshes),
              'size':list(size),'materials':sorted({m.name for o in meshes for m in o.data.materials if m}),
              'actions':[a.name for a in bpy.data.actions]}
        camera_data=bpy.data.cameras.new('Inspection Camera');camera=bpy.data.objects.new('Inspection Camera',camera_data);bpy.context.collection.objects.link(camera)
        camera.location=center+Vector((size.x*1.2+size.y*.5,-max(size.x,size.y)*2.2,size.z*.4))
        direction=center-camera.location;camera.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
        camera_data.type='ORTHO';camera_data.ortho_scale=max(size.z*1.25,size.x*2,size.y*2,.1)
        bpy.context.scene.camera=camera
        bpy.context.scene.render.engine='BLENDER_WORKBENCH'
        bpy.context.scene.display.shading.light='STUDIO';bpy.context.scene.display.shading.color_type='MATERIAL'
        bpy.context.scene.render.resolution_x=360;bpy.context.scene.render.resolution_y=500;bpy.context.scene.render.resolution_percentage=100
        bpy.context.scene.render.image_settings.file_format='PNG'
        target=output/f'{i:02d}.png';bpy.context.scene.render.filepath=str(target);bpy.ops.render.render(write_still=True)
        data['preview']=str(target);results.append(data)
    except Exception as error:results.append({'file':file.name,'error':str(error)})
    print('INSPECT',file.name,results[-1],flush=True)
(output/'inventory.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
