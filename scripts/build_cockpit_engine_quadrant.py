#!/usr/bin/env python3
"""Build Fable Flight's interactive throttle and mixture quadrant GLB."""

from __future__ import annotations

from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "cockpit" / "engine_control_quadrant.glb"
SOURCE = ROOT / "assets" / "cockpit" / "source" / "engine_control_quadrant.blend"


def material(name, color, roughness=0.55, metallic=0.1, emission=None):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    if emission:
        shader.inputs["Emission Color"].default_value = emission
        shader.inputs["Emission Strength"].default_value = 0.2
    return mat


def apply_material(obj, mat):
    obj.data.materials.append(mat)
    return obj


def parent(obj, target):
    obj.parent = target
    return obj


def empty(name, location=(0.0, 0.0, 0.0), target=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    return parent(obj, target) if target else obj


def box(name, dimensions, location, mat, target=None, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new("Edge radius", "BEVEL")
        mod.width = bevel
        mod.segments = 3
    apply_material(obj, mat)
    return parent(obj, target) if target else obj


def cylinder(name, radius, depth, location, mat, target=None, vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    apply_material(obj, mat)
    return parent(obj, target) if target else obj


def sphere(name, radius, location, mat, target=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=radius, location=location)
    obj = bpy.context.object
    obj.name = name
    apply_material(obj, mat)
    return parent(obj, target) if target else obj


def text_mesh(text, name, size, location, mat, target=None):
    bpy.ops.object.text_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.body = text
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.extrude = 0.012
    obj.data.bevel_depth = 0.004
    apply_material(obj, mat)
    bpy.ops.object.convert(target="MESH")
    return parent(obj, target) if target else obj


def build():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    panel = material("Wrinkle black panel", (0.018, 0.025, 0.028, 1.0), 0.82, 0.22)
    metal = material("Machined aluminium", (0.26, 0.31, 0.33, 1.0), 0.3, 0.78)
    slot = material("Control gate", (0.004, 0.007, 0.008, 1.0), 0.72, 0.12)
    white = material("Engraved white", (0.76, 0.88, 0.88, 1.0), 0.38, 0.0, (0.34, 0.62, 0.64, 1.0))
    amber = material("Caution amber", (0.96, 0.55, 0.12, 1.0), 0.34, 0.02, (0.75, 0.27, 0.03, 1.0))
    green = material("Normal green", (0.18, 0.74, 0.52, 1.0), 0.34, 0.03, (0.08, 0.54, 0.28, 1.0))
    red = material("Mixture red", (0.72, 0.045, 0.035, 1.0), 0.26, 0.05, (0.5, 0.01, 0.0, 1.0))
    black = material("Throttle black", (0.025, 0.03, 0.034, 1.0), 0.48, 0.18)

    root = empty("Fable_EngineControlQuadrant")
    box("Quadrant_Backplate", (5.4, 3.7, 0.34), (0.0, 0.0, 0.0), panel, root, 0.14)
    box("Quadrant_TopRail", (5.1, 0.22, 0.18), (0.0, 1.55, 0.22), metal, root, 0.05)
    text_mesh("ENGINE CONTROL", "Quadrant_Title", 0.26, (0.0, 1.27, 0.24), white, root)

    for x, control, label, knob_mat in ((-1.35, "Throttle", "THROTTLE", black), (1.35, "Mixture", "MIXTURE", red)):
        group = empty(f"Control_{control}", target=root)
        box(f"{control}_Track", (0.54, 2.30, 0.10), (x, -0.15, 0.24), slot, group, 0.14)
        text_mesh(label, f"{control}_Label", 0.20, (x, -1.52, 0.24), white, group)
        for index in range(6):
            y = -1.08 + index * 0.42
            tick = box(f"{control}_Tick_{index:02d}", (0.25 if index in (0, 5) else 0.16, 0.035, 0.045), (x + 0.46, y, 0.27), white, group)
            tick.data.materials.clear()
            apply_material(tick, red if control == "Mixture" and index == 0 else green if index >= 3 else amber)
        pivot = empty(f"{control}_LeverPivot", (x, 0.0, 0.0), group)
        box(f"{control}_Carriage", (0.72, 0.34, 0.22), (0.0, 0.0, 0.36), metal, pivot, 0.09)
        cylinder(f"{control}_Stem", 0.12, 0.70, (0.0, 0.0, 0.72), metal, pivot)
        if control == "Throttle":
            cylinder(f"{control}_Knob", 0.34, 0.40, (0.0, 0.0, 1.16), knob_mat, pivot, 40)
            text_mesh("T", f"{control}_KnobMark", 0.23, (0.0, 0.0, 1.39), white, pivot)
        else:
            sphere(f"{control}_Knob", 0.38, (0.0, 0.0, 1.13), knob_mat, pivot)
            text_mesh("M", f"{control}_KnobMark", 0.22, (0.0, 0.0, 1.50), white, pivot)

    for x in (-2.40, 2.40):
        for y in (-1.55, 1.55):
            cylinder(f"Quadrant_Fastener_{x}_{y}", 0.09, 0.09, (x, y, 0.23), metal, root, 20)

    SOURCE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT),
        export_format="GLB",
        export_apply=True,
        export_yup=False,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
    )
    print(f"Built {OUTPUT} ({OUTPUT.stat().st_size} bytes)")
    print(f"Source {SOURCE}")


if __name__ == "__main__":
    build()
