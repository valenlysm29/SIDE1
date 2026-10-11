import bpy,sys,pathlib,json
from mathutils import Vector
files=sorted(pathlib.Path(sys.argv[sys.argv.index('--')+1]).glob('*.fbx'))
indices=[5,8,11,12,15,16]
out=pathlib.Path(sys.argv[sys.argv.index('--')+2]).resolve();out.mkdir(parents=True,exist_ok=True)
for i in indices:
 file=files[i];bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 bpy.ops.import_scene.fbx(filepath=str(file));bpy.context.scene.frame_set(0)
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
 corners=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
 lo=Vector([min(c[k] for c in corners) for k in range(3)]);hi=Vector([max(c[k] for c in corners) for k in range(3)])
 mid=(lo+hi)/2;size=hi-lo
 camera_data=bpy.data.cameras.new('Camera');camera=bpy.data.objects.new('Camera',camera_data);bpy.context.collection.objects.link(camera)
 camera.location=mid+Vector((size.x*1.2+size.y*.5,-max(size.x,size.y)*2.2,size.z*.4))
 camera.rotation_euler=(mid-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.type='ORTHO';camera_data.ortho_scale=max(size.z*1.25,size.x*2,size.y*2,.1);bpy.context.scene.camera=camera
 light_data=bpy.data.lights.new('Area','AREA');light_data.energy=900;light_data.shape='DISK';light_data.size=4
 light=bpy.data.objects.new('Area',light_data);bpy.context.collection.objects.link(light);light.location=mid+Vector((2,-3,4));light.rotation_euler=(mid-light.location).to_track_quat('-Z','Y').to_euler()
 bpy.context.scene.world.color=(.65,.65,.65)
 bpy.context.scene.render.engine='BLENDER_EEVEE';bpy.context.scene.render.resolution_x=360;bpy.context.scene.render.resolution_y=500;bpy.context.scene.render.resolution_percentage=100
 bpy.context.scene.render.image_settings.file_format='PNG';bpy.context.scene.render.filepath=str(out/f'{i:02d}_color.png');bpy.ops.render.render(write_still=True)
 print('COLOR',i,file.name,flush=True)
