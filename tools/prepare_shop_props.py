"""Normalize and validate the first licensed SIDE shop prop batch.

Inputs are the original GLBs selected in
``.codex-work/asset-staging/shop-selected-source``. Outputs use meters, Y-up,
an origin centered in X/Z at the base (Y=0), and the existing low-poly PBR
materials. The script deliberately does not modify the Three.js scene.

Install the build-only dependencies when needed:
    python -m pip install trimesh numpy

Run from the SIDE1 repository root:
    python tools/prepare_shop_props.py
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import trimesh


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = REPOSITORY_ROOT / ".codex-work" / "asset-staging" / "shop-selected-source"
DEFAULT_OUTPUT = REPOSITORY_ROOT / "assets" / "models3d" / "props"
DEFAULT_REPORT = REPOSITORY_ROOT / "docs" / "shop-props-validation.json"


@dataclass(frozen=True)
class PropSpec:
    source: str
    output: str
    height_m: float
    license_id: str
    depth_factor: float = 1.0


PROPS = (
    PropSpec("tableCross.glb", "shop_table_display.glb", 0.75, "CC0-1.0"),
    PropSpec("kitchenBar.glb", "shop_checkout_counter.glb", 0.95, "CC0-1.0"),
    PropSpec("kitchenBarEnd.glb", "shop_checkout_counter_end.glb", 0.95, "CC0-1.0"),
    PropSpec("bookcaseOpen.glb", "shop_shelf_tall.glb", 1.85, "CC0-1.0"),
    PropSpec("bookcaseOpenLow.glb", "shop_shelf_low.glb", 0.92, "CC0-1.0"),
    # The source mirror is intentionally chunky. Preserve its X/Y proportions
    # but reduce only its wall depth to keep it plausible in a compact shop.
    PropSpec("bathroomMirror.glb", "shop_mirror_wall.glb", 0.88, "CC0-1.0", 0.42),
    PropSpec(
        "cash-register_poly-by-google.glb",
        "shop_cash_register.glb",
        0.32,
        "CC-BY-3.0",
    ),
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
    """Return independent world-space copies while retaining materials."""
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


def normalize(source: Path, spec: PropSpec) -> tuple[trimesh.Scene, dict[str, object]]:
    source_scene = trimesh.load(source, force="scene", process=False)
    meshes = world_meshes(source_scene)
    before = combined_bounds(meshes)
    height = float(before[1, 1] - before[0, 1])
    if height <= 1e-8:
        raise ValueError(f"{source.name}: zero-height geometry")

    uniform = spec.height_m / height
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
        # The selected sources are already low-poly. Only remove data which is
        # provably unused; do not decimate or merge across PBR materials.
        mesh.remove_unreferenced_vertices()
        triangle_count += len(mesh.faces)
        output_scene.add_geometry(
            mesh,
            node_name=f"Prop_{index:02d}_{name}",
            geom_name=f"{safe_name(Path(spec.output).stem)}_{index:02d}",
            parent_node_name="Root",
        )

    metadata = {
        "source_bounds": before.tolist(),
        "scale_xyz": scale.tolist(),
        "triangles": triangle_count,
    }
    return output_scene, metadata


def material_summary(scene: trimesh.Scene) -> tuple[list[str], int]:
    names: set[str] = set()
    textures: set[int] = set()
    for geometry in scene.geometry.values():
        material = getattr(geometry.visual, "material", None)
        if material is None:
            continue
        names.add(str(getattr(material, "name", "Material")))
        data = getattr(material, "_data", {})
        for key, value in data.items():
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

    checks = {
        "base_y_is_zero": abs(float(bounds[0, 1])) <= 1e-5,
        "centered_xz": bool(np.all(np.abs(center_xz) <= 1e-5)),
        "height_matches_target": abs(float(extents[1]) - spec.height_m) <= 1e-4,
        "has_triangles": triangles > 0,
        "has_materials": bool(materials),
        "size_under_1_mib": path.stat().st_size < 1024 * 1024,
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
        source_dir / "LICENSE-KENNEY-FURNITURE-KIT.txt",
        source_dir / "ATTRIBUTION-POLY-PIZZA.txt",
        source_dir / "ASSET_MANIFEST.md",
    )
    missing = [path.name for path in required if not path.is_file()]
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
        source = source_dir / spec.source
        if not source.is_file():
            raise FileNotFoundError(source)
        destination = output_dir / spec.output
        scene, conversion = normalize(source, spec)
        destination.write_bytes(scene.export(file_type="glb"))
        validation = validate(destination, spec)
        records.append(
            {
                "source": spec.source,
                "source_sha256": sha256(source),
                "license": spec.license_id,
                "target_height_m": spec.height_m,
                "conversion": conversion,
                **validation,
            }
        )
        print(
            f"{spec.output}: {validation['bytes']} bytes, "
            f"{validation['triangles']} triangles, extents={validation['extents_m']} m"
        )

    report = {
        "coordinate_system": "right-handed, Y-up, meters",
        "origin_policy": "base at Y=0; centered in X and Z",
        "optimization_policy": (
            "Preserve licensed low-poly geometry and PBR material groups; "
            "flatten source node transforms; remove unreferenced vertices; embed all GLB data."
        ),
        "assets": records,
    }
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Validation report: {report_path.relative_to(REPOSITORY_ROOT)}")


if __name__ == "__main__":
    main()
