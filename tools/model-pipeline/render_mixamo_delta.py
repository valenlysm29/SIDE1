"""Render only changed Mixamo skinned FBXs for visual curation."""
import bpy
import hashlib
import json
import pathlib
import sys
from mathutils import Vector

root = pathlib.Path(__file__).resolve().parents[2]
folder = root / 'assets/models/incoming/mixamo'
prior = {row['file']: row for row in json.loads((root / 'reports/mixamo_current_inventory.json').read_text(encoding='utf-8'))['files']}
out = root / 'tests/output/mixamo_delta'
out.mkdir(parents=True, exist_ok=True)
for source in sorted(folder.glob('*.fbx')):
    sha = hashlib.sha256(source.read_bytes()).hexdigest()
    if source.name in prior and prior[source.name]['sha256'] == sha:
        continue
    target = out / (source.stem + '.png')
    if target.exists():
        continue
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.fbx(filepath=str(source), automatic_bone_orientation=False)
    bpy.context.scene.frame_set(0)
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    corners = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    if not corners:
        print('NO_MESH', source.name, flush=True)
        continue
    lo = Vector([min(corner[i] for corner in corners) for i in range(3)])
    hi = Vector([max(corner[i] for corner in corners) for i in range(3)])
    center, size = (lo + hi) / 2, hi - lo
    data = bpy.data.cameras.new('Review Camera')
    camera = bpy.data.objects.new('Review Camera', data)
    bpy.context.collection.objects.link(camera)
    camera.location = center + Vector((size.x * 1.2 + size.y * .5, -max(size.x,size.y) * 2.2, size.z * .4))
    camera.rotation_euler = (center - camera.location).to_track_quat('-Z','Y').to_euler()
    data.type = 'ORTHO'
    data.ortho_scale = max(size.z * 1.25, size.x * 2, size.y * 2, .1)
    bpy.context.scene.camera = camera
    light_data = bpy.data.lights.new('Review Light','AREA')
    light_data.energy, light_data.size = 900, 4
    light = bpy.data.objects.new('Review Light',light_data)
    bpy.context.collection.objects.link(light)
    light.location = center + Vector((2,-3,4))
    light.rotation_euler = (center-light.location).to_track_quat('-Z','Y').to_euler()
    bpy.context.scene.render.engine = 'BLENDER_EEVEE'
    bpy.context.scene.render.resolution_x = 360
    bpy.context.scene.render.resolution_y = 500
    bpy.context.scene.render.resolution_percentage = 100
    bpy.context.scene.render.image_settings.file_format = 'PNG'
    bpy.context.scene.render.filepath = str(target)
    bpy.ops.render.render(write_still=True)
    print('RENDER', source.name, flush=True)
