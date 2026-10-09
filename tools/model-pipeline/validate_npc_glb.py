"""Inspect a final NPC GLB in Blender and render Idle, Walk, Run.

blender -b --python validate_npc_glb.py -- model.glb report.json render_dir

Numeric checks do not replace visual inspection of the three PNGs. A final
character may be approved only after those images have been reviewed.
"""
import bpy
import json
import math
import pathlib
import struct
import sys

from mathutils import Vector


CLIPS = ("Idle", "Walk", "Run")


def evaluated_bounds(meshes):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    coordinates = []
    for obj in meshes:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            coordinates.extend(obj.matrix_world @ vertex.co for vertex in mesh.vertices)
        finally:
            evaluated.to_mesh_clear()
    if not coordinates:
        return None
    return [[min(v[axis] for v in coordinates), max(v[axis] for v in coordinates)]
            for axis in range(3)]


def activate_clip(name, armature):
    """Enable only NLA strips belonging to one imported glTF animation."""
    tracks = [(obj, track) for obj in bpy.context.scene.objects
              if obj.animation_data for track in obj.animation_data.nla_tracks]
    matching = [(obj, track) for obj, track in tracks if track.name.casefold() == name.casefold()]
    if not matching:
        # Some Blender import versions name tracks after the action or strip.
        matching = [(obj, track) for obj, track in tracks
                    if any(strip.action and strip.action.name.casefold() == name.casefold()
                           for strip in track.strips)]
    if not matching:
        raise ValueError(f"Missing imported NLA animation {name}")
    for obj, track in tracks:
        track.mute = (obj, track) not in matching
    # glTF normally imports the action into NLA and leaves no active action.
    for obj in bpy.context.scene.objects:
        if obj.animation_data and obj.animation_data.action:
            obj.animation_data.action = None
    arm_tracks = [track for obj, track in matching if obj == armature]
    if not arm_tracks:
        raise ValueError(f"{name} does not animate the NPC armature")
    strips = [strip for track in arm_tracks for strip in track.strips]
    if not strips:
        raise ValueError(f"{name} has no armature animation strip")
    return min(strip.frame_start for strip in strips), max(strip.frame_end for strip in strips)


def render_pose(bounds, destination, skinned):
    # Imported extras such as preview floors must not occlude the deforming NPC.
    hidden = [(obj, obj.hide_render) for obj in bpy.context.scene.objects
              if obj.type == "MESH" and obj not in skinned]
    for obj, _ in hidden:
        obj.hide_render = True
    center = Vector([(low + high) / 2 for low, high in bounds])
    size = Vector([high - low for low, high in bounds])
    camera_data = bpy.data.cameras.new("Validation Camera")
    camera = bpy.data.objects.new("Validation Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    distance = max(size.z * 2, size.x * 3, size.y * 3, 2)
    camera.location = center + Vector((distance * 0.18, -distance, size.z * 0.08))
    camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = max(size.z * 1.25, size.x * 2, size.y * 2, 1)
    scene = bpy.context.scene
    scene.camera = camera
    scene.render.engine = "BLENDER_EEVEE"
    world = bpy.data.worlds.new("Validation World")
    world.use_nodes = True
    world.node_tree.nodes.get("Background").inputs["Color"].default_value = (.65, .65, .65, 1)
    world.node_tree.nodes.get("Background").inputs["Strength"].default_value = .8
    scene.world = world
    light_data = bpy.data.lights.new("Validation Light", "AREA")
    light = bpy.data.objects.new("Validation Light", light_data)
    bpy.context.collection.objects.link(light)
    light.location = center + Vector((size.z, -size.z, size.z * 1.6))
    light.rotation_euler = (center - light.location).to_track_quat("-Z", "Y").to_euler()
    light_data.energy = 1100
    light_data.shape = "DISK"
    light_data.size = max(size.z * 2, 2)
    scene.render.resolution_x = 420
    scene.render.resolution_y = 560
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(destination)
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(camera, do_unlink=True)
    bpy.data.cameras.remove(camera_data)
    bpy.data.objects.remove(light, do_unlink=True)
    bpy.data.lights.remove(light_data)
    bpy.data.worlds.remove(world)
    for obj, previous in hidden:
        obj.hide_render = previous


def glb_texture_inventory(source):
    with source.open("rb") as stream:
        header = stream.read(12)
        if len(header) != 12 or header[:4] != b"glTF":
            raise ValueError("Not a GLB file")
        chunk_length, chunk_type = struct.unpack("<I4s", stream.read(8))
        if chunk_type != b"JSON":
            raise ValueError("GLB has no leading JSON chunk")
        document = json.loads(stream.read(chunk_length))
    images = document.get("images", [])
    external = [image.get("uri") for image in images
                if "bufferView" not in image and not image.get("uri", "").startswith("data:")]
    return {"images": len(images), "embeddedImages": len(images) - len(external),
            "externalImageUris": external, "materials": len(document.get("materials", []))}


def main():
    args = sys.argv[sys.argv.index("--") + 1:]
    if len(args) != 3:
        raise SystemExit("Expected model.glb report.json render_dir")
    project_root = pathlib.Path(__file__).resolve().parents[2]
    def project_path(value):
        path = pathlib.Path(value)
        return path if path.is_absolute() else project_root / path
    source, report_path, render_dir = map(project_path, args)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    render_dir.mkdir(parents=True, exist_ok=True)
    report = {"file": str(source), "status": "FAIL", "errors": [],
              "renders": {}, "clips": {}, "visualReview": "PENDING"}
    try:
        report["textures"] = glb_texture_inventory(source)
        if report["textures"]["externalImageUris"]:
            raise ValueError("GLB references external texture files")
        bpy.ops.object.select_all(action="SELECT")
        bpy.ops.object.delete(use_global=False)
        bpy.ops.import_scene.gltf(filepath=str(source))
        arms = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
        meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
        report["armatures"] = len(arms)
        report["meshes"] = len(meshes)
        if len(arms) != 1 or not meshes:
            raise ValueError("Expected one armature and at least one mesh")
        arm = arms[0]
        skinned = [obj for obj in meshes if any(mod.type == "ARMATURE" and mod.object == arm
                                               for mod in obj.modifiers)]
        report["skinnedMeshes"] = len(skinned)
        if not skinned:
            raise ValueError("No mesh is skinned to the armature")
        hips = next((bone for bone in arm.pose.bones if bone.name.casefold() in
                     ("hips", "pelvis", "mixamorig:hips")), None)
        if not hips:
            raise ValueError("No Hips/Pelvis bone for in-place measurement")
        report["bones"] = len(arm.data.bones)
        report["vertices"] = sum(len(obj.data.vertices) for obj in skinned)
        report["boneNames"] = sorted(bone.name for bone in arm.data.bones)
        for clip in CLIPS:
            try:
                first, last = activate_clip(clip, arm)
                if last <= first:
                    raise ValueError("zero-length animation")
                frames = [first + (last - first) * fraction for fraction in (0, .25, .5, .75, 1)]
                samples = []
                for frame in frames:
                    bpy.context.scene.frame_set(int(round(frame)))
                    bpy.context.view_layer.update()
                    bounds = evaluated_bounds(skinned)
                    if not bounds or not all(math.isfinite(value) for pair in bounds for value in pair):
                        raise ValueError("empty or non-finite deformed geometry")
                    hip_pos = arm.matrix_world @ hips.matrix.translation
                    samples.append({"frame": round(frame, 3), "bounds": bounds,
                                    "hips": [round(value, 6) for value in hip_pos]})
                heights = [sample["bounds"][2][1] - sample["bounds"][2][0] for sample in samples]
                widths = [sample["bounds"][0][1] - sample["bounds"][0][0] for sample in samples]
                depths = [sample["bounds"][1][1] - sample["bounds"][1][0] for sample in samples]
                if min(heights) < 0.5 or max(heights) / min(heights) > 1.65:
                    raise ValueError("height collapses or stretches during animation")
                if min(widths) > 0 and max(widths) / min(widths) > 2.5:
                    raise ValueError("width stretches excessively during animation")
                if min(depths) > 0 and max(depths) / min(depths) > 2.5:
                    raise ValueError("depth stretches excessively during animation")
                origin = samples[0]["hips"]
                drift = max(math.hypot(sample["hips"][0] - origin[0],
                                       sample["hips"][1] - origin[1]) for sample in samples)
                limit = max(.05, max(heights) * .03)
                if drift > limit:
                    raise ValueError(f"Hips horizontal drift {drift:.4f} m exceeds {limit:.4f} m")
                midpoint = samples[2]
                bpy.context.scene.frame_set(int(round(midpoint["frame"])))
                bpy.context.view_layer.update()
                render_file = render_dir / f"{clip.lower()}.png"
                render_pose(midpoint["bounds"], render_file, skinned)
                report["renders"][clip] = str(render_file)
                report["clips"][clip] = {"status": "MEASURED", "frames": [first, last],
                                         "hipsHorizontalDriftM": round(drift, 6),
                                         "samples": samples}
            except Exception as error:
                report["errors"].append(f"{clip}: {error}")
                report["clips"][clip] = {"status": "FAIL", "reason": str(error)}
        if not report["errors"]:
            report["status"] = "REVIEW_REQUIRED"
    except Exception as error:
        report["errors"].append(str(error))
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"report": str(report_path), "status": report["status"],
                      "errors": report["errors"]}, ensure_ascii=False), flush=True)
    if report["errors"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
