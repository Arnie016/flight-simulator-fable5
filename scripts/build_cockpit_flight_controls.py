#!/usr/bin/env python3
"""Build Fable Flight's interactive flap, trim, and wheel-brake pedestal GLB."""

from __future__ import annotations

from math import cos, radians, sin
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "cockpit" / "flight_controls_pedestal.glb"
SOURCE = ROOT / "assets" / "cockpit" / "source" / "flight_controls_pedestal.blend"


def material(name, color, roughness=0.55, metallic=0.1, emission=None, strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    if emission:
        shader.inputs["Emission Color"].default_value = emission
        shader.inputs["Emission Strength"].default_value = strength
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


def box(name, dimensions, location, mat, target=None, bevel=0.0, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("Edge radius", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
    apply_material(obj, mat)
    return parent(obj, target) if target else obj


def cylinder(name, radius, depth, location, mat, target=None, vertices=40, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    apply_material(obj, mat)
    return parent(obj, target) if target else obj


def torus(name, major_radius, minor_radius, location, mat, target=None, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=48,
        minor_segments=12,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    apply_material(obj, mat)
    return parent(obj, target) if target else obj


def text_mesh(text, name, size, location, mat, target=None, align="CENTER"):
    bpy.ops.object.text_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.body = text
    obj.data.align_x = align
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.extrude = 0.012
    obj.data.bevel_depth = 0.003
    apply_material(obj, mat)
    bpy.ops.object.convert(target="MESH")
    return parent(obj, target) if target else obj


def build():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    panel = material("Wrinkle black pedestal", (0.016, 0.022, 0.024, 1.0), 0.86, 0.18)
    metal = material("Brushed aluminium", (0.34, 0.39, 0.40, 1.0), 0.30, 0.82)
    dark = material("Recessed gate", (0.003, 0.006, 0.007, 1.0), 0.74, 0.12)
    rubber = material("Control rubber", (0.055, 0.065, 0.068, 1.0), 0.94, 0.02)
    white = material("Engraved white", (0.80, 0.89, 0.89, 1.0), 0.38, 0.0, (0.22, 0.48, 0.50, 1.0), 0.16)
    cyan = material("Training cyan", (0.10, 0.68, 0.72, 1.0), 0.32, 0.05, (0.04, 0.46, 0.50, 1.0), 0.30)
    amber = material("Limit amber", (0.94, 0.56, 0.10, 1.0), 0.32, 0.04, (0.68, 0.28, 0.02, 1.0), 0.28)
    red = material("Brake red", (0.70, 0.055, 0.038, 1.0), 0.35, 0.06, (0.56, 0.012, 0.004, 1.0), 0.24)

    root = empty("Fable_FlightControlsPedestal")
    box("Pedestal_Backplate", (5.4, 3.75, 0.34), (0.0, 0.0, 0.0), panel, root, 0.14)
    box("Pedestal_TopRail", (5.06, 0.20, 0.18), (0.0, 1.58, 0.22), metal, root, 0.05)
    text_mesh("FLIGHT CONTROLS", "Pedestal_Title", 0.24, (0.0, 1.29, 0.25), white, root)

    trim = empty("Control_Trim", target=root)
    text_mesh("ELEVATOR TRIM", "Trim_Label", 0.17, (-1.36, 0.97, 0.32), white, trim)
    cylinder("Trim_Bezel", 0.87, 0.14, (-1.36, -0.05, 0.24), metal, trim, 48)
    cylinder("Trim_Gate", 0.72, 0.17, (-1.36, -0.05, 0.32), dark, trim, 48)
    trim_pivot = empty("Trim_WheelPivot", (-1.36, -0.05, 0.0), trim)
    torus("Trim_Wheel", 0.52, 0.14, (0.0, 0.0, 0.54), rubber, trim_pivot)
    for index in range(12):
        angle = radians(index * 30)
        bpy.ops.mesh.primitive_cube_add(location=(0.0, 0.0, 0.0))
        rib = bpy.context.object
        rib.name = f"Trim_Rib_{index:02d}"
        rib.dimensions = (0.08, 0.26, 0.10)
        rib.location = (0.52 * sin(angle), 0.52 * cos(angle), 0.62)
        rib.rotation_euler.z = -angle
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        apply_material(rib, metal)
        parent(rib, trim_pivot)
    box("Trim_Index", (0.12, 0.35, 0.07), (0.0, 0.53, 0.68), cyan, trim_pivot, 0.025)
    text_mesh("NOSE DOWN", "Trim_Down", 0.12, (-1.36, -1.10, 0.30), white, trim)
    text_mesh("NOSE UP", "Trim_Up", 0.12, (-1.36, 0.70, 0.30), white, trim)
    text_mesh("-25", "Trim_Min", 0.11, (-2.22, -0.42, 0.30), amber, trim)
    text_mesh("+25", "Trim_Max", 0.11, (-0.50, -0.42, 0.30), amber, trim)

    flaps = empty("Control_Flaps", target=root)
    text_mesh("FLAPS", "Flaps_Label", 0.19, (0.72, 0.98, 0.32), white, flaps)
    box("Flaps_Guard", (1.18, 2.36, 0.15), (0.72, -0.20, 0.25), metal, flaps, 0.12)
    box("Flaps_Gate", (0.82, 2.05, 0.19), (0.72, -0.20, 0.35), dark, flaps, 0.10)
    for index, (label, y) in enumerate((("0", 0.57), ("50", -0.20), ("FULL", -0.97))):
        box(f"Flaps_Notch_{index}", (0.52, 0.08, 0.07), (0.72, y, 0.49), cyan if index == 0 else amber, flaps, 0.02)
        text_mesh(label, f"Flaps_Mark_{index}", 0.13, (1.53, y, 0.31), white, flaps, align="LEFT")
    flap_pivot = empty("Flaps_LeverPivot", (0.72, 0.57, 0.0), flaps)
    box("Flaps_LeverStem", (0.18, 0.55, 0.18), (0.0, 0.03, 0.62), metal, flap_pivot, 0.05, (radians(-10), 0.0, 0.0))
    box("Flaps_LeverKnob", (0.52, 0.30, 0.30), (0.0, 0.22, 0.75), rubber, flap_pivot, 0.10)
    text_mesh("F", "Flaps_KnobMark", 0.13, (0.0, 0.22, 0.92), white, flap_pivot)

    brakes = empty("Control_Brakes", target=root)
    text_mesh("WHEEL BRAKE", "Brakes_Label", 0.16, (2.05, 0.98, 0.32), white, brakes)
    box("Brakes_Guard", (1.05, 2.36, 0.15), (2.05, -0.20, 0.25), metal, brakes, 0.12)
    box("Brakes_Gate", (0.73, 2.04, 0.19), (2.05, -0.20, 0.35), dark, brakes, 0.10)
    brake_pivot = empty("Brakes_PedalPivot", (2.05, -0.16, 0.0), brakes)
    box("Brakes_Paddle", (0.62, 1.04, 0.28), (0.0, 0.0, 0.56), rubber, brake_pivot, 0.12, (radians(-7), 0.0, 0.0))
    box("Brakes_PaddleStripe", (0.42, 0.10, 0.06), (0.0, 0.24, 0.73), red, brake_pivot, 0.025)
    text_mesh("HOLD", "Brakes_Hold", 0.12, (2.05, -0.92, 0.30), red, brakes)
    text_mesh("RELEASE", "Brakes_Release", 0.10, (2.05, 0.59, 0.30), white, brakes)

    for x in (-2.42, 2.42):
        for y in (-1.61, 1.61):
            cylinder(f"Pedestal_Fastener_{x}_{y}", 0.09, 0.09, (x, y, 0.23), metal, root, 20)

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
