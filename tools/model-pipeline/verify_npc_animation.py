"""Blender headless: validate one converted NPC's rig and sampled deformation.

Usage: blender -b --python verify_npc_animation.py -- character.glb report.json
This tool reports measurements, not a substitute for visual review.
"""
import bpy
import hashlib
import json
import math
import pathlib
import sys


def bounds(objects, depsgraph):
    points = []
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            points.extend(tuple(obj.matrix_world @ vertex.co) for vertex in mesh.vertices)
        finally:
            evaluated.to_mesh_clear()
    if not points:
        return None
    return [[min(point[axis] for point in points), max(point[axis] for point in points)] for axis in range(3)]


def main():
    args = sys.argv[sys.argv.index('--') + 1:]
    if len(args) != 2:
        raise SystemExit('Expected character.glb report.json')
    source, destination = map(pathlib.Path, args)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(source))
    arms = [obj for obj in bpy.context.scene.objects if obj.type == 'ARMATURE']
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    report = {'file': str(source), 'armatures': len(arms), 'skinnedMeshes': 0,
              'clips': [], 'errors': [], 'warnings': [], 'restHash': None}
    if len(arms) != 1:
        report['errors'].append('Expected exactly one armature')
    if not meshes:
        report['errors'].append('No mesh')
    if arms:
        arm = arms[0]
        rest = [(bone.name, bone.parent.name if bone.parent else None,
                 [round(value, 6) for row in bone.matrix_local for value in row])
                for bone in sorted(arm.data.bones, key=lambda item: item.name)]
        report['restHash'] = hashlib.sha256(json.dumps(rest).encode()).hexdigest()
        report['bones'] = len(rest)
        skinned = [mesh for mesh in meshes if any(mod.type == 'ARMATURE' and mod.object == arm for mod in mesh.modifiers)]
        report['skinnedMeshes'] = len(skinned)
        if not skinned:
            report['errors'].append('No skinned mesh connected to armature')
        unweighted = 0
        for obj in skinned:
            for vertex in obj.data.vertices:
                weight = sum(group.weight for group in vertex.groups)
                if weight < 0.01:
                    unweighted += 1
        report['unweightedVertices'] = unweighted
        if unweighted:
            report['errors'].append(f'{unweighted} vertices have no bone weight')
        foot_bones = [bone for bone in arm.pose.bones if 'foot' in bone.name.lower() or 'ankle' in bone.name.lower()]
        report['footBones'] = [bone.name for bone in foot_bones]
        actions = list(bpy.data.actions)
        report['availableActions'] = [action.name for action in actions]
        for state in ('idle', 'walk', 'run'):
            candidates = [action for action in actions if action.name.lower() == state or action.name.lower().startswith(state + '_')]
            if not candidates:
                report['errors'].append(f'Missing {state} clip')
                continue
            action = candidates[0]
            arm.animation_data_create()
            arm.animation_data.action = action
            first, last = action.frame_range
            samples = []
            for frame in (first, (first + last) / 2, last):
                bpy.context.scene.frame_set(int(round(frame)))
                bpy.context.view_layer.update()
                depsgraph = bpy.context.evaluated_depsgraph_get()
                sampled = bounds(skinned, depsgraph)
                feet = {bone.name: list(arm.matrix_world @ bone.tail) for bone in foot_bones}
                samples.append({'frame': frame, 'bounds': sampled, 'feet': feet})
                if sampled and (not all(math.isfinite(value) for pair in sampled for value in pair)
                                or sampled[1][1] - sampled[1][0] < 0.5):
                    report['errors'].append(f'{state}: degenerate or non-finite sampled bounds')
            report['clips'].append({'state': state, 'action': action.name, 'samples': samples})
        if not foot_bones:
            report['warnings'].append('Foot contact cannot be measured: no named foot or ankle bone')
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({'report': str(destination), 'errors': report['errors']}))
    if report['errors']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
