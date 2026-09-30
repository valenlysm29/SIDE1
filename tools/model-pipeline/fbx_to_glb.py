"""Blender background helper; called by build_city_npcs.cjs."""
import bpy
import sys

source, target = sys.argv[sys.argv.index("--") + 1:]
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.fbx(filepath=source)
bpy.ops.export_scene.gltf(filepath=target, export_format="GLB", export_animations=True, export_skins=True)
