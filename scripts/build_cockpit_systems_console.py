#!/usr/bin/env python3
"""Build Fable Flight's interactive ignition and electrical systems console GLB."""

from __future__ import annotations

from math import radians
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "cockpit" / "flight_systems_console.glb"
SOURCE = ROOT / "assets" / "cockpit" / "source" / "flight_systems_console.blend"


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


def cylinder(name, radius, depth, location, mat, target=None, vertices=40):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
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

    panel = material("Wrinkle black panel", (0.017, 0.023, 0.026, 1.0), 0.84, 0.2)
    metal = material("Machined aluminium", (0.29, 0.34, 0.36, 1.0), 0.28, 0.8)
    dark = material("Switch gate", (0.004, 0.007, 0.008, 1.0), 0.7, 0.15)
    white = material("Engraved white", (0.78, 0.88, 0.88, 1.0), 0.36, 0.0, (0.24, 0.48, 0.5, 1.0), 0.18)
    amber = material("Starter amber", (0.92, 0.47, 0.08, 1.0), 0.32, 0.04, (0.72, 0.22, 0.02, 1.0), 0.28)
    green = material("System green", (0.12, 0.68, 0.39, 1.0), 0.3, 0.04, (0.05, 0.56, 0.22, 1.0), 0.35)
    red = material("Warning red", (0.68, 0.045, 0.035, 1.0), 0.3, 0.04, (0.55, 0.01, 0.0, 1.0), 0.35)
    rocker = material("Guarded rocker", (0.12, 0.15, 0.16, 1.0), 0.44, 0.32)
    key = material("Ignition key", (0.35, 0.39, 0.4, 1.0), 0.24, 0.84)

    root = empty("Fable_FlightSystemsConsole")
    box("Console_Backplate", (5.8, 3.65, 0.34), (0.0, 0.0, 0.0), panel, root, 0.14)
    box("Console_TopRail", (5.48, 0.20, 0.18), (0.0, 1.55, 0.22), metal, root, 0.05)
    text_mesh("FLIGHT SYSTEMS", "Console_Title", 0.25, (0.0, 1.27, 0.24), white, root)

    ignition = empty("Control_Ignition", target=root)
    text_mesh("IGNITION", "Ignition_Label", 0.19, (-1.64, 1.00, 0.42), white, ignition)
    cylinder("Ignition_Bezel", 0.86, 0.13, (-1.64, -0.12, 0.24), metal, ignition, 48)
    cylinder("Ignition_Gate", 0.68, 0.16, (-1.64, -0.12, 0.32), dark, ignition, 48)
    pivot = empty("Ignition_KnobPivot", (-1.64, -0.12, 0.0), ignition)
    cylinder("Ignition_Knob", 0.48, 0.30, (0.0, 0.0, 0.46), rocker, pivot, 44)
    box("Ignition_Key", (0.18, 0.78, 0.18), (0.0, 0.17, 0.65), key, pivot, 0.05)
    box("Ignition_Pointer", (0.08, 0.36, 0.07), (0.0, 0.54, 0.68), amber, pivot, 0.025)
    ignition_marks = [
        ("OFF", -2.48, -1.08),
        ("L", -2.55, 0.10),
        ("R", -2.25, 0.72),
        ("BOTH", -1.03, 0.72),
        ("START", -0.55, -1.02),
    ]
    for index, (label, x, y) in enumerate(ignition_marks):
        text_mesh(label, f"Ignition_Mark_{index:02d}", 0.15 if len(label) > 1 else 0.19, (x, y, 0.42), amber if label == "START" else white, ignition)

    switch_specs = [
        ("Battery", "BAT", 0.30, green),
        ("Alternator", "ALT", 1.25, green),
        ("Pitot", "PITOT", 2.20, amber),
    ]
    for control, label, x, lamp_mat in switch_specs:
        group = empty(f"Control_{control}", target=root)
        text_mesh(label, f"{control}_Label", 0.18, (x, 0.93, 0.25), white, group)
        cylinder(f"{control}_Lamp", 0.13, 0.09, (x, 0.56, 0.31), lamp_mat, group, 28)
        box(f"{control}_Guard", (0.66, 1.62, 0.13), (x, -0.24, 0.25), metal, group, 0.12)
        box(f"{control}_Gate", (0.46, 1.36, 0.18), (x, -0.24, 0.34), dark, group, 0.09)
        switch_pivot = empty(f"{control}_SwitchPivot", (x, -0.24, 0.0), group)
        box(f"{control}_Rocker", (0.38, 0.78, 0.30), (0.0, 0.0, 0.52), rocker, switch_pivot, 0.08, (radians(-8), 0.0, 0.0))
        box(f"{control}_RockerStripe", (0.22, 0.07, 0.05), (0.0, 0.20, 0.70), lamp_mat, switch_pivot, 0.02)
        text_mesh("ON", f"{control}_On", 0.11, (x, 0.30, 0.28), white, group)
        text_mesh("OFF", f"{control}_Off", 0.11, (x, -1.08, 0.28), white, group)

    for x in (-2.62, 2.62):
        for y in (-1.56, 1.56):
            cylinder(f"Console_Fastener_{x}_{y}", 0.09, 0.09, (x, y, 0.23), metal, root, 20)

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
