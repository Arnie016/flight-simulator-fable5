"""Generate level-specific Fable Flight landmarks in Blender.

The browser consumes a loader-free JS bake, while the matching .blend and
.glb files remain editable source assets. Run with:

  /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/build_scene_landmarks.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import bpy


PROJECT = Path(__file__).resolve().parents[1]
ASSETS = PROJECT / "assets"
OUT_BLEND = ASSETS / "fable-scene-landmarks.blend"
OUT_GLB = ASSETS / "fable-scene-landmarks.glb"
OUT_JS = PROJECT / "blender-scene-landmarks.js"


def to_blender_point(point):
    """Convert the runtime's X-right/Y-up/Z-forward coordinates to Blender's Z-up space."""
    x, y, z = point
    return (x, -z, y)


def to_blender_size(size):
    x, y, z = size
    return (x, z, y)


def material(name, color, roughness=0.7, metalness=0.0):
    value = bpy.data.materials.new(name)
    value.diffuse_color = (*color, 1.0)
    value.roughness = roughness
    value.metallic = metalness
    value.use_nodes = True
    bsdf = value.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metalness
    return value


def finish(obj, mat, bevel=0.0):
    obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new("Soft edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 1
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def cube(name, location, dimensions, mat, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=to_blender_point(location))
    obj = bpy.context.active_object
    obj.name = name
    obj.dimensions = to_blender_size(dimensions)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, mat, bevel)


def cylinder(name, location, radius, depth, mat, vertices=12, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=to_blender_point(location),
        rotation=rotation,
    )
    obj = bpy.context.active_object
    obj.name = name
    return finish(obj, mat, 0.04)


def cone(name, location, radius1, radius2, depth, mat, vertices=12):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius1,
        radius2=radius2,
        depth=depth,
        location=to_blender_point(location),
    )
    obj = bpy.context.active_object
    obj.name = name
    return finish(obj, mat, 0.04)


def build_lighthouse(mats):
    """A visible, low-poly coast guard lighthouse with a small pier."""
    stone = mats["Coast stone"]
    white = mats["Coast white"]
    red = mats["Coast red"]
    glass = mats["Coast glass"]
    metal = mats["Coast metal"]
    objects = [
        cylinder("Coast lighthouse foundation", (0, 0.8, 0), 8.3, 1.6, stone, 16),
        cone("Coast lighthouse tower", (0, 14.5, 0), 5.5, 3.7, 27.0, white, 16),
        cylinder("Coast lighthouse red band lower", (0, 8.0, 0), 5.25, 2.1, red, 16),
        cylinder("Coast lighthouse red band upper", (0, 21.0, 0), 4.3, 2.1, red, 16),
        cylinder("Coast lighthouse balcony", (0, 28.35, 0), 4.65, 0.75, metal, 16),
        cylinder("Coast lighthouse lantern", (0, 30.2, 0), 3.1, 3.0, glass, 12),
        cone("Coast lighthouse roof", (0, 33.15, 0), 3.8, 0.25, 2.8, red, 12),
        cylinder("Coast lighthouse mast", (0, 36.0, 0), 0.12, 3.3, metal, 8),
        cube("Coast pier deck", (23.5, 1.1, 0), (31.0, 1.3, 8.0), stone, 0.08),
        cube("Coast pier rail north", (23.5, 2.3, -3.65), (31.0, 1.2, 0.22), metal, 0.02),
        cube("Coast pier rail south", (23.5, 2.3, 3.65), (31.0, 1.2, 0.22), metal, 0.02),
    ]
    for x in (10.0, 21.0, 32.0, 39.0):
        for z in (-2.7, 2.7):
            objects.append(cylinder("Coast pier pile", (x, -1.2, z), 0.56, 4.2, stone, 10))
    return objects


def build_storm_shelter(mats):
    """A practical emergency shelter and radio mast for the storm scene."""
    concrete = mats["Storm concrete"]
    panel = mats["Storm panel"]
    glass = mats["Storm glass"]
    safety = mats["Storm safety"]
    warning = mats["Storm warning"]
    metal = mats["Storm metal"]
    objects = [
        cube("Storm shelter base", (0, 0.45, 0), (22.0, 0.9, 15.0), concrete, 0.08),
        cube("Storm shelter body", (0, 4.2, 0), (20.0, 7.0, 13.0), panel, 0.1),
        cube("Storm shelter roof", (0, 8.15, 0), (22.0, 1.15, 15.0), metal, 0.1),
        cube("Storm shelter door", (-10.08, 3.8, 0), (0.16, 5.6, 4.4), safety, 0.02),
        cube("Storm shelter window north", (10.08, 5.15, -3.7), (0.16, 2.5, 3.5), glass, 0.02),
        cube("Storm shelter window south", (10.08, 5.15, 3.7), (0.16, 2.5, 3.5), glass, 0.02),
        cube("Storm shelter warning strip", (-10.17, 6.7, 0), (0.1, 0.42, 11.0), warning, 0.02),
        cube("Storm generator body", (12.2, 1.8, -4.0), (5.8, 3.2, 4.2), safety, 0.08),
        cube("Storm generator cap", (12.2, 3.65, -4.0), (6.1, 0.55, 4.5), metal, 0.05),
        cylinder("Storm radio mast", (-15.5, 17.0, 1.2), 0.22, 33.0, metal, 8),
        cone("Storm mast beacon", (-15.5, 34.1, 1.2), 0.7, 0.36, 1.1, warning, 10),
        cylinder("Storm mast dish", (-15.5, 28.3, 1.2), 2.4, 0.35, safety, 12, rotation=(math.pi / 2, 0, 0)),
    ]
    for x in (-8.0, 8.0):
        for z in (-5.2, 5.2):
            objects.append(cylinder("Storm shelter bollard", (x, 0.75, z), 0.22, 1.5, warning, 8))
    return objects


def build_alpine_station(mats):
    """A compact mountain rescue station and heli pad for the alpine mission."""
    snow = mats["Alpine snow"]
    timber = mats["Alpine timber"]
    roof = mats["Alpine roof"]
    window = mats["Alpine window"]
    signal = mats["Alpine signal"]
    metal = mats["Alpine metal"]
    objects = [
        cylinder("Alpine station foundation", (0, 0.45, 0), 13.0, 0.9, snow, 16),
        cube("Alpine station body", (0, 4.5, 0), (22.0, 8.0, 17.0), timber, 0.12),
        cone("Alpine chalet roof", (0, 11.8, 0), 15.0, 0.16, 6.2, roof, 4),
        cone("Alpine snow roof", (0, 12.05, 0), 15.8, 0.12, 6.45, snow, 4),
        cube("Alpine station door", (-11.08, 3.9, 0), (0.16, 5.7, 4.6), signal, 0.02),
        cube("Alpine station window north", (11.08, 5.0, -4.0), (0.16, 2.5, 3.7), window, 0.02),
        cube("Alpine station window south", (11.08, 5.0, 4.0), (0.16, 2.5, 3.7), window, 0.02),
        cube("Alpine generator", (13.2, 1.8, 4.6), (5.6, 3.2, 4.2), signal, 0.08),
        cube("Alpine generator cap", (13.2, 3.65, 4.6), (5.9, 0.55, 4.5), metal, 0.05),
        cylinder("Alpine radio mast", (-12.8, 17.0, -3.4), 0.2, 32.0, metal, 8),
        cone("Alpine radio beacon", (-12.8, 33.4, -3.4), 0.66, 0.3, 1.2, signal, 10),
        cylinder("Alpine weather vane", (-12.8, 26.7, -3.4), 1.9, 0.24, signal, 10, rotation=(math.pi / 2, 0, 0)),
        cylinder("Alpine heli pad", (31.0, 0.22, -2.5), 10.5, 0.42, metal, 20),
        cube("Alpine heli H stem", (31.0, 0.5, -2.5), (1.2, 0.12, 9.2), snow, 0.01),
        cube("Alpine heli H cross", (31.0, 0.5, -2.5), (7.4, 0.12, 1.2), snow, 0.01),
    ]
    for x, z in ((-8.7, -6.0), (-8.7, 6.0), (8.7, -6.0), (8.7, 6.0)):
        objects.append(cylinder("Alpine station beacon post", (x, 1.2, z), 0.18, 2.4, signal, 8))
    return objects


def material_payload(mat):
    color = mat.diffuse_color
    return {
        "name": mat.name,
        "color": [round(float(color[0]), 4), round(float(color[1]), 4), round(float(color[2]), 4)],
        "roughness": round(float(mat.roughness), 4),
        "metalness": round(float(mat.metallic), 4),
    }


def bake_group(identifier, objects):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    buckets = {}
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        normal_matrix = evaluated.matrix_world.to_3x3().inverted().transposed()
        for triangle in mesh.loop_triangles:
            mat = obj.material_slots[triangle.material_index].material
            bucket = buckets.setdefault(mat.name, {"mat": mat.name, "pos": [], "nor": [], "idx": [], "lookup": {}})
            for loop_index in triangle.loops:
                loop = mesh.loops[loop_index]
                vertex_index = loop.vertex_index
                normal = (normal_matrix @ loop.normal).normalized()
                co = evaluated.matrix_world @ mesh.vertices[vertex_index].co
                # Blender is Z-up; the custom Three.js bake is Y-up, matching glTF's X, Z, -Y transform.
                three_co = (co.x, co.z, -co.y)
                three_normal = (normal.x, normal.z, -normal.y)
                key = (obj.name, vertex_index, *(round(value, 5) for value in three_normal))
                index = bucket["lookup"].get(key)
                if index is None:
                    index = len(bucket["pos"]) // 3
                    bucket["lookup"][key] = index
                    bucket["pos"].extend(round(float(value), 5) for value in three_co)
                    bucket["nor"].extend(round(float(value), 5) for value in three_normal)
                bucket["idx"].append(index)
        evaluated.to_mesh_clear()
    prims = []
    for bucket in buckets.values():
        bucket.pop("lookup")
        prims.append(bucket)
    return {"id": identifier, "prims": prims}


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
    mats = {
        "Coast stone": material("Coast stone", (0.43, 0.47, 0.45), 0.86, 0.04),
        "Coast white": material("Coast white", (0.88, 0.9, 0.86), 0.62, 0.06),
        "Coast red": material("Coast red", (0.72, 0.12, 0.08), 0.48, 0.08),
        "Coast glass": material("Coast glass", (0.08, 0.58, 0.68), 0.18, 0.42),
        "Coast metal": material("Coast metal", (0.16, 0.23, 0.29), 0.35, 0.72),
        "Storm concrete": material("Storm concrete", (0.25, 0.29, 0.33), 0.84, 0.08),
        "Storm panel": material("Storm panel", (0.1, 0.15, 0.2), 0.48, 0.42),
        "Storm glass": material("Storm glass", (0.08, 0.46, 0.56), 0.2, 0.5),
        "Storm safety": material("Storm safety", (0.7, 0.48, 0.08), 0.46, 0.18),
        "Storm warning": material("Storm warning", (0.76, 0.08, 0.06), 0.42, 0.14),
        "Storm metal": material("Storm metal", (0.1, 0.14, 0.19), 0.34, 0.76),
        "Alpine snow": material("Alpine snow", (0.88, 0.94, 0.98), 0.82, 0.02),
        "Alpine timber": material("Alpine timber", (0.12, 0.17, 0.2), 0.74, 0.08),
        "Alpine roof": material("Alpine roof", (0.22, 0.3, 0.38), 0.48, 0.32),
        "Alpine window": material("Alpine window", (0.16, 0.66, 0.78), 0.2, 0.46),
        "Alpine signal": material("Alpine signal", (0.92, 0.32, 0.08), 0.45, 0.16),
        "Alpine metal": material("Alpine metal", (0.2, 0.27, 0.33), 0.35, 0.72),
    }
    coast = build_lighthouse(mats)
    storm = build_storm_shelter(mats)
    alpine = build_alpine_station(mats)
    groups = [bake_group("coast", coast), bake_group("storm", storm), bake_group("alpine", alpine)]
    payload = {
        "name": "Fable Scene Landmarks",
        "source": "Blender static landmark factory",
        "materials": [material_payload(value) for value in mats.values()],
        "groups": groups,
    }
    OUT_JS.write_text(
        "// Generated by scripts/build_scene_landmarks.py. Do not hand-edit.\n"
        "const BLENDER_SCENE_LANDMARKS = " + json.dumps(payload, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    all_objects = coast + storm + alpine
    export_glb(all_objects)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
    triangles = sum(len(prim["idx"]) // 3 for group in groups for prim in group["prims"])
    print("FABLE_SCENE_LANDMARK_EXPORT", json.dumps({"blend": str(OUT_BLEND), "glb": str(OUT_GLB), "js": str(OUT_JS), "groups": len(groups), "triangles": triangles}))


if __name__ == "__main__":
    main()
