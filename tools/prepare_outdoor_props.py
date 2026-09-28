"""Normalize and validate SIDE's licensed low-poly outdoor prop batch.

The 12 CC0 inputs are kept in
``.codex-work/asset-staging/outdoor-selected-source``. Outputs use meters,
Y-up, an origin centered in X/Z at the base Y=0, embedded GLB data, and
deterministic ``outdoor_*`` names. The script does not modify the Three.js
scene or the source staging area.

Run from the SIDE1 repository root:
    python tools/prepare_outdoor_props.py
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import struct
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import trimesh


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = REPOSITORY_ROOT / ".codex-work" / "asset-staging" / "outdoor-selected-source"
DEFAULT_OUTPUT = REPOSITORY_ROOT / "assets" / "models3d" / "props"
DEFAULT_REPORT = REPOSITORY_ROOT / "docs" / "outdoor-props-validation.json"
BUDGET_MAX_BYTES = 350 * 1024
IDEAL_MAX_BYTES = 200 * 1024


@dataclass(frozen=True)
class PropSpec:
    source: str
    output: str
    target_size_m: float
    expected_sha256: str
    scale_reference: str = "height"
    width_factor: float = 1.0
    depth_factor: float = 1.0
    license_id: str = "CC0-1.0"


PROPS = (
    PropSpec("tree_default.glb", "outdoor_tree_default.glb", 4.80, "562d29638c902de3c7bee465d3a53bb77117efbc392ae04ed894faf6b5dc691d"),
    PropSpec("tree_oak.glb", "outdoor_tree_oak.glb", 4.20, "d7fd8773674928c50c11b66d12c636d49bdcc15a8b1c7fbb98e6f63a3439a3f3"),
    PropSpec("tree_tall.glb", "outdoor_tree_tall.glb", 5.60, "3515a8826044d91e84e011186c86878f62024a487a079b4e32c9ac2e71994411"),
    PropSpec("plant_bush.glb", "outdoor_bush.glb", 0.75, "ae7b1beb39e242b13f5f29e3ec23ef21034b814f82297b8aa00a9bf4e1b09590"),
    PropSpec("traffic-light.glb", "outdoor_traffic_light.glb", 3.20, "6c9ee253b7370e1043168493b2e662b349484a0cdd02100cff04d9d8d1bd9abb"),
    PropSpec("light-square.glb", "outdoor_street_light.glb", 4.20, "6230d136c8883d7f9bc1b86f0309077e452e26e5e1e587ef1b77abef3c5f047c"),
    PropSpec("road-sign-stop.glb", "outdoor_stop_sign.glb", 2.20, "0991181f37171daf8d2501e436a688e46ea2bcebb5e27aa451640fcbaab107ef"),
    # Kenney's bench source is intentionally narrow. Normalize its height,
    # then lengthen only X so it reads as a two-seat public bench in meters.
    PropSpec("bench.glb", "outdoor_bench.glb", 0.85, "ba05a6d23a5a5a44da016757632070e47ff7587ce10e2f6d6d52328b4cf5489b", width_factor=2.40),
    PropSpec("pottedPlant.glb", "outdoor_planter.glb", 0.75, "5b760eda2766f75fda36b2c5df652a1662f82981ef64cd8fa7fe7bcd386b3a15"),
    PropSpec("trashcan.glb", "outdoor_trashcan.glb", 0.85, "e0ccc1fe50cbd05386477fdff527171d1cf7c0de2ba7ff3233f8d9561feb2561"),
    PropSpec("fountain_isa-lousberg.glb", "outdoor_fountain.glb", 3.00, "0a8f2884303228dc19764684dfaba94e7de4c305916466d5f33688647122526c", "footprint"),
    PropSpec("brown-bird_assetquest.glb", "outdoor_bird_brown.glb", 0.28, "b3421a6c883bbf446b91cc99c53b1bd9603e975fe9f60b36fdf7f5b6c306fed9", "footprint"),
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
    scale = np.array(
        (uniform * spec.width_factor, uniform, uniform * spec.depth_factor),
        dtype=float,
    )
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


def external_glb_uris(path: Path) -> list[str]:
    """Return non-data buffer/image URIs; a valid self-contained GLB has none."""
    data = path.read_bytes()
    if len(data) < 20 or data[:4] != b"glTF":
        raise ValueError(f"{path.name}: invalid GLB header")
    declared_length = struct.unpack_from("<I", data, 8)[0]
    if declared_length != len(data):
        raise ValueError(f"{path.name}: GLB length header does not match file size")

    offset = 12
    document: dict[str, object] | None = None
    while offset + 8 <= len(data):
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        chunk = data[offset : offset + chunk_length]
        offset += chunk_length
        if chunk_type == 0x4E4F534A:
            document = json.loads(chunk.rstrip(b" \t\r\n\x00").decode("utf-8"))
            break
    if document is None:
        raise ValueError(f"{path.name}: missing GLB JSON chunk")

    uris: list[str] = []
    for collection in ("buffers", "images"):
        for item in document.get(collection, []):
            uri = item.get("uri")
            if uri and not str(uri).startswith("data:"):
                uris.append(str(uri))
    return uris


def validate(path: Path, spec: PropSpec) -> dict[str, object]:
    scene = trimesh.load(path, force="scene", process=False)
    if not scene.geometry:
        raise ValueError(f"{path.name}: exported file contains no geometry")
    bounds = np.asarray(scene.bounds, dtype=float)
    extents = bounds[1] - bounds[0]
    triangles = sum(len(mesh.faces) for mesh in scene.geometry.values())
    materials, textures = material_summary(scene)
    center_xz = (bounds[0, (0, 2)] + bounds[1, (0, 2)]) / 2.0
    actual_reference = reference_size(
        np.array((extents[0] / spec.width_factor, extents[1], extents[2] / spec.depth_factor)),
        spec.scale_reference,
    )
    external_uris = external_glb_uris(path)
    checks = {
        "base_y_is_zero": abs(float(bounds[0, 1])) <= 1e-5,
        "centered_xz": bool(np.all(np.abs(center_xz) <= 1e-5)),
        "target_size_matches": abs(actual_reference - spec.target_size_m) <= 1e-4,
        "has_triangles": triangles > 0,
        "has_materials": bool(materials),
        "self_contained_glb": not external_uris,
        "size_under_128_kib": path.stat().st_size < 128 * 1024,
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
        "material_count": len(materials),
        "materials": materials,
        "embedded_textures": textures,
        "external_uris": external_uris,
        "checks": checks,
    }


def verify_license_evidence(source_dir: Path) -> None:
    required = (
        source_dir / "ASSET_MANIFEST.md",
        source_dir / "LICENSE-KENNEY-NATURE.txt",
        source_dir / "LICENSE-KENNEY-CITY-ROADS.txt",
        source_dir / "LICENSE-KENNEY-FURNITURE.txt",
        source_dir / "license-evidence" / "poly-pizza-fountain-isa-lousberg.html",
        source_dir / "license-evidence" / "poly-pizza-brown-bird-assetquest.html",
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
        source = source_dir / spec.source
        if not source.is_file():
            raise FileNotFoundError(source)
        source_hash = sha256(source)
        if source_hash != spec.expected_sha256:
            raise ValueError(
                f"{source.name}: SHA-256 mismatch; expected {spec.expected_sha256}, got {source_hash}"
            )

        source_scene = trimesh.load(source, force="scene", process=False)
        destination = output_dir / spec.output
        scene, conversion = normalize_scene(source_scene, spec)
        destination.write_bytes(scene.export(file_type="glb"))
        validation = validate(destination, spec)
        records.append(
            {
                "source": spec.source,
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
    total_triangles = sum(int(record["triangles"]) for record in records)
    total_geometries = sum(int(record["geometries"]) for record in records)
    if total_bytes > BUDGET_MAX_BYTES:
        raise ValueError(
            f"Outdoor batch exceeds {BUDGET_MAX_BYTES} byte budget: {total_bytes} bytes"
        )
    budget_status = "ideal" if total_bytes <= IDEAL_MAX_BYTES else "within_maximum"
    report = {
        "coordinate_system": "right-handed, Y-up, meters",
        "origin_policy": "base at Y=0; centered in X and Z",
        "optimization_policy": (
            "Preserve licensed low-poly geometry and PBR material groups; flatten source node transforms; "
            "remove unreferenced vertices; export self-contained GLB files without external textures."
        ),
        "budget": {
            "ideal_max_bytes": IDEAL_MAX_BYTES,
            "maximum_bytes": BUDGET_MAX_BYTES,
            "actual_bytes": total_bytes,
            "status": budget_status,
        },
        "totals": {
            "assets": len(records),
            "bytes": total_bytes,
            "triangles": total_triangles,
            "geometries": total_geometries,
        },
        "assets": records,
    }
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(
        f"Total: {total_bytes} bytes, {total_triangles} triangles, "
        f"{total_geometries} geometries ({budget_status})"
    )
    print(f"Validation report: {report_path.relative_to(REPOSITORY_ROOT)}")


if __name__ == "__main__":
    main()
