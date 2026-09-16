#!/usr/bin/env python3
"""Generate a polished modular Downtown prototype for Mirag City in Blender.

Run headless from repository root:

    blender -b --python tools/blender/generate_mirage_downtown.py -- --repo-root .

The generator deliberately avoids VoxCity geometry. It uses the authored Mirage
master-plan coordinates plus the Quaternius building assets already stored under
public/assets/city-kit. Roads, sidewalks, markings, plaza, lamps, trees and roof
silhouette upgrades are generated procedurally in Blender, while building bodies
come from the real modular GLTF assets.

Output:
  public/assets/city/districts/downtown.glb
  public/assets/city/districts/downtown-manifest.json

Coordinate mapping:
  Mirage X -> Blender X
  Mirage Z -> Blender Y
  World height -> Blender Z

This first-pass district is intentionally limited to Downtown so it can be
visually approved before the same pipeline is expanded to the other districts.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


# -----------------------------------------------------------------------------
# Authored Downtown slice of the existing Mirage City master plan.
# -----------------------------------------------------------------------------

DOWNTOWN_BOUNDS = (-315.0, -90.0, 315.0, 555.0)  # xmin, zmin, xmax, zmax

ROAD_SEGMENTS = [
    ("grand-boulevard", 34.0, (0.0, -90.0), (0.0, 445.0), "arterial"),
    ("central-cross", 30.0, (-315.0, 145.0), (315.0, 145.0), "arterial"),
    ("market-avenue", 22.0, (-315.0, 245.0), (0.0, 145.0), "collector"),
    ("tech-avenue", 22.0, (0.0, 145.0), (315.0, 260.0), "collector"),
]

ROUNDABOUT = {
    "center": (0.0, 165.0),
    "radius": 82.0,
    "width": 18.0,
}

BUILDING_ROWS = [
    {
        "id": "downtown-west-spine",
        "start": (-55.0, -5.0),
        "end": (-55.0, 355.0),
        "spacing": 58.0,
        "width": 36.0,
        "depth": 38.0,
        "height_range": (78.0, 118.0),
        "templates": ("Building_Large_2", "Building_Medium_2_001"),
    },
    {
        "id": "downtown-east-spine",
        "start": (55.0, -5.0),
        "end": (55.0, 355.0),
        "spacing": 58.0,
        "width": 36.0,
        "depth": 38.0,
        "height_range": (88.0, 132.0),
        "templates": ("Building_Large_2", "Building_Medium_2_001"),
    },
    {
        "id": "downtown-north-row",
        "start": (-220.0, 215.0),
        "end": (220.0, 215.0),
        "spacing": 62.0,
        "width": 36.0,
        "depth": 36.0,
        "height_range": (64.0, 96.0),
        "templates": ("Building_Large_2", "Building_Medium_2_001"),
    },
    {
        "id": "downtown-south-row",
        "start": (-220.0, 80.0),
        "end": (220.0, 80.0),
        "spacing": 62.0,
        "width": 34.0,
        "depth": 36.0,
        "height_range": (46.0, 74.0),
        "templates": ("Building_Medium_2_001", "Building_Large_2"),
    },
]

APEX = {
    "name": "Apex Tower",
    "position": (-100.0, 500.0),
    "width": 65.0,
    "depth": 65.0,
    "height": 220.0,
    "template": "Building_Large_2",
}

CITY_KIT_FILES = {
    "Building_Large_2": "Building_Large_2.gltf",
    "Building_Medium_2_001": "Building_Medium_2_001.gltf",
    "Building_Small_1": "Building_Small_1.gltf",
    "Prop_Bollard": "Prop_Bollard.gltf",
    "Prop_Planter_Single": "Prop_Planter_Single.gltf",
    "Prop_ManholeCover": "Prop_ManholeCover.gltf",
}


# -----------------------------------------------------------------------------
# Blender helpers.
# -----------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", default=".")
    parser.add_argument("--seed", type=int, default=20260916)
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)


def ensure_collection(name: str) -> bpy.types.Collection:
    collection = bpy.data.collections.get(name)
    if collection is None:
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
    return collection


def move_to_collection(obj: bpy.types.Object, collection: bpy.types.Collection) -> None:
    if obj.name not in collection.objects:
        collection.objects.link(obj)
    for current in list(obj.users_collection):
        if current != collection:
            current.objects.unlink(obj)


def make_material(name: str, rgba, metallic=0.0, roughness=0.8, emission=None):
    mat = bpy.data.materials.get(name)
    if mat is not None:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = rgba
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
        if emission is not None and "Emission" in bsdf.inputs:
            bsdf.inputs["Emission"].default_value = emission
            if "Emission Strength" in bsdf.inputs:
                bsdf.inputs["Emission Strength"].default_value = 1.5
    return mat


def add_cube(name, location, scale, material, collection, rotation_z=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location, rotation=(0.0, 0.0, rotation_z))
    obj = bpy.context.active_object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material:
        obj.data.materials.append(material)
    move_to_collection(obj, collection)
    return obj


def add_cylinder(name, location, radius, depth, material, collection, vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.active_object
    obj.name = name
    if material:
        obj.data.materials.append(material)
    move_to_collection(obj, collection)
    return obj


def add_uv_sphere(name, location, scale, material, collection):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1.0, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material:
        obj.data.materials.append(material)
    move_to_collection(obj, collection)
    return obj


def segment_frame(a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dy)
    if length <= 1e-6:
        return None
    ux, uy = dx / length, dy / length
    nx, ny = -uy, ux
    yaw = math.atan2(dy, dx)
    return length, ux, uy, nx, ny, yaw


def add_road_segment(name, width, a, b, road_mat, sidewalk_mat, marking_mat, collection):
    frame = segment_frame(a, b)
    if frame is None:
        return []
    length, ux, uy, nx, ny, yaw = frame
    cx, cy = (a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5
    objects = []
    objects.append(add_cube(f"road_{name}", (cx, cy, 0.10), (length, width, 0.20), road_mat, collection, yaw))

    sidewalk_width = 4.0 if width >= 24 else 3.0
    for side in (-1.0, 1.0):
        off = width * 0.5 + sidewalk_width * 0.5 + 0.45
        sx, sy = cx + nx * off * side, cy + ny * off * side
        objects.append(add_cube(f"sidewalk_{name}_{'L' if side < 0 else 'R'}", (sx, sy, 0.26), (length, sidewalk_width, 0.32), sidewalk_mat, collection, yaw))

    dash_count = max(1, int(length / 26.0))
    for i in range(dash_count):
        t = (i + 0.5) / dash_count
        px, py = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
        objects.append(add_cube(f"mark_{name}_{i}", (px, py, 0.225), (7.0, 0.22, 0.035), marking_mat, collection, yaw))
    return objects


def add_ring_road(center, radius, width, road_mat, sidewalk_mat, collection, segments=72):
    def ring_mesh(name, inner, outer, z, mat):
        verts = []
        faces = []
        for i in range(segments):
            angle = (i / segments) * math.tau
            c, s = math.cos(angle), math.sin(angle)
            verts.append((center[0] + inner * c, center[1] + inner * s, z))
            verts.append((center[0] + outer * c, center[1] + outer * s, z))
        for i in range(segments):
            n = (i + 1) % segments
            a, b = i * 2, i * 2 + 1
            c, d = n * 2 + 1, n * 2
            faces.append((a, b, c, d))
        mesh = bpy.data.meshes.new(name + "_mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        collection.objects.link(obj)
        obj.data.materials.append(mat)
        return obj

    inner = radius - width * 0.5
    outer = radius + width * 0.5
    ring_mesh("roundabout_road", inner, outer, 0.12, road_mat)
    ring_mesh("roundabout_sidewalk_inner", max(1.0, inner - 4.0), inner - 0.5, 0.28, sidewalk_mat)
    ring_mesh("roundabout_sidewalk_outer", outer + 0.5, outer + 4.0, 0.28, sidewalk_mat)


def normalize_template(obj: bpy.types.Object) -> None:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    min_x = min(p.x for p in points)
    max_x = max(p.x for p in points)
    min_y = min(p.y for p in points)
    max_y = max(p.y for p in points)
    min_z = min(p.z for p in points)
    obj.location += Vector((-(min_x + max_x) * 0.5, -(min_y + max_y) * 0.5, -min_z))
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    obj.select_set(False)


def import_template(asset_dir: Path, template_name: str, templates_collection) -> bpy.types.Object:
    filepath = asset_dir / CITY_KIT_FILES[template_name]
    if not filepath.exists():
        raise FileNotFoundError(filepath)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(filepath))
    new_meshes = [obj for obj in bpy.data.objects if obj not in before and obj.type == "MESH"]
    if not new_meshes:
        raise RuntimeError(f"No meshes imported from {filepath}")

    bpy.ops.object.select_all(action="DESELECT")
    for obj in new_meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = new_meshes[0]
    if len(new_meshes) > 1:
        bpy.ops.object.join()
    root = bpy.context.active_object
    root.name = f"TEMPLATE_{template_name}"
    normalize_template(root)
    move_to_collection(root, templates_collection)
    root.hide_viewport = True
    root.hide_render = True
    return root


def place_template(template, name, x, y, width, depth, height, collection, yaw=0.0):
    dims = template.dimensions
    inst = template.copy()
    inst.data = template.data  # linked geometry keeps the GLB compact
    inst.name = name
    inst.hide_viewport = False
    inst.hide_render = False
    inst.location = (x, y, 0.0)
    inst.rotation_euler[2] = yaw
    inst.scale = (
        width / max(0.001, dims.x),
        depth / max(0.001, dims.y),
        height / max(0.001, dims.z),
    )
    collection.objects.link(inst)
    return inst


def row_positions(row):
    sx, sy = row["start"]
    ex, ey = row["end"]
    length = math.hypot(ex - sx, ey - sy)
    count = max(2, int(length / row["spacing"]) + 1)
    for i in range(count):
        t = i / max(1, count - 1)
        yield sx + (ex - sx) * t, sy + (ey - sy) * t


def add_rooftop_upgrade(x, y, width, depth, height, mats, collection, index):
    top = height
    dark, glass, metal = mats["dark"], mats["glass"], mats["metal"]
    crown_w = width * (0.40 + 0.08 * ((index % 3)))
    crown_d = depth * 0.42
    add_cube(f"roof_penthouse_{index}", (x, y, top + 2.0), (crown_w, crown_d, 4.0), dark, collection)
    add_cube(f"roof_glass_{index}", (x, y - crown_d * 0.48, top + 2.2), (crown_w * 0.82, 0.35, 2.6), glass, collection)
    if height > 95:
        add_cylinder(f"roof_mast_{index}", (x, y, top + 9.0), 0.40, 14.0, metal, collection, 10)


def add_tree(x, y, mats, collection, palm=False, index=0):
    trunk_h = 6.5 if palm else 4.5
    add_cylinder(f"tree_trunk_{index}", (x, y, trunk_h * 0.5), 0.35, trunk_h, mats["trunk"], collection, 8)
    if palm:
        for k, (ox, oy) in enumerate(((0, 0), (1.4, 0), (-1.4, 0), (0, 1.4), (0, -1.4))):
            add_uv_sphere(f"palm_leaf_{index}_{k}", (x + ox, y + oy, trunk_h + 1.0), (2.2, 0.75, 0.50), mats["leaf"], collection)
    else:
        add_uv_sphere(f"tree_leaf_{index}", (x, y, trunk_h + 2.1), (2.7, 2.7, 3.2), mats["leaf"], collection)


def add_lamp(x, y, mats, collection, index):
    add_cylinder(f"lamp_post_{index}", (x, y, 3.0), 0.12, 6.0, mats["metal"], collection, 10)
    add_cube(f"lamp_arm_{index}", (x + 0.65, y, 5.85), (1.45, 0.18, 0.18), mats["metal"], collection)
    add_cube(f"lamp_head_{index}", (x + 1.20, y, 5.72), (0.65, 0.42, 0.16), mats["light"], collection)


def create_downtown(repo_root: Path, seed: int) -> dict:
    random.seed(seed)
    clear_scene()
    templates_collection = ensure_collection("TEMPLATES")
    generated = ensure_collection("DOWNTOWN")

    # Materials intentionally favor readable mobile-game architecture rather than
    # a photoreal pipeline; the imported Quaternius meshes keep their own mats.
    mats = {
        "ground": make_material("MD_Ground", (0.16, 0.22, 0.18, 1.0), roughness=0.95),
        "road": make_material("MD_Asphalt", (0.055, 0.065, 0.080, 1.0), roughness=0.96),
        "sidewalk": make_material("MD_Sidewalk", (0.42, 0.43, 0.42, 1.0), roughness=0.92),
        "marking": make_material("MD_RoadWhite", (0.92, 0.90, 0.78, 1.0), roughness=0.82),
        "dark": make_material("MD_ArchitecturalDark", (0.07, 0.09, 0.12, 1.0), metallic=0.08, roughness=0.62),
        "glass": make_material("MD_GlassBlue", (0.04, 0.22, 0.34, 1.0), metallic=0.12, roughness=0.32),
        "metal": make_material("MD_Metal", (0.16, 0.18, 0.20, 1.0), metallic=0.35, roughness=0.55),
        "light": make_material("MD_LampGlow", (0.95, 0.82, 0.50, 1.0), roughness=0.35, emission=(0.95, 0.68, 0.28, 1.0)),
        "trunk": make_material("MD_TreeTrunk", (0.28, 0.16, 0.07, 1.0), roughness=0.98),
        "leaf": make_material("MD_TreeLeaf", (0.10, 0.36, 0.15, 1.0), roughness=0.96),
        "plaza": make_material("MD_Plaza", (0.52, 0.48, 0.40, 1.0), roughness=0.92),
        "accent": make_material("MD_CyanAccent", (0.03, 0.62, 0.78, 1.0), roughness=0.38, emission=(0.02, 0.32, 0.52, 1.0)),
    }

    xmin, ymin, xmax, ymax = DOWNTOWN_BOUNDS
    add_cube("downtown_ground", ((xmin + xmax) * 0.5, (ymin + ymax) * 0.5, -0.18), (xmax - xmin, ymax - ymin, 0.35), mats["ground"], generated)

    road_count = 0
    for road_id, width, a, b, _kind in ROAD_SEGMENTS:
        road_count += 1
        add_road_segment(road_id, width, a, b, mats["road"], mats["sidewalk"], mats["marking"], generated)
    add_ring_road(ROUNDABOUT["center"], ROUNDABOUT["radius"], ROUNDABOUT["width"], mats["road"], mats["sidewalk"], generated)

    # Plaza around the central downtown landmark corridor.
    add_cube("central_plaza", (-100.0, 425.0, 0.20), (95.0, 70.0, 0.35), mats["plaza"], generated)

    asset_dir = repo_root / "public" / "assets" / "city-kit"
    template_names = ("Building_Large_2", "Building_Medium_2_001", "Building_Small_1")
    templates = {name: import_template(asset_dir, name, templates_collection) for name in template_names}

    buildings = []
    building_index = 0
    for row in BUILDING_ROWS:
        points = list(row_positions(row))
        for i, (x, y) in enumerate(points):
            # Keep the central roundabout visibly open.
            if math.hypot(x - ROUNDABOUT["center"][0], y - ROUNDABOUT["center"][1]) < 110.0:
                continue
            template_name = row["templates"][(i + building_index) % len(row["templates"])]
            height_min, height_max = row["height_range"]
            wave = 0.5 + 0.5 * math.sin((i + 1) * 1.37 + building_index * 0.31)
            height = height_min + (height_max - height_min) * wave
            # Slight footprint variation breaks repetition without changing roads.
            width = row["width"] * (0.90 + 0.12 * ((i + building_index) % 3))
            depth = row["depth"] * (0.92 + 0.10 * ((i + 1) % 2))
            name = f"DT_{row['id']}_{i:02d}"
            place_template(templates[template_name], name, x, y, width, depth, height, generated)
            add_rooftop_upgrade(x, y, width, depth, height, mats, generated, building_index)
            buildings.append({
                "name": name,
                "row": row["id"],
                "template": template_name,
                "position": [round(x, 3), 0.0, round(y, 3)],
                "size": [round(width, 3), round(height, 3), round(depth, 3)],
            })
            building_index += 1

    # Apex Tower is authored as a separate hero building instead of being lost
    # in the repeated street rows.
    ax, ay = APEX["position"]
    place_template(
        templates[APEX["template"]],
        "LM01_ApexTower",
        ax,
        ay,
        APEX["width"],
        APEX["depth"],
        APEX["height"],
        generated,
    )
    # Broad stepped crown + spire give it a unique silhouette.
    top = APEX["height"]
    for k, scale in enumerate((0.72, 0.52, 0.34)):
        add_cube(
            f"apex_crown_{k}",
            (ax, ay, top + 3.0 + k * 5.0),
            (APEX["width"] * scale, APEX["depth"] * scale, 5.0),
            mats["dark" if k != 1 else "accent"],
            generated,
        )
    add_cylinder("apex_spire", (ax, ay, top + 31.0), 0.65, 32.0, mats["metal"], generated, 12)
    buildings.append({
        "name": "LM01_ApexTower",
        "row": "landmark",
        "template": APEX["template"],
        "position": [ax, 0.0, ay],
        "size": [APEX["width"], APEX["height"], APEX["depth"]],
    })

    # Street furniture along Grand Boulevard and around the roundabout.
    prop_index = 0
    for y in range(-45, 420, 32):
        if 55 < y < 270:
            # Keep a little space around the roundabout/intersection.
            continue
        for side in (-1.0, 1.0):
            x = side * 23.0
            add_lamp(x, float(y), mats, generated, prop_index)
            if prop_index % 2 == 0:
                add_tree(side * 30.0, float(y + 7), mats, generated, False, prop_index)
            prop_index += 1

    for i in range(16):
        angle = (i / 16.0) * math.tau
        radius = 60.0
        x = ROUNDABOUT["center"][0] + math.cos(angle) * radius
        y = ROUNDABOUT["center"][1] + math.sin(angle) * radius
        add_tree(x, y, mats, generated, False, 1000 + i)

    # Export only generated objects; templates remain excluded.
    bpy.ops.object.select_all(action="DESELECT")
    export_objects = [obj for obj in generated.objects if obj.type in {"MESH", "EMPTY"}]
    for obj in export_objects:
        obj.select_set(True)
    if export_objects:
        bpy.context.view_layer.objects.active = export_objects[0]

    out_dir = repo_root / "public" / "assets" / "city" / "districts"
    out_dir.mkdir(parents=True, exist_ok=True)
    glb_path = out_dir / "downtown.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
    )

    manifest = {
        "version": 1,
        "generator": "Blender modular city pipeline",
        "district": "downtown",
        "seed": seed,
        "bounds": list(DOWNTOWN_BOUNDS),
        "source_assets": list(template_names),
        "buildings": buildings,
        "building_count": len(buildings),
        "road_segment_count": road_count + 1,
        "hero_landmark": "LM01_ApexTower",
        "output": "downtown.glb",
        "notes": [
            "No VoxCity visual geometry used",
            "Building bodies use existing Quaternius modular GLTF assets",
            "Roads, sidewalks, markings, plaza, trees, lamps and roof upgrades are Blender-generated",
            "All generated geometry sits on the district ground plane at Z=0",
        ],
    }
    (out_dir / "downtown-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def main() -> int:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    manifest = create_downtown(repo_root, args.seed)
    print(json.dumps({
        "district": manifest["district"],
        "building_count": manifest["building_count"],
        "road_segment_count": manifest["road_segment_count"],
        "output": manifest["output"],
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
