#!/usr/bin/env python3
"""Build Fable Flight's named-part primary instrument GLB with Blender 5.1."""

from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "cockpit" / "primary_instrument_pack.glb"
SOURCE = ROOT / "assets" / "cockpit" / "source" / "primary_instrument_pack.blend"


def material(name: str, color: tuple[float, float, float, float], roughness: float, metallic: float, emission: tuple[float, float, float, float] | None = None):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Metallic"].default_value = metallic
    if emission:
        principled.inputs["Emission Color"].default_value = emission
        principled.inputs["Emission Strength"].default_value = 0.18
    return mat


def apply_material(obj, mat):
    obj.data.materials.append(mat)
    return obj


def parent_keep(obj, parent):
    obj.parent = parent
    return obj


def box(name, dimensions, location, mat, parent=None, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("Edge radius", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    apply_material(obj, mat)
    return parent_keep(obj, parent) if parent else obj


def cylinder(name, radius, depth, location, mat, parent=None, vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    apply_material(obj, mat)
    return parent_keep(obj, parent) if parent else obj


def torus(name, major_radius, minor_radius, location, mat, parent=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=major_radius, minor_radius=minor_radius, major_segments=48, minor_segments=10, location=location)
    obj = bpy.context.object
    obj.name = name
    apply_material(obj, mat)
    return parent_keep(obj, parent) if parent else obj


def text_mesh(text, name, size, location, mat, parent=None, align="CENTER"):
    bpy.ops.object.text_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.body = text
    obj.data.align_x = align
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.extrude = 0.012
    obj.data.bevel_depth = 0.004
    apply_material(obj, mat)
    bpy.ops.object.convert(target="MESH")
    return parent_keep(obj, parent) if parent else obj


def empty(name, location, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    return parent_keep(obj, parent) if parent else obj


def semicircle(name, radius, upper, location, mat, parent):
    start, end = (0.0, math.pi) if upper else (math.pi, math.tau)
    vertices = [(0.0, 0.0, 0.0)]
    segments = 40
    for index in range(segments + 1):
        angle = start + (end - start) * index / segments
        vertices.append((math.cos(angle) * radius, math.sin(angle) * radius, 0.0))
    faces = [(0, index + 1, index + 2) for index in range(segments)]
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    apply_material(obj, mat)
    parent_keep(obj, parent)
    return obj


def add_ticks(cx, parent, mat, count=12):
    for index in range(count):
        angle = math.tau * index / count
        length = 0.22 if index % 3 == 0 else 0.13
        tick = box(
            f"{parent.name}_Tick_{index:02d}",
            (0.045, length, 0.025),
            (cx + math.sin(angle) * 1.00, math.cos(angle) * 1.00, 0.205),
            mat,
            parent,
        )
        tick.rotation_euler.z = -angle


def add_needle(name, cx, color, parent, needle_mat):
    pivot = empty(name, (cx, 0.0, 0.235), parent)
    needle = box(name.replace("Pivot", "Pointer"), (0.075, 0.86, 0.035), (0.0, 0.37, 0.02), needle_mat, pivot, 0.025)
    needle.data.materials.clear()
    apply_material(needle, color)
    cylinder(name.replace("Pivot", "Hub"), 0.15, 0.07, (0.0, 0.0, 0.04), needle_mat, pivot, 24)
    return pivot


def add_dial(root, dial_id, label, unit, cx, face_mat, bezel_mat, ink_mat, needle_color, tick_count=12):
    group = empty(f"Instrument_{dial_id}", (0.0, 0.0, 0.0), root)
    cylinder(f"{dial_id}_Case", 1.34, 0.16, (cx, 0.0, 0.09), bezel_mat, group)
    cylinder(f"{dial_id}_Face", 1.17, 0.045, (cx, 0.0, 0.19), face_mat, group)
    torus(f"{dial_id}_Bezel", 1.24, 0.105, (cx, 0.0, 0.23), bezel_mat, group)
    add_ticks(cx, group, ink_mat, tick_count)
    text_mesh(label, f"{dial_id}_Label", 0.19, (cx, -0.67, 0.235), ink_mat, group)
    text_mesh(unit, f"{dial_id}_Unit", 0.12, (cx, -0.91, 0.235), ink_mat, group)
    return group, add_needle(f"{dial_id}_NeedlePivot", cx, needle_color, group, bezel_mat)


def build():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    panel_mat = material("Panel powder coat", (0.018, 0.026, 0.031, 1.0), 0.78, 0.28)
    bezel_mat = material("Machined bezel", (0.10, 0.13, 0.15, 1.0), 0.24, 0.82)
    face_mat = material("Instrument face", (0.006, 0.011, 0.014, 1.0), 0.62, 0.12)
    ink_mat = material("Luminous markings", (0.72, 0.88, 0.88, 1.0), 0.38, 0.0, (0.40, 0.74, 0.76, 1.0))
    white_mat = material("Needle white", (0.92, 0.96, 0.92, 1.0), 0.30, 0.05, (0.55, 0.70, 0.61, 1.0))
    amber_mat = material("Needle amber", (1.0, 0.38, 0.10, 1.0), 0.26, 0.05, (1.0, 0.12, 0.02, 1.0))
    sky_mat = material("Attitude sky", (0.12, 0.42, 0.72, 1.0), 0.50, 0.04, (0.04, 0.19, 0.42, 1.0))
    earth_mat = material("Attitude earth", (0.46, 0.23, 0.09, 1.0), 0.70, 0.02)

    root = empty("Fable_PrimaryInstruments", (0.0, 0.0, 0.0))
    box("Instrument_Backplate", (14.9, 3.35, 0.26), (0.0, 0.0, -0.04), panel_mat, root, 0.12)
    for x in (-7.15, 7.15):
        for y in (-1.35, 1.35):
            cylinder(f"Panel_Fastener_{x}_{y}", 0.08, 0.08, (x, y, 0.13), bezel_mat, root, 20)

    add_dial(root, "Airspeed", "AIRSPEED", "KT", -5.75, face_mat, bezel_mat, ink_mat, amber_mat, 16)

    attitude = empty("Instrument_Attitude", (0.0, 0.0, 0.0), root)
    cylinder("Attitude_Case", 1.34, 0.16, (-2.88, 0.0, 0.09), bezel_mat, attitude)
    cylinder("Attitude_Face", 1.17, 0.045, (-2.88, 0.0, 0.19), face_mat, attitude)
    roll = empty("Attitude_RollPivot", (-2.88, 0.0, 0.225), attitude)
    pitch = empty("Attitude_PitchSlide", (0.0, 0.0, 0.0), roll)
    semicircle("Attitude_Sky", 1.08, True, (0.0, 0.0, 0.0), sky_mat, pitch)
    semicircle("Attitude_Earth", 1.08, False, (0.0, 0.0, 0.0), earth_mat, pitch)
    box("Attitude_Horizon", (1.95, 0.045, 0.03), (0.0, 0.0, 0.025), ink_mat, pitch)
    torus("Attitude_Bezel", 1.24, 0.105, (-2.88, 0.0, 0.23), bezel_mat, attitude)
    box("Attitude_Aircraft_Left", (0.58, 0.055, 0.045), (-3.24, -0.08, 0.27), ink_mat, attitude)
    box("Attitude_Aircraft_Right", (0.58, 0.055, 0.045), (-2.52, -0.08, 0.27), ink_mat, attitude)
    text_mesh("ATTITUDE", "Attitude_Label", 0.16, (-2.88, -0.87, 0.25), ink_mat, attitude)

    add_dial(root, "Altimeter", "ALT", "M", 0.0, face_mat, bezel_mat, ink_mat, white_mat, 10)
    add_dial(root, "VSI", "VERT SPEED", "M/S", 2.88, face_mat, bezel_mat, ink_mat, white_mat, 12)

    heading = empty("Instrument_Heading", (0.0, 0.0, 0.0), root)
    cylinder("Heading_Case", 1.34, 0.16, (5.75, 0.0, 0.09), bezel_mat, heading)
    cylinder("Heading_Face", 1.17, 0.045, (5.75, 0.0, 0.19), face_mat, heading)
    card = empty("Heading_CardPivot", (5.75, 0.0, 0.235), heading)
    for label, x, y in (("N", 0.0, 0.76), ("E", 0.76, 0.0), ("S", 0.0, -0.76), ("W", -0.76, 0.0)):
        text_mesh(label, f"Heading_{label}", 0.27, (x, y, 0.0), amber_mat if label == "N" else ink_mat, card)
    for index in range(12):
        angle = math.tau * index / 12
        tick = box(f"Heading_Tick_{index:02d}", (0.035, 0.13, 0.025), (math.sin(angle) * 0.98, math.cos(angle) * 0.98, 0.0), ink_mat, card)
        tick.rotation_euler.z = -angle
    torus("Heading_Bezel", 1.24, 0.105, (5.75, 0.0, 0.23), bezel_mat, heading)
    box("Heading_Lubber", (0.07, 0.28, 0.04), (5.75, 0.88, 0.27), amber_mat, heading, 0.02)
    text_mesh("HEADING", "Heading_Label", 0.16, (5.75, -0.87, 0.25), ink_mat, heading)

    root.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.view_layer.objects.active = root
    root.select_set(True)

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
