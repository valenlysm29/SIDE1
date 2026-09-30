"""Pure validation checks for the Blender Mixamo rig guard."""
import importlib.util
import pathlib
import sys
import types
import unittest

sys.modules["bpy"] = types.SimpleNamespace()
spec = importlib.util.spec_from_file_location("mixamo", pathlib.Path(__file__).with_name("mixamo_fbx_to_glb.py"))
mixamo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mixamo)


def armature(names=("Hips", "Spine"), offset=0, parent="Hips"):
    identity = [[1.0 if row == col else 0.0 for col in range(4)] for row in range(4)]
    bones = []
    for name in names:
        matrix = [line[:] for line in identity]
        if name == "Spine":
            matrix[0][3] = offset
        bones.append(types.SimpleNamespace(name=name, matrix_local=matrix,
                                           parent=types.SimpleNamespace(name=parent) if name == "Spine" else None))
    return types.SimpleNamespace(data=types.SimpleNamespace(bones=bones))


class MixamoRigGuardTests(unittest.TestCase):
    def test_identical_rest_rig_passes(self):
        mixamo.compatible(armature(), armature(), "walk.fbx")

    def test_different_bone_set_fails(self):
        with self.assertRaisesRegex(RuntimeError, "bone names differ"):
            mixamo.compatible(armature(), armature(("Hips", "Neck")), "walk.fbx")

    def test_different_hierarchy_fails(self):
        with self.assertRaisesRegex(RuntimeError, "parent differs"):
            mixamo.compatible(armature(), armature(parent="Neck"), "walk.fbx")

    def test_different_rest_pose_fails(self):
        with self.assertRaisesRegex(RuntimeError, "rest pose differs"):
            mixamo.compatible(armature(), armature(offset=.02), "walk.fbx")


if __name__ == "__main__":
    unittest.main()
