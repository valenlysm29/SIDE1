"""Normalize, generate, and validate the licensed SIDE warehouse prop batch.

The 16 external inputs come from
``.codex-work/asset-staging/warehouse-selected-source``. A seventeenth asset,
the sewing machine, is generated procedurally to avoid a large textured source.

All output GLBs use meters, Y-up, an origin centered in X/Z at the base Y=0,
embedded data, low-poly PBR materials, and deterministic snake_case names.

Run from the SIDE1 repository root:
    python tools/prepare_warehouse_props.py
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import trimesh
from trimesh.transformations import rotation_matrix, translation_matrix
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = REPOSITORY_ROOT / ".codex-work" / "asset-staging" / "warehouse-selected-source"
DEFAULT_OUTPUT = REPOSITORY_ROOT / "assets" / "models3d" / "props"
DEFAULT_REPORT = REPOSITORY_ROOT / "docs" / "warehouse-props-validation.json"
BUDGET_MIN_BYTES = 200 * 1024
BUDGET_MAX_BYTES = 300 * 1024


@dataclass(frozen=True)
class PropSpec:
    source: str | None
    output: str
    target_size_m: float
    license_id: str
    expected_sha256: str | None = None
    scale_reference: str = "height"
    depth_factor: float = 1.0


PROPS = (
    PropSpec("box-large.glb", "warehouse_box_large.glb", 0.55, "CC0-1.0", "f5c7a7b4d7ec48c2695dc5241d62a38dbb54b487e6be0f089548582c91bacdfd"),
    PropSpec("box-long.glb", "warehouse_box_long.glb", 0.45, "CC0-1.0", "6a6d7bfed3058809a9833606a6a3e78a156b6f3d898fba59fc054c62b5499c94"),
    PropSpec("box-small.glb", "warehouse_box_small.glb", 0.35, "CC0-1.0", "fd2ea1ac4f24a9515dc9c53a4a589a8897c824fa5865771799f965a252f684f0"),
    PropSpec("box-wide.glb", "warehouse_box_wide.glb", 0.45, "CC0-1.0", "41507d9e035b23e586cbf6bcc63427c810aefd428620264bebefc25c98922ff4"),
    PropSpec("door-wide-closed.glb", "warehouse_loading_door.glb", 2.80, "CC0-1.0", "987837d7b45bca466c5f2268fa0193e014374cc0d2ef0784f6c37092856b71d0"),
    PropSpec("structure-window-wide.glb", "warehouse_high_window.glb", 3.00, "CC0-1.0", "447f0e5a4eca379a02c3ade829e04b4df2fc517ab23f0b4f99fd31ae439ac19e"),
    PropSpec("indicator-special-arrow.glb", "warehouse_floor_arrow.glb", 0.90, "CC0-1.0", "3cd514de3e283705df2baccf7cea62a70ba64e87311252fe26788be4377c0d49", "footprint"),
    PropSpec("warning-traffic.glb", "warehouse_warning_beacon.glb", 1.10, "CC0-1.0", "b231e97424839b252e80555bc97d7360d2f04006cb3919675725a297bae049cd"),
    PropSpec("pallet_quaternius.glb", "warehouse_pallet.glb", 0.15, "CC0-1.0", "5f4d74d00ad2a8eb5dbd887d645a794b7e8cecc280335215a274844fee75d383"),
    PropSpec("shelf-tall_quaternius.glb", "warehouse_rack_tall.glb", 2.40, "CC0-1.0", "e57a99b889abb509aee0773adac4a3d6cbddca742f0f7fad614a06408200bb29"),
    PropSpec("bags_quaternius.glb", "warehouse_bag_stack.glb", 0.45, "CC0-1.0", "ad5ebf8f6c7082662cbefd93e960dc33a9a70239d36b23d0ec0c7fdcc8588c95"),
    PropSpec("workbench_kenney.glb", "warehouse_cutting_table.glb", 0.90, "CC0-1.0", "a88889ea0d1c27567c845eabc9a0a49f96bea5db1f9f3b1f9a78f92e0e15f12d"),
    PropSpec("light-ceiling_quaternius.glb", "warehouse_pendant_light.glb", 0.55, "CC0-1.0", "6beb5d0886af85f41bb375176879b97f4b1032e2049fe3cabec319b105c0fb38"),
    PropSpec("pallet-truck_kolosstudios.glb", "warehouse_pallet_truck.glb", 1.20, "CC-BY-3.0", "76437ca71a6f8d2114d66d1aa68f32729d5823db5bfef2717598c0c351cf50c6"),
    PropSpec("rolls-of-towels_poly-by-google.glb", "warehouse_fabric_rolls.glb", 0.85, "CC-BY-3.0", "5d671edc7b11c926f62aabbbd733a500dcc0a3ff0a5027b5fc9ccd333ad278e9"),
    PropSpec("fire-extinguisher_dook.glb", "warehouse_fire_extinguisher.glb", 0.62, "CC-BY-3.0", "cbb7178b9e00d0213fc5d7877ee92d6dd6b5908bbfbbb916390a170a4b7bd58f"),
    PropSpec(None, "warehouse_sewing_machine.glb", 0.52, "SIDE-original"),
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_name(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_]+", "_", value).strip("_") or "Mesh"


def world_meshes(scene: trimesh.Scene) -> list[tuple[str, trimesh.Trimesh]]:
    result: list[tuple[str, trimesh.Trimesh]] = []
    for index, node_name in enumerate(scene.graph.nodes_geometry):
        transform, geometry_name = scene.graph.get(node_name)
        mesh = scene.geometry[geometry_name].copy()
        mesh.apply_transform(transform)
        result.append((f"{index:02d}_{safe_name(str(geometry_name))}", mesh))
    if not result:
        raise ValueError("GLB does not contain mesh geometry")
    return result


def combined_bounds(meshes: list[tuple[str, trimesh.Trimesh]]) -> np.ndarray:
    bounds = np.stack([mesh.bounds for _, mesh in meshes])
    return np.array((bounds[:, 0, :].min(axis=0), bounds[:, 1, :].max(axis=0)))


def reference_size(extents: np.ndarray, scale_reference: str) -> float:
    if scale_reference == "height":
        return float(extents[1])
    if scale_reference == "footprint":
        return float(max(extents[0], extents[2]))
    raise ValueError(f"Unknown scale reference: {scale_reference}")


def normalize_scene(source_scene: trimesh.Scene, spec: PropSpec) -> tuple[trimesh.Scene, dict[str, object]]:
    meshes = world_meshes(source_scene)
    before = combined_bounds(meshes)
    extents = before[1] - before[0]
    size = reference_size(extents, spec.scale_reference)
    if size <= 1e-8:
        raise ValueError(f"{spec.output}: zero {spec.scale_reference}")

    uniform = spec.target_size_m / size
    scale = np.array((uniform, uniform, uniform * spec.depth_factor), dtype=float)
    center = np.array(
        (
            (before[0, 0] + before[1, 0]) / 2.0,
            before[0, 1],
            (before[0, 2] + before[1, 2]) / 2.0,
        )
    )

    output_scene = trimesh.Scene(base_frame="Root")
    triangle_count = 0
    for index, (name, mesh) in enumerate(meshes):
        mesh.apply_translation(-center)
        mesh.apply_scale(scale)
        mesh.remove_unreferenced_vertices()
        triangle_count += len(mesh.faces)
        output_scene.add_geometry(
            mesh,
            node_name=f"Prop_{index:02d}_{name}",
            geom_name=f"{safe_name(Path(spec.output).stem)}_{index:02d}",
            parent_node_name="Root",
        )

    return output_scene, {
        "source_bounds": before.tolist(),
        "scale_reference": spec.scale_reference,
        "scale_xyz": scale.tolist(),
        "triangles": triangle_count,
    }


def pbr(name: str, color: int, roughness: float, metallic: float = 0.0) -> PBRMaterial:
    rgba = [(color >> 16) & 255, (color >> 8) & 255, color & 255, 255]
    return PBRMaterial(
        name=name,
        baseColorFactor=rgba,
        roughnessFactor=roughness,
        metallicFactor=metallic,
    )


def procedural_sewing_machine() -> trimesh.Scene:
    """Create an original SIDE low-poly tabletop industrial sewing machine."""
    scene = trimesh.Scene(base_frame="Root")
    body = pbr("MachineIvory", 0xDDD8C9, 0.48, 0.12)
    dark = pbr("MachineDark", 0x26313A, 0.42, 0.24)
    steel = pbr("MachineSteel", 0x87929A, 0.30, 0.65)
    accent = pbr("MachineAccent", 0xD45A3A, 0.44, 0.08)

    parts: list[tuple[str, trimesh.Trimesh, tuple[float, float, float], np.ndarray | None]] = []

    def box(name: str, extents: tuple[float, float, float], position: tuple[float, float, float], material: PBRMaterial) -> None:
        mesh = trimesh.creation.box(extents=extents)
        mesh.visual = TextureVisuals(material=material)
        parts.append((name, mesh, position, None))

    def cylinder_y(name: str, radius: float, height: float, position: tuple[float, float, float], material: PBRMaterial, sections: int = 12) -> None:
        mesh = trimesh.creation.cylinder(radius=radius, height=height, sections=sections)
        mesh.visual = TextureVisuals(material=material)
        parts.append((name, mesh, position, rotation_matrix(-math.pi / 2.0, (1, 0, 0))))

    box("BasePlate", (0.62, 0.035, 0.28), (0.0, 0.0175, 0.0), dark)
    box("LowerBody", (0.42, 0.16, 0.18), (-0.04, 0.12, 0.0), body)
    box("Upright", (0.14, 0.29, 0.17), (0.17, 0.285, 0.0), body)
    box("UpperArm", (0.45, 0.13, 0.17), (-0.035, 0.455, 0.0), body)
    box("NeedleHead", (0.12, 0.20, 0.18), (-0.205, 0.335, 0.0), body)
    box("Needle", (0.012, 0.16, 0.012), (-0.205, 0.19, 0.0), steel)
    box("PresserFoot", (0.07, 0.018, 0.055), (-0.205, 0.095, 0.0), steel)
    box("ThreadGuide", (0.012, 0.21, 0.012), (0.12, 0.635, 0.0), steel)
    cylinder_y("Spool", 0.045, 0.11, (0.12, 0.585, 0.0), accent, 12)
    cylinder_y("TensionKnob", 0.027, 0.035, (-0.155, 0.43, 0.10), dark, 12)

    wheel = trimesh.creation.torus(major_radius=0.09, minor_radius=0.014, major_sections=16, minor_sections=6)
    wheel.visual = TextureVisuals(material=dark)
    parts.append(("HandWheel", wheel, (0.235, 0.38, 0.095), None))
    cylinder_y("WheelHub", 0.022, 0.04, (0.235, 0.38, 0.095), steel, 12)

    for index, (name, mesh, position, rotation) in enumerate(parts):
        transform = translation_matrix(position)
        if rotation is not None:
            transform = transform @ rotation
        scene.add_geometry(
            mesh,
            node_name=f"Sewing_{index:02d}_{name}",
            geom_name=f"Sewing_{index:02d}_{name}_geo",
            parent_node_name="Root",
            transform=transform,
        )
    return scene


def material_summary(scene: trimesh.Scene) -> tuple[list[str], int]:
    names: set[str] = set()
    textures: set[int] = set()
    for geometry in scene.geometry.values():
        material = getattr(geometry.visual, "material", None)
        if material is None:
            continue
        names.add(str(getattr(material, "name", "Material")))
        for key, value in getattr(material, "_data", {}).items():
            if key.lower().endswith("texture") and value is not None:
                textures.add(id(value))
    return sorted(names), len(textures)


def validate(path: Path, spec: PropSpec) -> dict[str, object]:
    scene = trimesh.load(path, force="scene", process=False)
    if not scene.geometry:
        raise ValueError(f"{path.name}: exported file contains no geometry")
    bounds = np.asarray(scene.bounds, dtype=float)
    extents = bounds[1] - bounds[0]
    triangles = sum(len(mesh.faces) for mesh in scene.geometry.values())
    materials, textures = material_summary(scene)
    center_xz = (bounds[0, (0, 2)] + bounds[1, (0, 2)]) / 2.0
    actual_reference = reference_size(extents, spec.scale_reference)
    checks = {
        "base_y_is_zero": abs(float(bounds[0, 1])) <= 1e-5,
        "centered_xz": bool(np.all(np.abs(center_xz) <= 1e-5)),
        "target_size_matches": abs(actual_reference - spec.target_size_m) <= 1e-4,
        "has_triangles": triangles > 0,
        "has_materials": bool(materials),
        "size_under_256_kib": path.stat().st_size < 256 * 1024,
    }
    if not all(checks.values()):
        failures = ", ".join(name for name, passed in checks.items() if not passed)
        raise ValueError(f"{path.name}: validation failed: {failures}")
    return {
        "file": path.relative_to(REPOSITORY_ROOT).as_posix(),
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
        "bounds_m": [[round(float(v), 6) for v in row] for row in bounds],
        "extents_m": [round(float(v), 6) for v in extents],
        "triangles": triangles,
        "geometries": len(scene.geometry),
        "materials": materials,
        "textures": textures,
        "checks": checks,
    }


def verify_license_evidence(source_dir: Path) -> None:
    required = (
        source_dir / "ASSET_MANIFEST.md",
        source_dir / "LICENSE-KENNEY-FACTORY-KIT.txt",
        source_dir / "license-evidence" / "license-cc0-1.0.html",
        source_dir / "license-evidence" / "license-cc-by-3.0.html",
    )
    missing = [path.relative_to(source_dir).as_posix() for path in required if not path.is_file()]
    if missing:
        raise FileNotFoundError(f"Missing local license evidence: {', '.join(missing)}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    args = parser.parse_args()

    source_dir = args.source_dir.resolve()
    output_dir = args.output_dir.resolve()
    report_path = args.report.resolve()
    verify_license_evidence(source_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)

    records: list[dict[str, object]] = []
    for spec in PROPS:
        if spec.source is None:
            source_scene = procedural_sewing_machine()
            source_hash = None
            source_label = "procedural:SIDE-sewing-machine-v1"
        else:
            source = source_dir / spec.source
            if not source.is_file():
                raise FileNotFoundError(source)
            source_hash = sha256(source)
            if source_hash != spec.expected_sha256:
                raise ValueError(
                    f"{source.name}: SHA-256 mismatch; expected {spec.expected_sha256}, got {source_hash}"
                )
            source_scene = trimesh.load(source, force="scene", process=False)
            source_label = spec.source

        destination = output_dir / spec.output
        scene, conversion = normalize_scene(source_scene, spec)
        destination.write_bytes(scene.export(file_type="glb"))
        validation = validate(destination, spec)
        records.append(
            {
                "source": source_label,
                "source_sha256": source_hash,
                "license": spec.license_id,
                "target_size_m": spec.target_size_m,
                "conversion": conversion,
                **validation,
            }
        )
        print(
            f"{spec.output}: {validation['bytes']} bytes, "
            f"{validation['triangles']} triangles, extents={validation['extents_m']} m"
        )

    total_bytes = sum(int(record["bytes"]) for record in records)
    budget_status = "within" if BUDGET_MIN_BYTES <= total_bytes <= BUDGET_MAX_BYTES else "outside"
    report = {
        "coordinate_system": "right-handed, Y-up, meters",
        "origin_policy": "base at Y=0; centered in X and Z",
        "optimization_policy": (
            "Preserve licensed low-poly geometry and PBR material groups; flatten source node transforms; "
            "remove unreferenced vertices; embed all GLB data; replace the rejected textured sewing machine "
            "with an original texture-free SIDE procedural model."
        ),
        "budget": {
            "target_min_bytes": BUDGET_MIN_BYTES,
            "target_max_bytes": BUDGET_MAX_BYTES,
            "actual_bytes": total_bytes,
            "status": budget_status,
        },
        "assets": records,
    }
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Total: {total_bytes} bytes ({budget_status} 200-300 KiB target)")
    print(f"Validation report: {report_path.relative_to(REPOSITORY_ROOT)}")


if __name__ == "__main__":
    main()
