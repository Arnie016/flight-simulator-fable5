"""Generate Fable Flight's static airside service set in Blender.

The browser runtime uses the generated JS geometry directly so it stays
loader-free. The .blend and .glb exports remain as editable source assets.
Run with:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/build_airfield_props.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


PROJECT = Path(__file__).resolve().parents[1]
ASSETS = PROJECT / "assets"
OUT_BLEND = ASSETS / "fable-airfield-props.blend"
OUT_GLB = ASSETS / "fable-airfield-props.glb"
OUT_JS = PROJECT / "blender-airfield-props.js"


def make_material(name, color, roughness=0.7, metalness=0.0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1.0)
    material.metallic = metalness
    material.roughness = roughness
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        bsdf.inputs["Metallic"].default_value = metalness
        bsdf.inputs["Roughness"].default_value = roughness
    return material


def finalize(obj, material, bevel=0.0):
    obj.data.materials.append(material)
    if bevel:
        modifier = obj.modifiers.new("Soft edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 1
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def cube(name, location, dimensions, material, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finalize(obj, material, bevel)


def cylinder(name, location, radius, depth, material, rotation=(0, 0, 0), vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.active_object
    obj.name = name
    return finalize(obj, material, 0.04)


def roof(name, span, length, wall_height, roof_height, material):
    """Create a low-poly barrel roof, extruded along the hangar's z axis."""
    segments = 12
    vertices = []
    for z in (-length / 2, length / 2):
        for i in range(segments + 1):
            x = -span / 2 + span * i / segments
            arc = math.sqrt(max(0.0, 1.0 - (x / (span / 2)) ** 2))
            vertices.append((x, wall_height + roof_height * arc, z))
    faces = []
    back = segments + 1
    for i in range(segments):
        # This winding keeps the exterior normals pointed up/out without
        # duplicating reverse faces, which makes a cleaner GLB export.
        faces.append((i, back + i, back + i + 1, i + 1))
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    mesh.validate(verbose=True)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def build_hangar(materials, objects):
    span, length, wall_h = 16.0, 48.0, 7.0
    wall = materials["Hangar wall"]
    roof_mat = materials["Hangar roof"]
    door = materials["Hangar door"]
    glass = materials["Window glass"]
    accent = materials["Safety cyan"]

    objects.extend(
        [
            cube("Hangar back", (span / 2 - 0.25, wall_h / 2, 0), (0.5, wall_h, length), wall, 0.08),
            cube("Hangar side north", (0, wall_h / 2, length / 2 - 0.25), (span, wall_h, 0.5), wall, 0.08),
            cube("Hangar side south", (0, wall_h / 2, -length / 2 + 0.25), (span, wall_h, 0.5), wall, 0.08),
            cube("Hangar lintel", (-span / 2 + 0.2, wall_h - 0.28, 0), (0.42, 0.56, length), wall, 0.04),
            roof("Hangar barrel roof", span, length, wall_h, 4.2, roof_mat),
        ]
    )
    for z in (-22.5, -8.0, 8.0, 22.5):
        objects.append(cube("Hangar front column", (-span / 2 + 0.2, wall_h / 2, z), (0.42, wall_h, 0.55), wall, 0.04))
    for z in (-15.5, -5.2, 5.2, 15.5):
        objects.append(cube("Hangar rolling door", (-span / 2 + 0.02, 3.05, z), (0.16, 5.7, 9.6), door, 0.02))
    for z in (-13.5, 13.5):
        objects.append(cube("Hangar side window", (span / 2 + 0.02, 5.15, z), (0.1, 1.15, 8.8), glass, 0.01))
    objects.append(cube("Hangar beacon strip", (-span / 2 - 0.04, 6.4, 0), (0.1, 0.22, 18.0), accent, 0.02))


def build_refueler(materials, objects):
    """A service truck parked beside the hangar, oriented toward the runway."""
    ox, oz = -13.2, 30.0
    chassis = materials["Truck chassis"]
    paint = materials["Service yellow"]
    tire = materials["Rubber"]
    glass = materials["Window glass"]

    objects.extend(
        [
            cube("Refueler chassis", (ox, 0.75, oz), (5.8, 0.55, 2.5), chassis, 0.12),
            cube("Refueler cab", (ox - 1.9, 1.65, oz), (1.55, 1.35, 2.35), paint, 0.1),
            cube("Refueler windshield", (ox - 2.7, 1.87, oz), (0.08, 0.7, 1.65), glass, 0.01),
            cylinder("Refueler tank", (ox + 0.85, 1.82, oz), 1.05, 3.75, paint, rotation=(0, math.pi / 2, 0), vertices=16),
        ]
    )
    for x in (-2.0, 1.55):
        for z in (-1.15, 1.15):
            objects.append(cylinder("Refueler wheel", (ox + x, 0.48, oz + z), 0.53, 0.32, tire, rotation=(math.pi / 2, 0, 0), vertices=10))


def build_ground_props(materials, objects):
    crate = materials["Crate wood"]
    metal = materials["Hangar wall"]
    signal = materials["Safety cyan"]
    for x, z, height in [(-8.0, -30.0, 0.55), (-6.6, -30.0, 0.85), (-5.2, -30.0, 0.42), (-8.0, -28.6, 0.36)]:
        objects.append(cube("Cargo pallet", (x, height / 2, z), (1.2, height, 1.0), crate, 0.04))
    objects.extend(
        [
            cylinder("Apron beacon pole", (-10.2, 1.45, -29.5), 0.09, 2.9, metal, vertices=8),
            cylinder("Apron beacon cap", (-10.2, 3.0, -29.5), 0.22, 0.3, signal, vertices=10),
        ]
    )


def build_control_tower(materials, objects):
    """A visible airfield landmark kept inside the static Blender service set."""
    ox, oz = -22.0, -90.0
    concrete = materials["Tower concrete"]
    trim = materials["Tower trim"]
    glass = materials["Tower glass"]
    signal = materials["Safety cyan"]
    metal = materials["Hangar wall"]

    objects.extend(
        [
            cube("Tower shaft", (ox, 6.0, oz), (7.2, 12.0, 7.2), concrete, 0.1),
            cube("Tower cabin", (ox, 15.2, oz), (10.2, 3.5, 10.2), trim, 0.1),
            cube("Tower roof", (ox, 17.25, oz), (11.3, 0.45, 11.3), metal, 0.1),
            cube("Tower north glazing", (ox, 15.25, oz - 5.18), (8.3, 2.2, 0.12), glass, 0.02),
            cube("Tower south glazing", (ox, 15.25, oz + 5.18), (8.3, 2.2, 0.12), glass, 0.02),
            cube("Tower west glazing", (ox - 5.18, 15.25, oz), (0.12, 2.2, 8.3), glass, 0.02),
            cube("Tower east glazing", (ox + 5.18, 15.25, oz), (0.12, 2.2, 8.3), glass, 0.02),
            cylinder("Tower antenna mast", (ox, 20.25, oz), 0.09, 6.0, metal, vertices=8),
            cylinder("Tower beacon", (ox, 18.05, oz), 0.28, 0.34, signal, vertices=10),
        ]
    )
    for i in range(8):
        objects.append(cube("Tower stair", (ox - 5.1 - i * 0.43, 0.24 + i * 0.39, oz + 2.8), (2.1, 0.38, 3.2), concrete, 0.03))


def material_payload(material):
    color = material.diffuse_color
    return {
        "name": material.name,
        "color": [round(float(color[0]), 4), round(float(color[1]), 4), round(float(color[2]), 4)],
        "roughness": round(float(material.roughness), 4),
        "metalness": round(float(material.metallic), 4),
    }


def bake_runtime_asset(objects, materials):
    """Flatten Blender meshes into the small BufferGeometry data the game already uses."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    buckets = {}
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        normal_matrix = evaluated.matrix_world.to_3x3().inverted().transposed()
        for triangle in mesh.loop_triangles:
            material = obj.material_slots[triangle.material_index].material
            bucket = buckets.setdefault(material.name, {"mat": material.name, "pos": [], "nor": [], "idx": [], "lookup": {}})
            for loop_index in triangle.loops:
                loop = mesh.loops[loop_index]
                vertex_index = loop.vertex_index
                normal = (normal_matrix @ loop.normal).normalized()
                key = (obj.name, vertex_index, round(normal.x, 5), round(normal.y, 5), round(normal.z, 5))
                baked_index = bucket["lookup"].get(key)
                if baked_index is None:
                    co = evaluated.matrix_world @ mesh.vertices[vertex_index].co
                    baked_index = len(bucket["pos"]) // 3
                    bucket["lookup"][key] = baked_index
                    bucket["pos"].extend(round(float(value), 5) for value in co)
                    bucket["nor"].extend(round(float(value), 5) for value in normal)
                bucket["idx"].append(baked_index)
        evaluated.to_mesh_clear()

    prims = []
    for bucket in buckets.values():
        bucket.pop("lookup")
        prims.append(bucket)
    coords = [value for prim in prims for value in prim["pos"]]
    xs, ys, zs = coords[0::3], coords[1::3], coords[2::3]
    payload = {
        "name": "Fable Airfield Service Set",
        "source": "Blender 5.1.0 procedural asset factory",
        "materials": [material_payload(material) for material in materials.values()],
        "bounds": [round(min(xs), 3), round(min(ys), 3), round(min(zs), 3), round(max(xs), 3), round(max(ys), 3), round(max(zs), 3)],
        "prims": prims,
    }
    OUT_JS.write_text("// Generated by scripts/build_airfield_props.py. Do not hand-edit.\nconst BLENDER_AIRFIELD_PROPS = " + json.dumps(payload, separators=(",", ":")) + ";\n", encoding="utf-8")
    return payload


def export_glb(objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    try:
        bpy.ops.wm.gltf_export(filepath=str(OUT_GLB), export_format="GLB", use_selection=True, export_apply=True)
    except (AttributeError, RuntimeError, TypeError):
        bpy.ops.export_scene.gltf(filepath=str(OUT_GLB), export_format="GLB", use_selection=True, export_apply=True)


def main():
    ASSETS.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    materials = {
        "Hangar wall": make_material("Hangar wall", (0.32, 0.4, 0.47), 0.55, 0.34),
        "Hangar roof": make_material("Hangar roof", (0.13, 0.19, 0.26), 0.42, 0.72),
        "Hangar door": make_material("Hangar door", (0.2, 0.29, 0.35), 0.62, 0.18),
        "Window glass": make_material("Window glass", (0.09, 0.38, 0.52), 0.18, 0.38),
        "Safety cyan": make_material("Safety cyan", (0.16, 0.82, 0.95), 0.3, 0.24),
        "Truck chassis": make_material("Truck chassis", (0.07, 0.09, 0.12), 0.72, 0.55),
        "Service yellow": make_material("Service yellow", (0.95, 0.56, 0.08), 0.46, 0.2),
        "Rubber": make_material("Rubber", (0.025, 0.028, 0.032), 0.92, 0.0),
        "Crate wood": make_material("Crate wood", (0.44, 0.25, 0.1), 0.86, 0.0),
        "Tower concrete": make_material("Tower concrete", (0.53, 0.57, 0.61), 0.78, 0.08),
        "Tower trim": make_material("Tower trim", (0.15, 0.2, 0.25), 0.42, 0.45),
        "Tower glass": make_material("Tower glass", (0.11, 0.49, 0.66), 0.16, 0.42),
    }
    objects = []
    build_hangar(materials, objects)
    build_refueler(materials, objects)
    build_ground_props(materials, objects)
    build_control_tower(materials, objects)
    payload = bake_runtime_asset(objects, materials)
    export_glb(objects)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
    triangles = sum(len(prim["idx"]) // 3 for prim in payload["prims"])
    print("FABLE_AIRFIELD_EXPORT", json.dumps({"glb": str(OUT_GLB), "js": str(OUT_JS), "blend": str(OUT_BLEND), "prims": len(payload["prims"]), "triangles": triangles}))


if __name__ == "__main__":
    main()
