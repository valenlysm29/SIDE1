"""Compare animation-only FBX to skinned rigs and sample unedited motion."""
import bpy
import json
import math
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parents[2]
folder = root / 'assets/models/incoming/mixamo'
reports = root / 'reports/mixamo_inventory'
meta = {row['name']: row for path in reports.glob('*.json')
        for row in [json.loads(path.read_text(encoding='utf-8'))]}

def import_arm(name):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.actions, bpy.data.meshes, bpy.data.armatures, bpy.data.materials, bpy.data.images):
        for item in list(datablocks):
            if item.users == 0:
                datablocks.remove(item)
    bpy.ops.import_scene.fbx(filepath=str(folder/name), automatic_bone_orientation=False)
    arms = [obj for obj in bpy.context.scene.objects if obj.type == 'ARMATURE']
    if len(arms) != 1:
        raise RuntimeError(f'{name}: {len(arms)} armatures')
    return arms[0]

def canonical(name):
    return name.split(':')[-1]

def motion(arm):
    action = arm.animation_data.action if arm.animation_data else None
    if action is None:
        return None
    hips = next((bone for bone in arm.pose.bones if bone.name.split(':')[-1] == 'Hips'), None)
    left = next((bone for bone in arm.pose.bones if bone.name.split(':')[-1] == 'LeftFoot'), None)
    right = next((bone for bone in arm.pose.bones if bone.name.split(':')[-1] == 'RightFoot'), None)
    first,last = map(int, action.frame_range)
    samples = []
    for frame in sorted(set(round(first + (last-first)*i/8) for i in range(9))):
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        def pos(bone):
            if not bone:return None
            v = arm.matrix_world @ bone.head
            return [round(float(c), 5) for c in v]
        samples.append({'frame':frame, 'hips':pos(hips), 'leftFoot':pos(left), 'rightFoot':pos(right)})
    points = [sample['hips'] for sample in samples if sample['hips']]
    horizontal = math.dist(points[0][:2], points[-1][:2]) if len(points)>1 else None
    horizontal_range = [max(p[i] for p in points)-min(p[i] for p in points) for i in (0,1)] if points else None
    return {'name':action.name, 'frameRange':[first,last], 'fps':bpy.context.scene.render.fps,
            'durationSeconds':(last-first)/max(1,bpy.context.scene.render.fps),
            'horizontalDeltaMeters':horizontal, 'horizontalRangeMeters':horizontal_range,
            'samples':samples}

results=[]
for clip_name, data in sorted(meta.items()):
    if data['meshes'] != 0:
        continue
    clip_arm = import_arm(clip_name)
    clip_motion = motion(clip_arm)
    clip_rest = {canonical(bone.name): bone.matrix_local.copy() for bone in clip_arm.data.bones}
    clip_hierarchy = {canonical(bone.name): canonical(bone.parent.name) if bone.parent else None for bone in clip_arm.data.bones}
    clip_transform = clip_arm.matrix_world.copy()
    matches=[]
    for name, candidate in sorted(meta.items()):
        if not candidate['skinnedMeshes'] or candidate.get('boneNamesHash') != data.get('boneNamesHash'):
            continue
        if candidate.get('hierarchyHash') != data.get('hierarchyHash'):
            continue
        base = import_arm(name)
        bones = {canonical(bone.name): bone for bone in base.data.bones}
        if set(bones) != set(clip_rest):
            matches.append({'character':name, 'status':'INCOMPATIBLE', 'reason':'bone names differ after namespace normalization'})
            continue
        max_rest = max(abs(bones[n].matrix_local[i][j]-matrix[i][j])
                       for n,matrix in clip_rest.items() for i in range(4) for j in range(4))
        hips_name = 'Hips' if 'Hips' in clip_rest else None
        hips_delta = math.dist(tuple(bones[hips_name].head_local),
                               tuple(clip_rest[hips_name].translation)) if hips_name else None
        matrix_delta = max(abs(base.matrix_world[i][j]-clip_transform[i][j])
                           for i in range(4) for j in range(4))
        matches.append({'character':name,'boneCount':len(bones),
                        'namesAndParents':'MATCH' if all(clip_hierarchy.get(n)==(canonical(b.parent.name) if b.parent else None) for n,b in bones.items()) else 'MISMATCH',
                        'maxRestMatrixDelta':round(float(max_rest),6),
                        'hipsRestDelta':round(float(hips_delta),6) if hips_delta is not None else None,
                        'armatureWorldMatrixDelta':round(float(matrix_delta),6),
                        'status':'EXACT MATCH' if max_rest<1e-5 and matrix_delta<1e-5 else
                                 'COMPATIBLE' if max_rest<=.002 and matrix_delta<=.002 else 'INCOMPATIBLE'})
    results.append({'clipFile':clip_name, 'rigFingerprint':{'boneNames':data.get('boneNamesHash'),
                    'hierarchy':data.get('hierarchyHash'),'rest':data.get('restHash')},
                    'motion':clip_motion,'matches':matches})
    print('CLIP',clip_name,'horizontal',clip_motion['horizontalDeltaMeters'] if clip_motion else None,
          'matches',[(m['character'],m['status'],m['maxRestMatrixDelta']) for m in matches],flush=True)

out = root / 'reports/mixamo_clip_compatibility.json'
out.write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
