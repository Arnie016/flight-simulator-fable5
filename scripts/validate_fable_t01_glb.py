"""Validate the exported Fable T-01 GLBs without Blender dependencies."""

from __future__ import annotations

import json
import hashlib
import struct
import sys
from pathlib import Path


PROJECT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = PROJECT / "assets" / "aircraft" / "fable-t01-aircraft.manifest.json"
REPORT_PATH = PROJECT / "artifacts" / "fable-t01-aircraft-validation.json"


def read_glb(path):
    data = path.read_bytes()
    if len(data) < 20:
        raise ValueError("file is too small")
    magic, version, declared_length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2 or declared_length != len(data):
        raise ValueError("invalid GLB header")
    offset = 12
    while offset + 8 <= len(data):
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        chunk = data[offset : offset + chunk_length]
        offset += chunk_length
        if chunk_type == 0x4E4F534A:
            return json.loads(chunk.rstrip(b" \t\r\n\0"))
    raise ValueError("GLB JSON chunk not found")


def triangle_count(document):
    accessors = document.get("accessors", [])
    total = 0
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            accessor_index = primitive.get("indices")
            if accessor_index is not None:
                total += accessors[accessor_index]["count"] // 3
            else:
                position_index = primitive.get("attributes", {}).get("POSITION")
                if position_index is not None:
                    total += accessors[position_index]["count"] // 3
    return total


def inspect_glb(path):
    document = read_glb(path)
    nodes = document.get("nodes", [])
    node_names = {node.get("name") for node in nodes if node.get("name")}
    primitives = [primitive for mesh in document.get("meshes", []) for primitive in mesh.get("primitives", [])]
    textured = sum("TEXCOORD_0" in primitive.get("attributes", {}) for primitive in primitives)
    materialized = sum("material" in primitive for primitive in primitives)
    return {
        "path": str(path.relative_to(PROJECT)),
        "bytes": path.stat().st_size,
        "nodes": sorted(node_names),
        "triangles": triangle_count(document),
        "mesh_primitives": len(primitives),
        "uv0_primitives": textured,
        "materialized_primitives": materialized,
        "materials": len(document.get("materials", [])),
        "document": document,
    }


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    errors = []
    inspections = {}
    for key in ("lod0", "lod1", "lod2", "collision"):
        path = PROJECT / manifest["files"][key]["path"]
        try:
            inspection = inspect_glb(path)
            inspections[key] = {field: value for field, value in inspection.items() if field != "document"}
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            errors.append(f"{key}: {exc}")
            continue
        expected_triangles = manifest["triangles"][key]
        if inspection["triangles"] != expected_triangles:
            errors.append(f"{key}: triangle drift {inspection['triangles']} != {expected_triangles}")
        if inspection["triangles"] > manifest["triangle_budgets"][key]:
            errors.append(f"{key}: exceeds triangle budget")
        if inspection["bytes"] > 5 * 1024 * 1024:
            errors.append(f"{key}: exceeds 5 MB handoff ceiling")
        if inspection["bytes"] != manifest["files"][key]["bytes"]:
            errors.append(f"{key}: byte count differs from manifest")
        if sha256(path) != manifest["files"][key]["sha256"]:
            errors.append(f"{key}: SHA-256 differs from manifest")
        if key != "collision" and inspection["mesh_primitives"] != inspection["uv0_primitives"]:
            errors.append(f"{key}: one or more mesh primitives lacks UV0")
        if inspection["mesh_primitives"] != inspection["materialized_primitives"]:
            errors.append(f"{key}: one or more mesh primitives lacks a PBR material")

    lod0 = inspections.get("lod0", {})
    missing = sorted(set(manifest["required_lod0_nodes"]) - set(lod0.get("nodes", [])))
    if missing:
        errors.append("lod0: missing required nodes: " + ", ".join(missing))
    lod0_document = inspections.get("lod0") and inspect_glb(PROJECT / manifest["files"]["lod0"]["path"])["document"]
    if lod0_document:
        nodes = lod0_document.get("nodes", [])
        by_name = {node.get("name"): node for node in nodes if node.get("name")}
        controls = {
            "LOD0_Aileron_L",
            "LOD0_Aileron_R",
            "LOD0_Flap_L",
            "LOD0_Flap_R",
            "LOD0_Elevator_L",
            "LOD0_Elevator_R",
            "LOD0_Rudder",
        }
        for name in controls:
            extras = by_name.get(name, {}).get("extras", {})
            if extras.get("fable_control_surface") is not True or not extras.get("fable_hinge_axis_three"):
                errors.append(f"lod0: {name} lacks exported hinge metadata")
        prop_index = next((index for index, node in enumerate(nodes) if node.get("name") == "LOD0_Propeller_Root"), None)
        blade_indices = {
            index
            for index, node in enumerate(nodes)
            if node.get("name") in {"LOD0_Propeller_Blade_A", "LOD0_Propeller_Blade_B"}
        }
        if prop_index is None or not blade_indices.issubset(set(nodes[prop_index].get("children", []))):
            errors.append("lod0: propeller blades are not children of the propeller pivot")
    collision_names = set(inspections.get("collision", {}).get("nodes", []))
    missing_collision = sorted({"COL_Fuselage", "COL_Wing", "COL_Tail", "COL_Gear"} - collision_names)
    if missing_collision:
        errors.append("collision: missing proxies: " + ", ".join(missing_collision))
    dimensions = manifest["bounds"]["dimensions_m"]
    if not (11.0 <= dimensions[0] <= 12.2 and 7.5 <= dimensions[1] <= 8.8 and 2.7 <= dimensions[2] <= 3.7):
        errors.append(f"manifest: scale outside trainer contract: {dimensions}")

    report = {
        "ok": not errors,
        "asset": manifest["asset"],
        "status": manifest["status"],
        "physics_authority": manifest["physics_authority"],
        "dimensions_m_blender_xyz": dimensions,
        "inspections": inspections,
        "errors": errors,
    }
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
