"""Bake selected CC0 Kenney GLBs into a lazy, loader-free Three.js asset pack.

Run with:

  /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/build_island_runtime_pack.py
"""

from __future__ import annotations

import json
from pathlib import Path

import bpy


PROJECT = Path(__file__).resolve().parents[1]
SOURCE = PROJECT / "assets" / "source-packs" / "kenney" / "nature-kit" / "Models" / "GLTF format"
OUTPUT = PROJECT / "assets" / "runtime" / "island-runtime-pack.js"
ASSETS = {
    "pineTall": "tree_pineTallA.glb",
    "pineRound": "tree_pineRoundC.glb",
    "treeTall": "tree_tall.glb",
    "treeSimple": "tree_simple.glb",
    "rockLarge": "rock_largeC.glb",
    "rockTall": "rock_tallF.glb",
    "cliff": "cliff_large_rock.glb",
    "tent": "tent_detailedClosed.glb",
    "bridge": "bridge_woodRoundNarrow.glb",
    "fence": "fence_simple.glb",
    "fenceGate": "fence_gate.glb",
    "sign": "sign.glb",
    "canoe": "canoe.glb",
    "lilyLarge": "lily_large.glb",
    "lilySmall": "lily_small.glb",
    "stoneBridge": "bridge_stoneRoundNarrow.glb",
    "statueColumn": "statue_column.glb",
    "statueColumnDamaged": "statue_columnDamaged.glb",
    "statueObelisk": "statue_obelisk.glb",
    "campfireLogs": "campfire_logs.glb",
    "cliffCave": "cliff_cave_rock.glb",
}


def three_point(point):
    return (float(point.x), float(point.z), float(-point.y))


def material_payload(identifier, material):
    color = material.diffuse_color
    return {
        "id": identifier,
        "color": [round(float(color[0]), 4), round(float(color[1]), 4), round(float(color[2]), 4)],
        "roughness": round(float(getattr(material, "roughness", 0.82)), 4),
        "metalness": round(float(getattr(material, "metallic", 0.0)), 4),
    }


def bake_asset(identifier, objects, materials):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    buckets = {}
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        normal_matrix = evaluated.matrix_world.to_3x3().inverted().transposed()
        for triangle in mesh.loop_triangles:
            slot = obj.material_slots[triangle.material_index]
            material = slot.material
            material_id = f"{identifier}:{material.name}"
            materials.setdefault(material_id, material_payload(material_id, material))
            bucket = buckets.setdefault(material_id, {"mat": material_id, "pos": [], "nor": [], "idx": [], "lookup": {}})
            for loop_index in triangle.loops:
                loop = mesh.loops[loop_index]
                vertex_index = loop.vertex_index
                world_point = evaluated.matrix_world @ mesh.vertices[vertex_index].co
                world_normal = (normal_matrix @ loop.normal).normalized()
                point = three_point(world_point)
                normal = three_point(world_normal)
                key = (obj.name, vertex_index, *(round(value, 5) for value in normal))
                index = bucket["lookup"].get(key)
                if index is None:
                    index = len(bucket["pos"]) // 3
                    bucket["lookup"][key] = index
                    bucket["pos"].extend(round(value, 5) for value in point)
                    bucket["nor"].extend(round(value, 5) for value in normal)
                bucket["idx"].append(index)
        evaluated.to_mesh_clear()

    all_points = [value for bucket in buckets.values() for value in bucket["pos"]]
    xs, ys, zs = all_points[0::3], all_points[1::3], all_points[2::3]
    center_x, base_y, center_z = (min(xs) + max(xs)) / 2, min(ys), (min(zs) + max(zs)) / 2
    for bucket in buckets.values():
        for index in range(0, len(bucket["pos"]), 3):
            bucket["pos"][index] = round(bucket["pos"][index] - center_x, 5)
            bucket["pos"][index + 1] = round(bucket["pos"][index + 1] - base_y, 5)
            bucket["pos"][index + 2] = round(bucket["pos"][index + 2] - center_z, 5)
        bucket.pop("lookup")

    bounds = {
        "width": round(max(xs) - min(xs), 4),
        "height": round(max(ys) - min(ys), 4),
        "depth": round(max(zs) - min(zs), 4),
    }
    return {"id": identifier, "source": ASSETS[identifier], "bounds": bounds, "prims": list(buckets.values())}


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    materials = {}
    assets = []
    for identifier, filename in ASSETS.items():
        path = SOURCE / filename
        if not path.exists():
            raise FileNotFoundError(path)
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(path))
        imported = [obj for obj in bpy.data.objects if obj not in before and obj.type == "MESH"]
        if not imported:
            raise RuntimeError(f"No mesh imported from {path}")
        assets.append(bake_asset(identifier, imported, materials))
        for obj in [obj for obj in bpy.data.objects if obj not in before]:
            bpy.data.objects.remove(obj, do_unlink=True)

    payload = {
        "name": "Fable Flight Island Runtime Pack",
        "source": "Kenney Nature Kit 2.1",
        "license": "CC0-1.0",
        "sourceUrl": "https://kenney.nl/assets/nature-kit",
        "materials": list(materials.values()),
        "assets": assets,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("// Generated by scripts/build_island_runtime_pack.py. Kenney Nature Kit, CC0.\nglobalThis.ISLAND_RUNTIME_PACK=" + json.dumps(payload, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(f"Wrote {OUTPUT} ({OUTPUT.stat().st_size} bytes, {len(assets)} assets)")


if __name__ == "__main__":
    main()
