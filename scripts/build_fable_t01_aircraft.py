"""Build the Fable T-01 browser-aircraft handoff in Blender.

This is an original, deterministic trainer airframe with named animation
parts. It is a visual handoff asset, not a replacement for the proven
Three.js flight model.

Run with:
  /Applications/Blender.app/Contents/MacOS/Blender --factory-startup --background --python scripts/build_fable_t01_aircraft.py
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


PROJECT = Path(__file__).resolve().parents[1]
ASSET_DIR = PROJECT / "assets" / "aircraft"
ARTIFACT_DIR = PROJECT / "artifacts"
OUT_BLEND = ASSET_DIR / "fable-t01-aircraft.blend"
OUT_LOD0 = ASSET_DIR / "fable-t01-aircraft.glb"
OUT_LOD1 = ASSET_DIR / "fable-t01-aircraft-lod1.glb"
OUT_LOD2 = ASSET_DIR / "fable-t01-aircraft-lod2.glb"
OUT_COLLISION = ASSET_DIR / "fable-t01-aircraft-collision.glb"
OUT_MANIFEST = ASSET_DIR / "fable-t01-aircraft.manifest.json"
OUT_PREVIEW = ARTIFACT_DIR / "fable-t01-aircraft-handoff.png"

REQUIRED_LOD0_NODES = [
    "FableT01_Root",
    "LOD0_Fuselage",
    "LOD0_Cowling",
    "LOD0_Canopy",
    "LOD0_Wing_L",
    "LOD0_Wing_R",
    "LOD0_Aileron_L",
    "LOD0_Aileron_R",
    "LOD0_Flap_L",
    "LOD0_Flap_R",
    "LOD0_Elevator_L",
    "LOD0_Elevator_R",
    "LOD0_Rudder",
    "LOD0_Propeller_Root",
    "LOD0_Propeller_Blade_A",
    "LOD0_Propeller_Blade_B",
    "LOD0_Gear_Nose",
    "LOD0_Gear_Main_L",
    "LOD0_Gear_Main_R",
    "LOD0_Wheel_Nose",
    "LOD0_Wheel_Main_L",
    "LOD0_Wheel_Main_R",
    "LOD0_Instrument_Panel",
    "SOCKET_Camera_Cockpit",
    "SOCKET_Camera_Chase",
    "SOCKET_Cargo_Hardpoint",
    "SOCKET_Landing_Light",
]


def make_collection(name: str) -> bpy.types.Collection:
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    return collection


def move_to_collection(obj: bpy.types.Object, collection: bpy.types.Collection) -> None:
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)


def make_material(name, color, roughness, metalness=0.0, emission=None):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1.0)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metalness
        if emission:
            bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
            bsdf.inputs["Emission Strength"].default_value = 4.0
    material.roughness = roughness
    material.metallic = metalness
    return material


def add_root(name, collection, extras):
    root = bpy.data.objects.new(name, None)
    root.empty_display_type = "PLAIN_AXES"
    root.empty_display_size = 0.8
    collection.objects.link(root)
    for key, value in extras.items():
        root[key] = value
    return root


def finish_primitive(obj, name, collection, parent, material=None, role=None):
    obj.name = name
    move_to_collection(obj, collection)
    obj.parent = parent
    if material and getattr(obj, "data", None):
        obj.data.materials.append(material)
    if role:
        obj["fable_role"] = role
    return obj


def add_cube(name, location, dimensions, material, collection, parent, role=None, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = finish_primitive(bpy.context.active_object, name, collection, parent, material, role)
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("Production edge radius", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def add_uv_sphere(name, location, scale, material, collection, parent, segments=20, rings=12, role=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = finish_primitive(bpy.context.active_object, name, collection, parent, material, role)
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def add_cylinder(name, location, radius, depth, material, collection, parent, vertices=16, rotation=(0, 0, 0), role=None):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    return finish_primitive(bpy.context.active_object, name, collection, parent, material, role)


def add_cone(name, location, radius1, radius2, depth, material, collection, parent, vertices=16, rotation=(0, 0, 0), role=None):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius1,
        radius2=radius2,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    return finish_primitive(bpy.context.active_object, name, collection, parent, material, role)


def add_cylinder_between(name, start, end, radius, material, collection, parent, vertices=12, role=None):
    start_v, end_v = Vector(start), Vector(end)
    direction = end_v - start_v
    obj = add_cylinder(
        name,
        (start_v + end_v) * 0.5,
        radius,
        direction.length,
        material,
        collection,
        parent,
        vertices=vertices,
        role=role,
    )
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(direction.normalized())
    return obj


def mesh_object(name, vertices, faces, material, collection, parent, location=(0, 0, 0), smooth=False, role=None):
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    mesh.validate(verbose=False)
    mesh.update(calc_edges=True)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.parent = parent
    obj.location = location
    if role:
        obj["fable_role"] = role
    if smooth:
        for polygon in mesh.polygons:
            polygon.use_smooth = True
    return obj


def extrude_xy(name, corners, thickness, material, collection, parent, location=(0, 0, 0), role=None):
    """Extrude an XY outline along Z, enforcing outward face winding."""
    area = sum(
        corners[i][0] * corners[(i + 1) % len(corners)][1]
        - corners[(i + 1) % len(corners)][0] * corners[i][1]
        for i in range(len(corners))
    )
    outline = list(corners if area > 0 else reversed(corners))
    half = thickness * 0.5
    vertices = [(x, y, z + half) for x, y, z in outline] + [(x, y, z - half) for x, y, z in outline]
    count = len(outline)
    faces = [tuple(range(count)), tuple(reversed(range(count, count * 2)))]
    for i in range(count):
        j = (i + 1) % count
        faces.append((i, j, count + j, count + i))
    return mesh_object(name, vertices, faces, material, collection, parent, location, role=role)


def extrude_yz(name, outline, thickness, material, collection, parent, location=(0, 0, 0), role=None):
    """Extrude a YZ outline along X, enforcing outward face winding."""
    area = sum(
        outline[i][0] * outline[(i + 1) % len(outline)][1]
        - outline[(i + 1) % len(outline)][0] * outline[i][1]
        for i in range(len(outline))
    )
    points = list(outline if area > 0 else reversed(outline))
    half = thickness * 0.5
    vertices = [(half, y, z) for y, z in points] + [(-half, y, z) for y, z in points]
    count = len(points)
    faces = [tuple(range(count)), tuple(reversed(range(count, count * 2)))]
    for i in range(count):
        j = (i + 1) % count
        faces.append((i, j, count + j, count + i))
    return mesh_object(name, vertices, faces, material, collection, parent, location, role=role)


def add_tapered_body(name, stations, segments, material, collection, parent, role=None):
    vertices = []
    for y, radius_x, radius_z, center_z in stations:
        for index in range(segments):
            angle = 2 * math.pi * index / segments
            vertices.append((math.cos(angle) * radius_x, y, center_z + math.sin(angle) * radius_z))
    faces = []
    for ring in range(len(stations) - 1):
        offset = ring * segments
        next_offset = (ring + 1) * segments
        for index in range(segments):
            nxt = (index + 1) % segments
            faces.append((offset + index, offset + nxt, next_offset + nxt, next_offset + index))
    faces.append(tuple(reversed(range(segments))))
    last = (len(stations) - 1) * segments
    faces.append(tuple(last + index for index in range(segments)))
    return mesh_object(name, vertices, faces, material, collection, parent, smooth=True, role=role)


def mark_hinge(obj, axis_blender, axis_three, minimum, maximum):
    obj["fable_control_surface"] = True
    obj["fable_hinge_axis_blender"] = axis_blender
    obj["fable_hinge_axis_three"] = axis_three
    obj["fable_limit_deg_min"] = minimum
    obj["fable_limit_deg_max"] = maximum


def smart_uv(objects):
    for obj in objects:
        if obj.type != "MESH" or not obj.data.polygons:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        try:
            bpy.ops.object.mode_set(mode="EDIT")
            bpy.ops.mesh.select_all(action="SELECT")
            try:
                bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
            except TypeError:
                bpy.ops.uv.smart_project()
            bpy.ops.object.mode_set(mode="OBJECT")
        finally:
            if obj.mode != "OBJECT":
                bpy.ops.object.mode_set(mode="OBJECT")
        obj["fable_uv_set"] = "UVMap"


def build_lod0(collection, materials):
    root = add_root(
        "FableT01_Root",
        collection,
        {
            "fable_asset": "Fable T-01 Trainer",
            "fable_format_version": "1.0",
            "fable_units": "meters",
            "fable_forward_blender": "+Y",
            "fable_forward_three": "-Z",
            "fable_up_blender": "+Z",
            "fable_up_three": "+Y",
            "fable_physics_authority": "existing Three.js aircraft",
            "fable_lod_range_m": "0-120",
        },
    )
    objects = [root]
    paint, accent = materials["Paint white"], materials["Signal red"]
    metal, rubber, glass = materials["Brushed metal"], materials["Rubber"], materials["Canopy glass"]
    dark, interior, light = materials["Propeller"], materials["Cockpit"], materials["Lamp"]

    body = add_tapered_body(
        "LOD0_Fuselage",
        [
            (3.45, 0.38, 0.42, 0.06),
            (2.75, 0.66, 0.68, 0.08),
            (1.15, 0.76, 0.78, 0.10),
            (-1.45, 0.64, 0.68, 0.12),
            (-2.85, 0.36, 0.46, 0.18),
            (-4.05, 0.08, 0.12, 0.24),
        ],
        24,
        paint,
        collection,
        root,
        role="airframe",
    )
    objects.append(body)
    objects.append(add_cylinder("LOD0_Cowling", (0, 3.22, 0.07), 0.63, 0.82, accent, collection, root, 24, (math.pi / 2, 0, 0), "engine_cowling"))
    objects.append(add_cone("LOD0_Spinner", (0, 3.82, 0.07), 0.24, 0.02, 0.46, metal, collection, root, 20, (-math.pi / 2, 0, 0), "spinner"))
    canopy = add_uv_sphere("LOD0_Canopy", (0, 0.52, 0.72), (0.58, 1.38, 0.56), glass, collection, root, 24, 14, "canopy")
    objects.append(canopy)

    for side, label in ((-1, "L"), (1, "R")):
        inner, outer = side * 0.42, side * 5.72
        wing = extrude_xy(
            f"LOD0_Wing_{label}",
            [(inner, 1.22, 0.22), (inner, -0.34, 0.22), (outer, -0.16, 0.47), (outer, 0.72, 0.47)],
            0.16,
            paint,
            collection,
            root,
            role="fixed_wing",
        )
        objects.append(wing)
        tip_x = side * 5.58
        objects.append(add_cube(f"LOD0_Wingtip_{label}", (tip_x, 0.22, 0.47), (0.28, 0.88, 0.20), accent, collection, root, "wingtip", 0.04))

        flap_x = side * 1.78
        flap = extrude_xy(
            f"LOD0_Flap_{label}",
            [(-side * 1.05, 0.02, 0), (-side * 1.05, -0.52, 0), (side * 1.05, -0.46, side * 0.10), (side * 1.05, 0.02, side * 0.10)],
            0.11,
            materials["Control surface"],
            collection,
            root,
            location=(flap_x, -0.35, 0.29 + abs(flap_x) * 0.045),
            role="flap",
        )
        mark_hinge(flap, "X", "X", -2, 30)
        objects.append(flap)

        aileron_x = side * 4.18
        aileron = extrude_xy(
            f"LOD0_Aileron_{label}",
            [(-side * 1.02, 0.02, 0), (-side * 1.02, -0.44, 0), (side * 1.02, -0.36, side * 0.09), (side * 1.02, 0.02, side * 0.09)],
            0.10,
            materials["Control surface"],
            collection,
            root,
            location=(aileron_x, -0.23, 0.40 + (abs(aileron_x) - 3.1) * 0.045),
            role="aileron",
        )
        mark_hinge(aileron, "X", "X", -22, 22)
        objects.append(aileron)

        tail_inner, tail_outer = side * 0.22, side * 1.92
        objects.append(
            extrude_xy(
                f"LOD0_Horizontal_Stabilizer_{label}",
                [(tail_inner, -2.55, 0.42), (tail_inner, -3.08, 0.42), (tail_outer, -3.16, 0.48), (tail_outer, -2.72, 0.48)],
                0.12,
                paint,
                collection,
                root,
                role="fixed_tail",
            )
        )
        elevator_x = side * 1.02
        elevator = extrude_xy(
            f"LOD0_Elevator_{label}",
            [(-side * 0.78, 0.0, 0), (-side * 0.78, -0.48, 0), (side * 0.78, -0.42, 0.03), (side * 0.78, 0.0, 0.03)],
            0.09,
            materials["Control surface"],
            collection,
            root,
            location=(elevator_x, -3.10, 0.46),
            role="elevator",
        )
        mark_hinge(elevator, "X", "X", -24, 20)
        objects.append(elevator)

    objects.append(extrude_yz("LOD0_Vertical_Stabilizer", [(-2.65, 0.45), (-3.40, 2.05), (-3.52, 0.55)], 0.13, accent, collection, root, role="fixed_tail"))
    rudder = extrude_yz(
        "LOD0_Rudder",
        [(0.0, -0.74), (-0.48, -0.64), (-0.47, 0.65), (0.0, 0.77)],
        0.10,
        materials["Control surface"],
        collection,
        root,
        location=(0, -3.48, 1.25),
        role="rudder",
    )
    mark_hinge(rudder, "Z", "Y", -25, 25)
    objects.append(rudder)

    prop_root = add_root(
        "LOD0_Propeller_Root",
        collection,
        {"fable_role": "propeller_pivot", "fable_spin_axis_blender": "Y", "fable_spin_axis_three": "Z"},
    )
    prop_root.parent = root
    prop_root.location = (0, 3.94, 0.07)
    objects.append(prop_root)
    blade_a = add_cube("LOD0_Propeller_Blade_A", (0, 0, 0.73), (0.16, 0.08, 1.42), dark, collection, prop_root, "propeller_blade", 0.05)
    blade_b = add_cube("LOD0_Propeller_Blade_B", (0, 0, -0.73), (0.16, 0.08, 1.42), dark, collection, prop_root, "propeller_blade", 0.05)
    objects.extend([blade_a, blade_b])

    gear_specs = [
        ("Nose", (0, 2.42, -0.08), (0, 2.42, -0.82)),
        ("Main_L", (-1.58, -0.02, 0.08), (-1.72, -0.08, -0.82)),
        ("Main_R", (1.58, -0.02, 0.08), (1.72, -0.08, -0.82)),
    ]
    for label, start, end in gear_specs:
        leg = add_cylinder_between(f"LOD0_Gear_{label}", start, end, 0.055, metal, collection, root, 12, "landing_gear")
        wheel = add_cylinder(
            f"LOD0_Wheel_{label}",
            end,
            0.27 if label == "Nose" else 0.31,
            0.18,
            rubber,
            collection,
            root,
            16,
            (0, math.pi / 2, 0),
            "wheel",
        )
        wheel["fable_spin_axis_blender"] = "X"
        wheel["fable_spin_axis_three"] = "X"
        objects.extend([leg, wheel])

    panel = add_cube("LOD0_Instrument_Panel", (0, 1.25, 0.60), (1.12, 0.18, 0.36), interior, collection, root, "cockpit_panel", 0.05)
    seat = add_cube("LOD0_Pilot_Seat", (0, -0.25, 0.34), (0.62, 0.76, 0.64), interior, collection, root, "cockpit_seat", 0.08)
    yoke = add_cylinder("LOD0_Control_Yoke", (0, 0.82, 0.48), 0.12, 0.07, dark, collection, root, 16, (math.pi / 2, 0, 0), "cockpit_control")
    objects.extend([panel, seat, yoke])
    for label, location, color in (
        ("Nav_L", (-5.78, 0.28, 0.52), materials["Nav red"]),
        ("Nav_R", (5.78, 0.28, 0.52), materials["Nav green"]),
        ("Strobe", (0, -3.18, 2.08), light),
    ):
        objects.append(add_uv_sphere(f"LOD0_{label}", location, (0.08, 0.08, 0.08), color, collection, root, 10, 6, "navigation_light"))

    sockets = {
        "SOCKET_Camera_Cockpit": (0, 0.25, 1.02),
        "SOCKET_Camera_Chase": (0, -8.2, 3.2),
        "SOCKET_Cargo_Hardpoint": (0, -0.55, -0.44),
        "SOCKET_Landing_Light": (0, 3.24, -0.24),
    }
    for name, location in sockets.items():
        socket = add_root(name, collection, {"fable_role": "socket", "fable_space": "aircraft_local"})
        socket.parent = root
        socket.location = location
        socket.empty_display_type = "CUBE"
        socket.empty_display_size = 0.16
        objects.append(socket)

    smart_uv(objects)
    return root, objects


def build_simple_lod(collection, materials, level, segments, range_m):
    root = add_root(
        f"FableT01_LOD{level}_Root",
        collection,
        {
            "fable_asset": "Fable T-01 Trainer",
            "fable_units": "meters",
            "fable_forward_three": "-Z",
            "fable_lod": level,
            "fable_lod_range_m": range_m,
        },
    )
    objects = [root]
    paint, accent, dark = materials["Paint white"], materials["Signal red"], materials["Propeller"]
    objects.append(
        add_tapered_body(
            f"LOD{level}_Fuselage",
            [(3.45, 0.38, 0.42, 0.06), (2.6, 0.66, 0.68, 0.08), (0.8, 0.74, 0.76, 0.10), (-1.7, 0.58, 0.62, 0.14), (-4.05, 0.08, 0.12, 0.24)],
            segments,
            paint,
            collection,
            root,
            role="airframe_lod",
        )
    )
    objects.extend(
        [
            extrude_xy(f"LOD{level}_Wing", [(-5.72, 0.72, 0.47), (-5.72, -0.55, 0.47), (5.72, -0.55, 0.47), (5.72, 0.72, 0.47)], 0.15, paint, collection, root, role="wing_lod"),
            extrude_xy(f"LOD{level}_Tailplane", [(-1.92, -2.72, 0.48), (-1.92, -3.55, 0.48), (1.92, -3.55, 0.48), (1.92, -2.72, 0.48)], 0.11, paint, collection, root, role="tail_lod"),
            extrude_yz(f"LOD{level}_Fin", [(-2.65, 0.45), (-3.43, 2.05), (-3.95, 0.52)], 0.12, accent, collection, root, role="tail_lod"),
            add_cube(f"LOD{level}_Propeller", (0, 3.94, 0.07), (0.12, 0.06, 2.70), dark, collection, root, "propeller_lod", 0.03),
        ]
    )
    if level == 1:
        objects.append(add_uv_sphere(f"LOD{level}_Canopy", (0, 0.52, 0.72), (0.58, 1.38, 0.56), materials["Canopy glass"], collection, root, 12, 8, "canopy_lod"))
        for label, location in (("Nose", (0, 2.42, -0.82)), ("Main_L", (-1.72, -0.08, -0.82)), ("Main_R", (1.72, -0.08, -0.82))):
            objects.append(add_cylinder(f"LOD{level}_Wheel_{label}", location, 0.27, 0.16, materials["Rubber"], collection, root, 10, (0, math.pi / 2, 0), "wheel_lod"))
    smart_uv(objects)
    return root, objects


def build_collision(collection):
    root = add_root(
        "FableT01_Collision_Root",
        collection,
        {
            "fable_asset": "Fable T-01 Trainer collision proxies",
            "fable_units": "meters",
            "fable_collision_only": True,
            "fable_physics_authority": "existing Three.js aircraft",
        },
    )
    material = make_material("Collision proxy", (0.9, 0.08, 0.08), 1.0)
    objects = [root]
    objects.extend(
        [
            add_cube("COL_Fuselage", (0, -0.05, 0.08), (1.36, 7.45, 1.35), material, collection, root, "collision_proxy"),
            add_cube("COL_Wing", (0, 0.22, 0.31), (11.45, 1.55, 0.22), material, collection, root, "collision_proxy"),
            add_cube("COL_Tail", (0, -3.10, 0.48), (3.85, 0.94, 0.18), material, collection, root, "collision_proxy"),
            add_cube("COL_Gear", (0, 0.32, -0.62), (3.90, 3.40, 0.46), material, collection, root, "collision_proxy"),
        ]
    )
    return root, objects


def object_triangles(objects):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    total = 0
    for obj in objects:
        if obj.type != "MESH":
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        total += len(mesh.loop_triangles)
        evaluated.to_mesh_clear()
    return total


def world_bounds(objects):
    points = []
    for obj in objects:
        if obj.type != "MESH":
            continue
        for corner in obj.bound_box:
            points.append(obj.matrix_world @ Vector(corner))
    mins = [min(point[index] for point in points) for index in range(3)]
    maxs = [max(point[index] for point in points) for index in range(3)]
    return {
        "min_blender_xyz": [round(value, 3) for value in mins],
        "max_blender_xyz": [round(value, 3) for value in maxs],
        "dimensions_m": [round(maxs[index] - mins[index], 3) for index in range(3)],
    }


def export_glb(path, objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    kwargs = {
        "filepath": str(path),
        "export_format": "GLB",
        "use_selection": True,
        "export_apply": True,
        "export_extras": True,
        "export_yup": True,
    }
    try:
        bpy.ops.wm.gltf_export(**kwargs)
    except (AttributeError, RuntimeError, TypeError):
        bpy.ops.export_scene.gltf(**kwargs)


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def render_preview(lod0_objects, hidden_objects, materials):
    for obj in hidden_objects:
        obj.hide_render = True
    preview = make_collection("PREVIEW_ONLY")
    ground = add_cube("Preview ground", (0, 0, -1.20), (28, 28, 0.18), materials["Preview ground"], preview, None, bevel=0.08)
    ground.parent = None
    bpy.ops.object.camera_add(location=(13.2, 15.8, 8.2))
    camera = bpy.context.active_object
    camera.name = "Preview camera"
    move_to_collection(camera, preview)
    look_at(camera, (0, 0.2, 0.35))
    camera.data.lens = 60
    bpy.context.scene.camera = camera
    for name, location, energy, size, color in (
        ("Key", (4.5, 6.0, 8.5), 1450, 5.0, (1.0, 0.84, 0.68)),
        ("Fill", (-7.0, 1.0, 4.5), 980, 4.0, (0.50, 0.70, 1.0)),
        ("Rim", (1.0, -7.0, 6.0), 1250, 3.2, (0.55, 0.82, 1.0)),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        lamp = bpy.context.active_object
        lamp.name = "Preview " + name
        move_to_collection(lamp, preview)
        lamp.data.energy = energy
        lamp.data.shape = "DISK"
        lamp.data.size = size
        lamp.data.color = color
        look_at(lamp, (0, 0, 0))
    world = bpy.context.scene.world or bpy.data.worlds.new("Fable preview world")
    bpy.context.scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.018, 0.025, 0.036, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.22
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(OUT_PREVIEW)
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.render.resolution_percentage = 100
    bpy.ops.render.render(write_still=True)
    return [ground, camera]


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    materials = {
        "Paint white": make_material("Fable paint white", (0.82, 0.86, 0.89), 0.34, 0.18),
        "Signal red": make_material("Fable signal red", (0.72, 0.045, 0.035), 0.31, 0.12),
        "Control surface": make_material("Fable control surface", (0.60, 0.65, 0.70), 0.42, 0.24),
        "Brushed metal": make_material("Fable brushed metal", (0.38, 0.43, 0.48), 0.25, 0.82),
        "Rubber": make_material("Fable tire rubber", (0.018, 0.022, 0.026), 0.92, 0.0),
        "Canopy glass": make_material("Fable canopy glass", (0.035, 0.18, 0.25), 0.12, 0.36),
        "Propeller": make_material("Fable propeller composite", (0.045, 0.052, 0.058), 0.46, 0.28),
        "Cockpit": make_material("Fable cockpit", (0.035, 0.045, 0.055), 0.72, 0.18),
        "Lamp": make_material("Fable lamp", (0.9, 0.94, 1.0), 0.18, 0.0, (0.9, 0.94, 1.0)),
        "Nav red": make_material("Fable nav red", (0.75, 0.01, 0.01), 0.22, 0.0, (1.0, 0.01, 0.01)),
        "Nav green": make_material("Fable nav green", (0.01, 0.72, 0.12), 0.22, 0.0, (0.01, 1.0, 0.12)),
        "Preview ground": make_material("Preview ground", (0.055, 0.075, 0.09), 0.76, 0.08),
    }
    lod0_collection = make_collection("AIRCRAFT_LOD0")
    lod1_collection = make_collection("AIRCRAFT_LOD1")
    lod2_collection = make_collection("AIRCRAFT_LOD2")
    collision_collection = make_collection("AIRCRAFT_COLLISION")
    _, lod0 = build_lod0(lod0_collection, materials)
    _, lod1 = build_simple_lod(lod1_collection, materials, 1, 14, "120-320")
    _, lod2 = build_simple_lod(lod2_collection, materials, 2, 8, "320+")
    _, collision = build_collision(collision_collection)

    bounds = world_bounds(lod0)
    dimensions = bounds["dimensions_m"]
    if not (11.0 <= dimensions[0] <= 12.2 and 7.5 <= dimensions[1] <= 8.8 and 2.7 <= dimensions[2] <= 3.7):
        raise RuntimeError(f"Aircraft scale outside contract: {dimensions}")

    export_glb(OUT_LOD0, lod0)
    export_glb(OUT_LOD1, lod1)
    export_glb(OUT_LOD2, lod2)
    export_glb(OUT_COLLISION, collision)
    render_preview(lod0, lod1 + lod2 + collision, materials)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
    backup_blend = OUT_BLEND.with_suffix(".blend1")
    if backup_blend.exists():
        backup_blend.unlink()

    budgets = {"lod0": 12000, "lod1": 3500, "lod2": 900, "collision": 100}
    triangles = {
        "lod0": object_triangles(lod0),
        "lod1": object_triangles(lod1),
        "lod2": object_triangles(lod2),
        "collision": object_triangles(collision),
    }
    over_budget = {key: value for key, value in triangles.items() if value > budgets[key]}
    if over_budget:
        raise RuntimeError(f"Triangle budget exceeded: {over_budget}")
    files = {}
    for key, path in (
        ("lod0", OUT_LOD0),
        ("lod1", OUT_LOD1),
        ("lod2", OUT_LOD2),
        ("collision", OUT_COLLISION),
        ("blend", OUT_BLEND),
        ("preview", OUT_PREVIEW),
    ):
        files[key] = {
            "path": str(path.relative_to(PROJECT)),
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
        }
    manifest = {
        "asset": "Fable T-01 Trainer",
        "status": "visual handoff baseline",
        "license": "Original project asset",
        "coordinate_contract": {"units": "meters", "blender_forward": "+Y", "blender_up": "+Z", "three_forward": "-Z", "three_up": "+Y"},
        "physics_authority": "Existing procedural Three.js aircraft and deterministic 120 Hz flight model",
        "required_lod0_nodes": REQUIRED_LOD0_NODES,
        "lod_ranges_m": {"lod0": [0, 120], "lod1": [120, 320], "lod2": [320, None]},
        "triangle_budgets": budgets,
        "triangles": triangles,
        "bounds": bounds,
        "files": files,
        "pbr": {"metallic_roughness": True, "uv0": True, "normal_bake": False, "note": "Bake-ready UV baseline; production normal bake requires a reviewed high-poly source."},
    }
    OUT_MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print("FABLE_T01_EXPORT", json.dumps({"manifest": str(OUT_MANIFEST), "triangles": triangles, "dimensions_m": dimensions, "preview": str(OUT_PREVIEW)}))


if __name__ == "__main__":
    main()
