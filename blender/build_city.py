import bpy
import json
import math
import os
from pathlib import Path
from mathutils import Vector

# Mirag City — Tokyo × Bangkok Blender pipeline
# Run from repo root:
#   blender --background --python blender/build_city.py

REPO_ROOT = Path(__file__).resolve().parents[1]
CITY_KIT = REPO_ROOT / "public" / "assets" / "city-kit"
NEON_KIT = REPO_ROOT / "public" / "assets" / "neon-tech"
OUTPUT_DIR = REPO_ROOT / "public" / "assets" / "city-generated"
BLEND_PATH = REPO_ROOT / "blender" / "MiragCity_TokyoBangkok.blend"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

DISTRICTS = {
    "hills-vip": {"label": "Hills / VIP District", "center": (0, 500), "size": (760, 300)},
    "old-market": {"label": "Old Market", "center": (-390, 220), "size": (430, 320)},
    "central-downtown": {"label": "Central Downtown", "center": (0, 205), "size": (430, 330)},
    "tech-port": {"label": "Tech / Port", "center": (390, 210), "size": (430, 340)},
    "neon-quarter": {"label": "Neon Quarter", "center": (105, -35), "size": (320, 250)},
    "canal-town": {"label": "Canal Town", "center": (-385, -190), "size": (430, 330)},
    "riverside": {"label": "Riverside", "center": (0, -235), "size": (420, 330)},
    "industrial-docks": {"label": "Industrial Docks", "center": (390, -235), "size": (430, 330)},
    "beach-marina": {"label": "Beach / Marina", "center": (0, -520), "size": (1120, 250)},
}

BUILDING_FILES = [
    "Building_Small_1.gltf",
    "Building_Medium_2_001.gltf",
    "Building_Large_2.gltf",
]

NEON_FILES = [
    "floorplain.glb", "floorsquare.glb", "lightplain.glb", "lightsquare.glb",
    "pillar1a.glb", "pillar2a.glb", "stairs.glb", "stairslight.glb",
    "ramp.glb", "controlpanel.glb", "crate.glb",
]


def reset_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)
    root = bpy.context.scene.collection
    base = bpy.data.collections.get("Collection")
    if base:
        base.name = "CITY_ROOT"
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene.unit_settings.scale_length = 1.0


def material(name, color, metallic=0.0, roughness=0.65, emission=None, emission_strength=0.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
        if emission:
            if "Emission Color" in bsdf.inputs:
                bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
                bsdf.inputs["Emission Strength"].default_value = emission_strength
            elif "Emission" in bsdf.inputs:
                bsdf.inputs["Emission"].default_value = (*emission, 1.0)
    return mat


def ensure_collection(name):
    c = bpy.data.collections.get(name)
    if not c:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    return c


def move_to_collection(obj, collection):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    collection.objects.link(obj)


def add_box(name, loc, scale, mat, collection, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat:
        obj.data.materials.append(mat)
    if bevel > 0:
        mod = obj.modifiers.new("SoftEdges", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    move_to_collection(obj, collection)
    return obj


def add_cylinder(name, loc, radius, depth, mat, collection, vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    if mat:
        obj.data.materials.append(mat)
    move_to_collection(obj, collection)
    return obj


def import_template(filepath, source_collection):
    before = set(bpy.context.scene.objects)
    try:
        bpy.ops.import_scene.gltf(filepath=str(filepath))
    except Exception as exc:
        print(f"[WARN] Could not import {filepath.name}: {exc}")
        return []
    imported = [o for o in bpy.context.scene.objects if o not in before]
    roots = [o for o in imported if o.parent is None]
    for obj in imported:
        move_to_collection(obj, source_collection)
        obj.hide_render = True
        obj.hide_viewport = True
    return roots


def duplicate_hierarchy(root, collection, name, loc, scale=1.0, rotation_z=0.0):
    mapping = {}
    stack = [root]
    all_nodes = []
    while stack:
        current = stack.pop()
        all_nodes.append(current)
        stack.extend(list(current.children))
    for old in all_nodes:
        new = old.copy()
        if old.data:
            new.data = old.data.copy()
        new.hide_render = False
        new.hide_viewport = False
        collection.objects.link(new)
        mapping[old] = new
    for old, new in mapping.items():
        if old.parent in mapping:
            new.parent = mapping[old.parent]
    new_root = mapping[root]
    new_root.name = name
    new_root.location = Vector(loc)
    new_root.scale = (scale, scale, scale)
    new_root.rotation_euler[2] = rotation_z
    return new_root


def setup_materials():
    return {
        "ground": material("M_Ground", (0.16, 0.20, 0.16), roughness=0.9),
        "road": material("M_Road", (0.025, 0.03, 0.035), roughness=0.88),
        "concrete": material("M_Concrete", (0.34, 0.36, 0.38), roughness=0.84),
        "water": material("M_Water", (0.01, 0.14, 0.22), metallic=0.05, roughness=0.22),
        "sand": material("M_Sand", (0.63, 0.53, 0.34), roughness=0.95),
        "market": material("M_Market", (0.48, 0.27, 0.17), roughness=0.8),
        "industrial": material("M_Industrial", (0.25, 0.28, 0.30), metallic=0.15, roughness=0.72),
        "green": material("M_Green", (0.08, 0.24, 0.09), roughness=0.9),
        "cyan": material("M_NeonCyan", (0.02, 0.16, 0.18), roughness=0.35, emission=(0.0, 0.85, 1.0), emission_strength=7.0),
        "magenta": material("M_NeonMagenta", (0.18, 0.02, 0.12), roughness=0.35, emission=(1.0, 0.02, 0.48), emission_strength=6.0),
        "violet": material("M_NeonViolet", (0.10, 0.04, 0.18), roughness=0.35, emission=(0.52, 0.12, 1.0), emission_strength=5.0),
    }


def build_map_base(collections, mats):
    common = ensure_collection("COMMON_INFRASTRUCTURE")
    add_box("CityGround", (0, 0, -0.35), (1500, 1500, 0.7), mats["ground"], common)
    add_box("SouthSea", (0, -650, 0.0), (1500, 220, 0.25), mats["water"], collections["beach-marina"])
    add_box("Beach", (-90, -520, 0.08), (850, 95, 0.18), mats["sand"], collections["beach-marina"])
    add_box("MarinaWater", (315, -515, 0.02), (310, 125, 0.20), mats["water"], collections["beach-marina"])
    add_box("RiverSouth", (0, -260, 0.02), (92, 330, 0.20), mats["water"], collections["riverside"])
    add_box("RiverNorth", (-20, -30, 0.02), (60, 150, 0.20), mats["water"], collections["riverside"])
    for z in (-225, -165, -105):
        add_box(f"Canal_{z}", (-300, z, 0.02), (360, 22, 0.20), mats["water"], collections["canal-town"])

    # Main Tokyo-style boulevard and secondary streets.
    road_specs = [
        ((0, 165, 0.10), (1180, 34, 0.20)),
        ((0, 95, 0.10), (1100, 22, 0.20)),
        ((0, 245, 0.10), (1100, 22, 0.20)),
        ((0, 315, 0.10), (1100, 22, 0.20)),
        ((0, 35, 0.10), (1100, 22, 0.20)),
        ((0, -455, 0.10), (980, 28, 0.20)),
        ((0, 170, 0.10), (34, 780, 0.20)),
        ((-185, 150, 0.10), (24, 760, 0.20)),
        ((190, 140, 0.10), (24, 800, 0.20)),
    ]
    for i, (loc, dims) in enumerate(road_specs):
        add_box(f"Road_{i}", loc, dims, mats["road"], common)

    # Elevated expressway.
    add_box("ExpresswayEW", (150, 285, 8.0), (680, 16, 0.8), mats["road"], common)
    for x in range(-140, 441, 72):
        add_box(f"ExpressPillar_{x}", (x, 285, 3.8), (2.6, 2.6, 7.6), mats["concrete"], common)

    # Canal/river bridges.
    for z in (-225, -165, -105):
        for x in (-365, -235):
            add_box(f"CanalBridge_{x}_{z}", (x, z, 0.65), (24, 36, 1.1), mats["road"], collections["canal-town"])
    for z in (-55, -195, -455):
        target = "beach-marina" if z == -455 else "riverside"
        add_box(f"RiverBridge_{z}", (0, z, 0.68), (132, 28, 1.1), mats["road"], collections[target])


def place_buildings(collections, mats, templates):
    configs = {
        "central-downtown": {"xs": (-145, -70, 70, 145), "zs": (105, 185, 265), "scale": (1.0, 1.45), "height": 75},
        "old-market": {"xs": (-520, -455, -390, -325, -260), "zs": (90, 160, 235, 305), "scale": (0.72, 0.92), "height": 26},
        "tech-port": {"xs": (260, 340, 420, 500), "zs": (95, 185, 275), "scale": (0.88, 1.12), "height": 48},
        "neon-quarter": {"xs": (45, 105, 165), "zs": (-85, -20, 45), "scale": (0.78, 1.0), "height": 36},
        "canal-town": {"xs": (-510, -430, -350, -270), "zs": (-300, -260, -205, -145, -80), "scale": (0.65, 0.82), "height": 22},
        "riverside": {"xs": (-150, -95, 95, 150), "zs": (-340, -270, -130), "scale": (0.8, 1.0), "height": 32},
        "industrial-docks": {"xs": (260, 340, 420, 500), "zs": (-330, -245, -155, -70), "scale": (0.70, 0.92), "height": 18},
        "beach-marina": {"xs": (-360, -250, -140, -30, 80, 190), "zs": (-470,), "scale": (0.82, 1.0), "height": 28},
        "hills-vip": {"xs": (-260, -130, 0, 130, 260), "zs": (455, 535, 615), "scale": (0.58, 0.78), "height": 16},
    }

    fallback_mat = mats["concrete"]
    count = 0
    for district, cfg in configs.items():
        col = collections[district]
        for zi, z in enumerate(cfg["zs"]):
            for xi, x in enumerate(cfg["xs"]):
                # Respect river/canal space.
                if district == "riverside" and abs(x) < 70:
                    continue
                if district == "canal-town" and any(abs(z-cz) < 18 for cz in (-225, -165, -105)):
                    continue
                scale = cfg["scale"][0] + ((xi + zi) % 4) / 3.0 * (cfg["scale"][1] - cfg["scale"][0])
                template_roots = templates.get(BUILDING_FILES[(xi + zi) % len(BUILDING_FILES)], [])
                if template_roots:
                    root = duplicate_hierarchy(template_roots[0], col, f"{district}_building_{count}", (x, z, 0), scale, ((xi + zi) % 4) * math.pi / 2)
                    # GLTF assets are Y-up; Blender is Z-up, imported transform handles conversion.
                else:
                    h = cfg["height"] * (0.72 + ((xi + zi) % 5) * 0.13)
                    add_box(f"{district}_fallback_{count}", (x, z, h / 2), (48, 48, h), fallback_mat, col, bevel=0.8)
                count += 1
    return count


def dress_districts(collections, mats, neon_templates):
    # Old Market stalls / awnings.
    col = collections["old-market"]
    for i in range(20):
        x = -520 + (i % 5) * 55
        y = 120 + (i // 5) * 48
        add_box(f"MarketStall_{i}", (x, y, 1.6), (12, 8, 3.2), mats["market"], col, bevel=0.2)

    # Industrial cargo stacks.
    col = collections["industrial-docks"]
    cargo_colors = [mats["industrial"], mats["market"], mats["concrete"]]
    for i in range(36):
        x = 260 + (i % 6) * 38
        y = -360 + (i // 6) * 28
        add_box(f"Cargo_{i}", (x, y, 1.6), (30, 12, 3.2), cargo_colors[i % len(cargo_colors)], col, bevel=0.18)

    # Marina piers.
    col = collections["beach-marina"]
    for x in (245, 295, 345, 395):
        add_box(f"MarinaPier_{x}", (x, -540, 0.35), (8, 95, 0.6), mats["concrete"], col)

    # VIP greenery.
    col = collections["hills-vip"]
    for i in range(32):
        x = -340 + (i % 8) * 95
        y = 445 + (i // 8) * 70
        add_cylinder(f"VIPTreeTrunk_{i}", (x, y, 3.0), 0.55, 6.0, mats["market"], col)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=3.0, location=(x, y, 7.0))
        crown = bpy.context.object
        crown.name = f"VIPTreeCrown_{i}"
        crown.data.materials.append(mats["green"])
        move_to_collection(crown, col)

    # Neon Quarter: use uploaded Neon Tech pieces if available + emissive billboards.
    col = collections["neon-quarter"]
    neon_positions = [
        (-5, -90, 0), (45, -90, 0), (95, -90, 0), (145, -90, 0),
        (20, -35, 0), (75, -35, 0), (130, -35, 0),
        (30, 20, 0), (90, 20, 0), (150, 20, 0),
    ]
    for i, pos in enumerate(neon_positions):
        filename = NEON_FILES[i % len(NEON_FILES)]
        roots = neon_templates.get(filename, [])
        if roots:
            duplicate_hierarchy(roots[0], col, f"NeonTech_{i}", pos, 2.2, (i % 4) * math.pi / 2)
        else:
            mat = [mats["cyan"], mats["magenta"], mats["violet"]][i % 3]
            add_box(f"NeonFallback_{i}", (pos[0], pos[1], 0.5), (18, 18, 1.0), mat, col, bevel=0.25)

    for i in range(18):
        x = 25 + (i % 6) * 28
        y = -105 + (i // 6) * 62
        mat = [mats["cyan"], mats["magenta"], mats["violet"]][i % 3]
        add_box(f"NeonSign_{i}", (x, y, 8 + (i % 4) * 4), (12, 0.8, 5), mat, col, bevel=0.15)


def add_world_lighting():
    world = bpy.context.scene.world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.055, 0.075, 0.12, 1.0)
    bg.inputs["Strength"].default_value = 0.35

    bpy.ops.object.light_add(type='SUN', location=(220, -160, 300))
    sun = bpy.context.object
    sun.name = "Sun_Warm"
    sun.rotation_euler = (math.radians(33), 0, math.radians(142))
    sun.data.energy = 2.6
    sun.data.color = (1.0, 0.73, 0.48)

    bpy.ops.object.light_add(type='AREA', location=(0, 0, 260))
    fill = bpy.context.object
    fill.name = "SkyFill_Blue"
    fill.data.energy = 1200
    fill.data.shape = 'DISK'
    fill.data.size = 600
    fill.data.color = (0.28, 0.42, 1.0)


def collect_objects_recursive(collection):
    objects = list(collection.objects)
    for child in collection.children:
        objects.extend(collect_objects_recursive(child))
    return objects


def export_collection(collection, filepath):
    bpy.ops.object.select_all(action='DESELECT')
    objects = [o for o in collect_objects_recursive(collection) if not o.hide_render]
    for obj in objects:
        obj.select_set(True)
    if not objects:
        return 0
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(filepath),
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_materials='EXPORT',
    )
    return len(objects)


def main():
    reset_scene()
    mats = setup_materials()
    source_collection = ensure_collection("SOURCE_ASSETS")
    source_collection.hide_render = True
    source_collection.hide_viewport = True
    collections = {key: ensure_collection(f"DISTRICT_{key}") for key in DISTRICTS}

    building_templates = {}
    for filename in BUILDING_FILES:
        path = CITY_KIT / filename
        building_templates[filename] = import_template(path, source_collection) if path.exists() else []

    neon_templates = {}
    for filename in NEON_FILES:
        path = NEON_KIT / filename
        neon_templates[filename] = import_template(path, source_collection) if path.exists() else []

    build_map_base(collections, mats)
    building_count = place_buildings(collections, mats, building_templates)
    dress_districts(collections, mats, neon_templates)
    add_world_lighting()

    # Save editable Blender source.
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

    manifest = {
        "generated": True,
        "generator": "blender/build_city.py",
        "sourceBlend": "blender/MiragCity_TokyoBangkok.blend",
        "districts": [],
    }

    for key, info in DISTRICTS.items():
        out = OUTPUT_DIR / f"{key}.glb"
        object_count = export_collection(collections[key], out)
        manifest["districts"].append({
            "id": key,
            "label": info["label"],
            "file": f"{key}.glb",
            "objects": object_count,
        })

    common = ensure_collection("COMMON_INFRASTRUCTURE")
    common_file = OUTPUT_DIR / "common-infrastructure.glb"
    common_count = export_collection(common, common_file)
    manifest["common"] = {"file": "common-infrastructure.glb", "objects": common_count}
    manifest["buildingPlacements"] = building_count

    with open(OUTPUT_DIR / "manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"[Mirag City] Saved {BLEND_PATH}")
    print(f"[Mirag City] Exported {len(DISTRICTS)} district GLBs + common infrastructure")


if __name__ == "__main__":
    main()
