"""Inspect one user supplied Mixamo FBX without converting or publishing it."""
import bpy
import hashlib
import json
import pathlib
import sys


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode('utf-8')).hexdigest()


def inspect(source):
    source=pathlib.Path(source)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.fbx(filepath=str(source), automatic_bone_orientation=False)
    objects=list(bpy.context.scene.objects)
    arms=[obj for obj in objects if obj.type=='ARMATURE']
    meshes=[obj for obj in objects if obj.type=='MESH']
    result={'name':source.name,'bytes':source.stat().st_size,
            'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
            'armatures':len(arms),'meshes':len(meshes),'skinnedMeshes':0,
            'vertices':sum(len(obj.data.vertices) for obj in meshes),
            'actions':[],'errors':[], 'fps': bpy.context.scene.render.fps,
            'fpsBase': bpy.context.scene.render.fps_base,
            'meshDetails': []}
    if len(arms)!=1:result['errors'].append(f'expected 1 armature, got {len(arms)}')
    if arms:
        arm=arms[0]
        bones=sorted(arm.data.bones,key=lambda bone:bone.name)
        names=[bone.name for bone in bones]
        hierarchy=[(bone.name,bone.parent.name if bone.parent else None) for bone in bones]
        rest=[(bone.name,[round(v,5) for row in bone.matrix_local for v in row]) for bone in bones]
        result.update(bones=len(bones),boneNames=names,boneNamesHash=digest(names),
                      hierarchyHash=digest(hierarchy),restHash=digest(rest),
                      armatureName=arm.name,
                      boneParents=hierarchy,
                      rootBones=[bone.name for bone in bones if not bone.parent],
                      hips=[bone.name for bone in bones if bone.name.split(':')[-1].lower()=='hips'],
                      armatureTransform={'location':list(arm.location),'scale':list(arm.scale),
                                         'rotationEuler':list(arm.rotation_euler)})
        result['skinnedMeshes']=sum(any(mod.type=='ARMATURE' and mod.object==arm for mod in mesh.modifiers) for mesh in meshes)
        result['weightedVertices']=sum(sum(bool(vertex.groups) for vertex in mesh.data.vertices) for mesh in meshes)
        action=arm.animation_data.action if arm.animation_data else None
        if action:
            result['actions'].append({'name':action.name,'frameRange':list(action.frame_range),
                                      'slots':len(action.slots) if hasattr(action,'slots') else None})
            result['durationSeconds']=(action.frame_range[1]-action.frame_range[0]) / max(1,bpy.context.scene.render.fps)
        for track in arm.animation_data.nla_tracks if arm.animation_data else []:
            for strip in track.strips:
                result['actions'].append({'name':strip.action.name,'track':track.name,'frameRange':list(strip.action.frame_range)})
        for obj in meshes:
            result['meshDetails'].append({'name':obj.name,'vertices':len(obj.data.vertices),
                                          'vertexGroups':len(obj.vertex_groups),
                                          'armatureModifiers':[mod.object.name if mod.object else None
                                                               for mod in obj.modifiers if mod.type=='ARMATURE']})
    return result


def main():
    source, destination = map(pathlib.Path, sys.argv[sys.argv.index('--') + 1:])
    result=inspect(source)
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps({'name':result['name'],'meshes':result['meshes'],
                      'skinnedMeshes':result['skinnedMeshes'],'actions':result['actions'],
                      'boneNamesHash':result.get('boneNamesHash'),'restHash':result.get('restHash'),
                      'errors':result['errors']}))


if __name__=='__main__':main()
