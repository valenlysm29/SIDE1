"""Join one skinned Mixamo FBX with animation-only FBX files in Blender.

The script intentionally refuses different rest skeletons. All clips must be
exports of the same Mixamo rig; no unverified cross-rig retargeting occurs.
"""
import bpy
import json
import sys


def fail(message):
    raise RuntimeError(message)


def imported_fbx(filename):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=filename, automatic_bone_orientation=False)
    objects = set(bpy.data.objects) - before
    arms = [obj for obj in objects if obj.type == "ARMATURE"]
    if len(arms) != 1:
        fail(f"{filename}: expected exactly one armature, got {len(arms)}")
    return arms[0], objects


def compatible(base, animated, filename):
    original = {bone.name: bone for bone in base.data.bones}
    candidate = {bone.name: bone for bone in animated.data.bones}
    if original.keys() != candidate.keys():
        missing = sorted(original.keys() - candidate.keys())
        extra = sorted(candidate.keys() - original.keys())
        fail(f"{filename}: bone names differ; missing={missing}, extra={extra}")
    for name, bone in original.items():
        other = candidate[name]
        if (bone.parent.name if bone.parent else None) != (other.parent.name if other.parent else None):
            fail(f"{filename}: parent differs for {name}")
        # Mixamo exports of one rig should share their bind/rest matrices.
        delta = max(abs(bone.matrix_local[row][col] - other.matrix_local[row][col])
                    for row in range(4) for col in range(4))
        if delta > 0.002:
            fail(f"{filename}: rest pose differs for {name} ({delta:.5f})")


def action_for(armature, filename):
    data = armature.animation_data
    if not data or not data.action:
        fail(f"{filename}: no armature action found")
    return data.action


def main():
    args = sys.argv[sys.argv.index("--") + 1:]
    if len(args) != 3:
        fail("expected: skinned.fbx result.glb animations-json")
    source, target, animation_json = args
    animations = json.loads(animation_json)
    if not isinstance(animations, dict) or not all(name in animations for name in ("idle", "walk", "run")):
        fail("Mixamo requires idle, walk and run animation FBX paths")

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    base, base_objects = imported_fbx(source)
    if not any(obj.type == "MESH" and obj.parent == base for obj in base_objects):
        fail(f"{source}: expected skinned meshes parented to the armature")
    if not any(obj.type == "MESH" and any(mod.type == "ARMATURE" and mod.object == base for mod in obj.modifiers)
               for obj in base_objects):
        fail(f"{source}: no mesh has an armature modifier")

    base.animation_data_create()
    if base.animation_data.action:
        base.animation_data.action = None
    for clip_name, filename in animations.items():
        animated, imported = imported_fbx(filename)
        compatible(base, animated, filename)
        action = action_for(animated, filename)
        action.name = str(clip_name)
        action.use_fake_user = True
        track = base.animation_data.nla_tracks.new()
        track.name = str(clip_name)
        track.strips.new(str(clip_name), int(action.frame_range[0]), action)
        for obj in imported:
            bpy.data.objects.remove(obj, do_unlink=True)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in base_objects:
        if obj.name in bpy.data.objects:
            obj.select_set(True)
    bpy.context.view_layer.objects.active = base
    export_args = dict(filepath=target, export_format="GLB", use_selection=True,
                       export_animations=True, export_skins=True)
    properties = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    if "export_animation_mode" in properties:
        export_args["export_animation_mode"] = "NLA_TRACKS"
    elif "export_nla_strips" in properties:
        export_args["export_nla_strips"] = True
    else:
        fail("Blender glTF exporter cannot export NLA tracks on this version")
    bpy.ops.export_scene.gltf(**export_args)


if __name__ == "__main__":
    main()
