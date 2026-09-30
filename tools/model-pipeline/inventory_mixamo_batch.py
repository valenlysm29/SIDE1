"""Run isolated armature inspection for every local Mixamo FBX in one Blender session."""
import bpy
import json
import pathlib
import sys
import hashlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from inventory_mixamo_fbx import inspect

folder, output = map(pathlib.Path, sys.argv[sys.argv.index('--') + 1:])
output.mkdir(parents=True, exist_ok=True)
for source in sorted(folder.glob('*.fbx')):
    destination = output / f'{source.stem}.json'
    if destination.exists():
        try:
            previous = json.loads(destination.read_text(encoding='utf-8'))
            current_sha = hashlib.sha256(source.read_bytes()).hexdigest()
            if previous.get('sha256') == current_sha and not previous.get('errors') and previous.get('bones'):
                print('NPC_INVENTORY_REUSED', source.name, flush=True)
                continue
        except (OSError, ValueError):
            pass
    result=inspect(source)
    destination.write_text(json.dumps(result,indent=2),encoding='utf-8')
    print('NPC_INVENTORY',source.name,result.get('restHash'),result.get('skinnedMeshes'),flush=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.actions,bpy.data.meshes,bpy.data.armatures,bpy.data.materials,bpy.data.images):
        for datablock in list(collection):
            if datablock.users==0:collection.remove(datablock)
