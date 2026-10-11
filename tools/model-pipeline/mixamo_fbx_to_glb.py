"""Join one skinned Mixamo FBX with animation-only FBX files in Blender.

The script intentionally refuses different rest skeletons. All clips must be
exports of the same Mixamo rig; no unverified cross-rig retargeting occurs.
"""
import bpy
import json
import math
import os
import struct
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
    object_delta = max(abs(base.matrix_world[row][col] - animated.matrix_world[row][col])
                       for row in range(4) for col in range(4))
    if object_delta > 0.002:
        fail(f"{filename}: armature object transform differs ({object_delta:.5f})")
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


def hips_motion(armature, action, filename):
    """Reject root travel while allowing a normal in-place gait's small sway."""
    hips = next((bone for bone in armature.pose.bones
                 if bone.name.split(":")[-1].lower() == "hips"), None)
    if hips is None:
        fail(f"{filename}: Hips bone missing")
    start, end = [int(round(value)) for value in action.frame_range]
    if end <= start:
        fail(f"{filename}: action has no duration")
    scene = bpy.context.scene
    previous_frame = scene.frame_current
    points = []
    try:
        for frame in range(start, end + 1):
            scene.frame_set(frame)
            evaluated = armature.evaluated_get(bpy.context.evaluated_depsgraph_get())
            bone = evaluated.pose.bones[hips.name]
            point = evaluated.matrix_world @ bone.matrix.translation
            points.append((point.x, point.y))
    finally:
        scene.frame_set(previous_frame)
    net = math.dist(points[0], points[-1])
    if net > 0.05:
        fail(f"{filename}: Hips travels {net:.4f} m horizontally (limit 0.05 m)")
    return {"hip_horizontal_net_m": round(net, 5), "frames": len(points)}


def glb_summary(path):
    with open(path, "rb") as stream:
        header = stream.read(20)
        if len(header) != 20:
            fail(f"{path}: incomplete GLB header")
        magic, version, total_length, chunk_length, chunk_type = struct.unpack("<4sIIII", header)
        if magic != b"glTF" or version != 2 or chunk_type != 0x4E4F534A:
            fail(f"{path}: invalid GLB header")
        document = json.loads(stream.read(chunk_length).decode("utf-8"))
        if os.path.getsize(path) != total_length:
            fail(f"{path}: incorrect GLB length")
    names = [clip.get("name") for clip in document.get("animations", [])]
    if sorted(names) != ["Idle", "Run", "Walk"]:
        fail(f"{path}: expected exactly Idle, Walk, Run; got {names}")
    if not document.get("skins") or not document.get("meshes"):
        fail(f"{path}: missing skin or mesh")
    if any(image.get("uri") for image in document.get("images", [])):
        fail(f"{path}: external image URI in GLB")
    return {"animations": names, "skins": len(document["skins"]),
            "meshes": len(document["meshes"]), "bytes": total_length}


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
    for track in list(base.animation_data.nla_tracks):
        base.animation_data.nla_tracks.remove(track)
    measurements = {}
    for clip_name in ("idle", "walk", "run"):
        filename = animations[clip_name]
        if not os.path.isfile(filename):
            fail(f"{filename}: animation file missing")
        animated, imported = imported_fbx(filename)
        compatible(base, animated, filename)
        action = action_for(animated, filename)
        measurements[clip_name] = hips_motion(animated, action, filename)
        action.name = clip_name.capitalize()
        action.use_fake_user = True
        track = base.animation_data.nla_tracks.new()
        track.name = clip_name.capitalize()
        track.strips.new(clip_name.capitalize(), int(action.frame_range[0]), action)
        for obj in imported:
            bpy.data.objects.remove(obj, do_unlink=True)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in base_objects:
        if obj.name in bpy.data.objects:
            obj.select_set(True)
    bpy.context.view_layer.objects.active = base
    temporary_target = target + ".tmp.glb"
    export_args = dict(filepath=temporary_target, export_format="GLB", use_selection=True,
                       export_animations=True, export_skins=True)
    properties = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    if "export_animation_mode" in properties:
        export_args["export_animation_mode"] = "NLA_TRACKS"
    elif "export_nla_strips" in properties:
        export_args["export_nla_strips"] = True
    else:
        fail("Blender glTF exporter cannot export NLA tracks on this version")
    try:
        bpy.ops.export_scene.gltf(**export_args)
        summary = glb_summary(temporary_target)
        os.replace(temporary_target, target)
    finally:
        if os.path.exists(temporary_target):
            os.remove(temporary_target)
    print("NPC_CONVERSION_PASS " + json.dumps({"source": source, "target": target,
                                               "clips": measurements, "glb": summary}, sort_keys=True))


if __name__ == "__main__":
    main()
