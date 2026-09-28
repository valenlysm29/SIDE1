"""Prepare and validate SIDE Tanda 4 shop-detail and production props.

Six licensed low-poly source GLBs are normalized from
``.codex-work/asset-staging/production-selected-source``. Two original SIDE
assets (an overlock machine and an industrial ironing station) are generated
procedurally. Existing warehouse assets used by Production are validated and
reported as references, never copied.

All newly written GLBs are self-contained, texture-free, Y-up, measured in
meters, centered on X/Z, and rest on Y=0.

Run from the SIDE1 repository root:
    python tools/prepare_production_props.py
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import struct
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import trimesh
from trimesh.transformations import rotation_matrix, translation_matrix
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = REPOSITORY_ROOT / ".codex-work" / "asset-staging" / "production-selected-source"
DEFAULT_OUTPUT = REPOSITORY_ROOT / "assets" / "models3d" / "props"
DEFAULT_REPORT = REPOSITORY_ROOT / "docs" / "production-props-validation.json"
IDEAL_MAX_BYTES = 180 * 1024
BUDGET_MAX_BYTES = 350 * 1024


@dataclass(frozen=True)
class PropSpec:
    source: str | None
    output: str
    target_size_m: float
    license_id: str
    expected_sha256: str | None = None
    scale_reference: str = "height"
    author: str = "SIDE"
    source_url: str = ""


PROPS = (
    PropSpec(
        "doorway-front_kenney.glb", "shop_entry_door.glb", 2.35, "CC0-1.0",
        "b5b8e4c14ee1f2ffa10ef5c69badc995ae6fbcc868abac240221c61b8c593b0e",
        author="Kenney", source_url="https://kenney.nl/assets/furniture-kit",
    ),
    PropSpec(
        "wall-window-slide_kenney.glb", "shop_window_panel.glb", 2.10, "CC0-1.0",
        "33e51d7ee74f13de318e419b0ebfb31fe7f6e9fd37050f13aa9347641b49376a",
        author="Kenney", source_url="https://kenney.nl/assets/furniture-kit",
    ),
    PropSpec(
        "lamp-square-ceiling_kenney.glb", "shop_ceiling_light.glb", 0.32, "CC0-1.0",
        "57066be51583d83ae60071e8179af275189cb2911ecb9fc24953bb930c8bf118",
        author="Kenney", source_url="https://kenney.nl/assets/furniture-kit",
    ),
    PropSpec(
        "atm_j-toastie.glb", "shop_atm.glb", 1.65, "CC-BY-3.0",
        "c2a9de7147a36d1d1625aa099759f6da324ca6d002a2f5ba0949cea01c4719e4",
        author="J-Toastie", source_url="https://poly.pizza/m/p4U0tSF5WN",
    ),
    PropSpec(
        "coat-rack-standing_kenney.glb", "production_garment_rack.glb", 1.85, "CC0-1.0",
        "d8231c22dab63ceb9fc8678f6c8ceafc62afa8726b51a73b4ce349043d3cdc91",
        author="Kenney", source_url="https://kenney.nl/assets/furniture-kit",
    ),
    PropSpec(
        "mannequin_reyshapes.glb", "production_mannequin.glb", 1.75, "CC0-1.0",
        "7d053b5b2625443497a9c92db1c68e8f6b89897ffb80bfc27c427353c41e4f2a",
        author="reyshapes", source_url="https://poly.pizza/m/tYwjQJvcFX",
    ),
    PropSpec(None, "production_overlock_machine.glb", 0.48, "SIDE-original"),
    PropSpec(None, "production_ironing_station.glb", 0.95, "SIDE-original"),
)


REUSED = (
    ("warehouse_sewing_machine.glb", "Industrial sewing stations", "SIDE-original"),
    ("warehouse_cutting_table.glb", "Production cutting tables", "CC0-1.0"),
    ("warehouse_fabric_rolls.glb", "Fabric-roll storage", "CC-BY-3.0"),
    ("warehouse_rack_tall.glb", "Production shelving", "CC0-1.0"),
    ("warehouse_pendant_light.glb", "Production hanging lights", "CC0-1.0"),
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
    meshes: list[tuple[str, trimesh.Trimesh]] = []
    for index, node_name in enumerate(scene.graph.nodes_geometry):
        transform, geometry_name = scene.graph.get(node_name)
        mesh = scene.geometry[geometry_name].copy()
        mesh.apply_transform(transform)
        meshes.append((f"{index:02d}_{safe_name(str(geometry_name))}", mesh))
    if not meshes:
        raise ValueError("GLB does not contain mesh geometry")
    return meshes


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
    scale = spec.target_size_m / size
    center = np.array(((before[0, 0] + before[1, 0]) / 2, before[0, 1], (before[0, 2] + before[1, 2]) / 2))
    output_scene = trimesh.Scene(base_frame="Root")
    triangles = 0
    for index, (name, mesh) in enumerate(meshes):
        mesh.apply_translation(-center)
        mesh.apply_scale(scale)
        mesh.remove_unreferenced_vertices()
        triangles += len(mesh.faces)
        output_scene.add_geometry(
            mesh,
            node_name=f"Prop_{index:02d}_{name}",
            geom_name=f"{safe_name(Path(spec.output).stem)}_{index:02d}",
            parent_node_name="Root",
        )
    return output_scene, {
        "source_bounds": before.tolist(),
        "scale_reference": spec.scale_reference,
        "uniform_scale": scale,
        "triangles": triangles,
    }


def pbr(name: str, color: int, roughness: float, metallic: float = 0.0, emissive: int = 0) -> PBRMaterial:
    rgba = [(color >> 16) & 255, (color >> 8) & 255, color & 255, 255]
    kwargs: dict[str, object] = {
        "name": name,
        "baseColorFactor": rgba,
        "roughnessFactor": roughness,
        "metallicFactor": metallic,
    }
    if emissive:
        kwargs["emissiveFactor"] = [((emissive >> shift) & 255) / 255 for shift in (16, 8, 0)]
    return PBRMaterial(**kwargs)


def add_box(parts: list, name: str, extents: tuple[float, float, float], position: tuple[float, float, float], material: PBRMaterial) -> None:
    mesh = trimesh.creation.box(extents=extents)
    mesh.visual = TextureVisuals(material=material)
    parts.append((name, mesh, position, None))


def add_cylinder_y(parts: list, name: str, radius: float, height: float, position: tuple[float, float, float], material: PBRMaterial, sections: int = 12) -> None:
    mesh = trimesh.creation.cylinder(radius=radius, height=height, sections=sections)
    mesh.visual = TextureVisuals(material=material)
    parts.append((name, mesh, position, rotation_matrix(-math.pi / 2, (1, 0, 0))))


def scene_from_parts(prefix: str, parts: list) -> trimesh.Scene:
    scene = trimesh.Scene(base_frame="Root")
    for index, (name, mesh, position, rotation) in enumerate(parts):
        transform = translation_matrix(position)
        if rotation is not None:
            transform = transform @ rotation
        scene.add_geometry(
            mesh,
            node_name=f"{prefix}_{index:02d}_{name}",
            geom_name=f"{prefix}_{index:02d}_{name}_geo",
            parent_node_name="Root",
            transform=transform,
        )
    return scene


def procedural_overlock_machine() -> trimesh.Scene:
    """Original SIDE compact industrial overlock/serger machine."""
    parts: list = []
    ivory = pbr("OverlockIvory", 0xD9D5C8, 0.48, 0.10)
    dark = pbr("OverlockDark", 0x28323A, 0.42, 0.22)
    steel = pbr("OverlockSteel", 0x8D989E, 0.30, 0.68)
    accent = pbr("OverlockAccent", 0xD88A35, 0.43, 0.06)
    add_box(parts, "BasePlate", (0.48, 0.035, 0.31), (0, 0.0175, 0), dark)
    add_box(parts, "Body", (0.34, 0.29, 0.25), (0.055, 0.205, 0), ivory)
    add_box(parts, "NeedleTower", (0.13, 0.37, 0.23), (-0.14, 0.255, 0), ivory)
    add_box(parts, "Needle", (0.010, 0.13, 0.010), (-0.18, 0.125, 0.02), steel)
    add_box(parts, "Knife", (0.025, 0.12, 0.045), (-0.115, 0.12, -0.055), steel)
    add_box(parts, "PresserFoot", (0.075, 0.018, 0.06), (-0.17, 0.068, 0.02), steel)
    add_box(parts, "ThreadStand", (0.012, 0.30, 0.012), (0.12, 0.52, 0), steel)
    add_box(parts, "ThreadBar", (0.28, 0.012, 0.012), (0.0, 0.66, 0), steel)
    add_cylinder_y(parts, "ConeA", 0.04, 0.11, (-0.04, 0.45, 0.02), accent)
    add_cylinder_y(parts, "ConeB", 0.04, 0.11, (0.08, 0.45, 0.02), dark)
    add_cylinder_y(parts, "TensionA", 0.022, 0.025, (-0.05, 0.31, 0.14), accent)
    add_cylinder_y(parts, "TensionB", 0.022, 0.025, (0.04, 0.31, 0.14), dark)
    return scene_from_parts("Overlock", parts)


def procedural_ironing_station() -> trimesh.Scene:
    """Original SIDE industrial pressing table, iron, hose and control box."""
    parts: list = []
    steel = pbr("PressSteel", 0x737D84, 0.32, 0.72)
    dark = pbr("PressDark", 0x283038, 0.46, 0.28)
    pad = pbr("PressPad", 0xC5CBC8, 0.78, 0.0)
    accent = pbr("PressAccent", 0xE36B3B, 0.44, 0.08)
    add_box(parts, "PaddedBoard", (1.36, 0.09, 0.48), (0, 0.82, 0), pad)
    add_box(parts, "FrameFront", (1.18, 0.055, 0.055), (0, 0.69, 0.17), steel)
    add_box(parts, "FrameBack", (1.18, 0.055, 0.055), (0, 0.69, -0.17), steel)
    for x in (-0.48, 0.48):
        add_box(parts, f"Leg{x}", (0.07, 0.69, 0.07), (x, 0.345, 0), steel)
        add_box(parts, f"Foot{x}", (0.32, 0.05, 0.36), (x, 0.025, 0), dark)
    add_box(parts, "ControlBox", (0.22, 0.24, 0.17), (0.43, 0.53, 0.19), dark)
    add_box(parts, "ControlLight", (0.07, 0.035, 0.02), (0.43, 0.57, 0.285), accent)
    add_box(parts, "IronSole", (0.27, 0.035, 0.13), (-0.2, 0.895, 0), steel)
    add_box(parts, "IronBody", (0.19, 0.095, 0.11), (-0.22, 0.95, 0), accent)
    add_box(parts, "IronHandle", (0.12, 0.025, 0.025), (-0.22, 1.04, 0), dark)
    add_box(parts, "HandleFront", (0.025, 0.09, 0.025), (-0.28, 0.995, 0), dark)
    add_box(parts, "HandleBack", (0.025, 0.09, 0.025), (-0.16, 0.995, 0), dark)
    add_cylinder_y(parts, "SteamTank", 0.115, 0.31, (0.48, 0.20, 0), steel, 14)
    return scene_from_parts("IronStation", parts)


def generated_scene(output: str) -> tuple[trimesh.Scene, str]:
    if output == "production_overlock_machine.glb":
        return procedural_overlock_machine(), "procedural:SIDE-overlock-machine-v1"
    if output == "production_ironing_station.glb":
        return procedural_ironing_station(), "procedural:SIDE-ironing-station-v1"
    raise ValueError(f"No generator for {output}")


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
    """Return external buffer/image URIs; self-contained GLBs have none."""
    data = path.read_bytes()
    if len(data) < 20 or data[:4] != b"glTF":
        raise ValueError(f"{path.name}: invalid GLB header")
    if struct.unpack_from("<I", data, 8)[0] != len(data):
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


def validate(path: Path, spec: PropSpec | None = None) -> dict[str, object]:
    scene = trimesh.load(path, force="scene", process=False)
    if not scene.geometry:
        raise ValueError(f"{path.name}: exported file contains no geometry")
    bounds = np.asarray(scene.bounds, dtype=float)
    extents = bounds[1] - bounds[0]
    triangles = sum(len(mesh.faces) for mesh in scene.geometry.values())
    materials, textures = material_summary(scene)
    external_uris = external_glb_uris(path)
    center_xz = (bounds[0, (0, 2)] + bounds[1, (0, 2)]) / 2
    checks = {
        "base_y_is_zero": abs(float(bounds[0, 1])) <= 1e-5,
        "centered_xz": bool(np.all(np.abs(center_xz) <= 1e-5)),
        "has_triangles": triangles > 0,
        "has_materials": bool(materials),
        "has_no_textures": textures == 0,
        "self_contained_glb": not external_uris,
        "size_under_256_kib": path.stat().st_size < 256 * 1024,
    }
    if spec is not None:
        actual_reference = reference_size(extents, spec.scale_reference)
        checks["target_size_matches"] = abs(actual_reference - spec.target_size_m) <= 1e-4
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
        "textures": textures,
        "external_uris": external_uris,
        "checks": checks,
    }


def verify_license_evidence(source_dir: Path) -> None:
    required = (
        source_dir / "ASSET_MANIFEST.md",
        source_dir / "LICENSE-KENNEY-FURNITURE.txt",
        source_dir / "license-evidence" / "poly-pizza-atm-j-toastie.html",
        source_dir / "license-evidence" / "poly-pizza-mannequin-reyshapes.html",
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
            source_scene, source_label = generated_scene(spec.output)
            source_hash = None
        else:
            source = source_dir / spec.source
            if not source.is_file():
                raise FileNotFoundError(source)
            source_hash = sha256(source)
            if source_hash != spec.expected_sha256:
                raise ValueError(f"{source.name}: SHA-256 mismatch; expected {spec.expected_sha256}, got {source_hash}")
            source_scene = trimesh.load(source, force="scene", process=False)
            source_label = spec.source
        scene, conversion = normalize_scene(source_scene, spec)
        destination = output_dir / spec.output
        destination.write_bytes(scene.export(file_type="glb"))
        result = validate(destination, spec)
        records.append({
            "source": source_label,
            "source_sha256": source_hash,
            "author": spec.author,
            "source_url": spec.source_url,
            "license": spec.license_id,
            "target_size_m": spec.target_size_m,
            "conversion": conversion,
            **result,
        })
        print(f"{spec.output}: {result['bytes']} bytes, {result['triangles']} triangles, {result['geometries']} geometries")

    reused: list[dict[str, object]] = []
    for filename, use, license_id in REUSED:
        path = output_dir / filename
        if not path.is_file():
            raise FileNotFoundError(path)
        reused.append({"use": use, "license": license_id, **validate(path)})

    new_bytes = sum(int(item["bytes"]) for item in records)
    new_triangles = sum(int(item["triangles"]) for item in records)
    reused_bytes = sum(int(item["bytes"]) for item in reused)
    reused_triangles = sum(int(item["triangles"]) for item in reused)
    if new_bytes > BUDGET_MAX_BYTES:
        raise ValueError(f"New production batch exceeds {BUDGET_MAX_BYTES} byte budget: {new_bytes}")
    status = "ideal" if new_bytes <= IDEAL_MAX_BYTES else "within_maximum"
    report = {
        "coordinate_system": "right-handed, Y-up, meters",
        "origin_policy": "base at Y=0; centered in X and Z",
        "optimization_policy": (
            "Preserve licensed low-poly geometry and material groups; flatten transforms; remove unreferenced vertices; "
            "export self-contained texture-free GLBs. Generate original lightweight SIDE machinery where no suitable source exists."
        ),
        "budget": {
            "ideal_max_bytes": IDEAL_MAX_BYTES,
            "maximum_bytes": BUDGET_MAX_BYTES,
            "new_actual_bytes": new_bytes,
            "status": status,
        },
        "totals": {
            "new_assets": len(records),
            "new_bytes": new_bytes,
            "new_triangles": new_triangles,
            "new_geometries": sum(int(item["geometries"]) for item in records),
            "reused_assets": len(reused),
            "reused_bytes": reused_bytes,
            "reused_triangles": reused_triangles,
            "effective_unique_assets": len(records) + len(reused),
            "effective_bytes": new_bytes + reused_bytes,
            "effective_triangles": new_triangles + reused_triangles,
        },
        "assets": records,
        "reused_assets": reused,
    }
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"New total: {new_bytes} bytes, {new_triangles} triangles ({status})")
    print(f"Reused total: {reused_bytes} bytes, {reused_triangles} triangles")
    print(f"Effective unique total: {new_bytes + reused_bytes} bytes, {new_triangles + reused_triangles} triangles")
    print(f"Validation report: {report_path.relative_to(REPOSITORY_ROOT)}")


if __name__ == "__main__":
    main()
