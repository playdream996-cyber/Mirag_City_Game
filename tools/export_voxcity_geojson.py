#!/usr/bin/env python3
"""Export the deterministic Mirage City 4km planner to VoxCity-friendly GeoJSON.

The browser planner uses local metres (X east/west, Z north/south). VoxCity
expects geospatial vector data, so this exporter maps the local metre grid to a
small synthetic WGS84 rectangle around a configurable anchor while preserving
all original local coordinates and dimensions as feature properties.

Default anchor (0, 0) is intentionally synthetic; it is not meant to represent
a real city. Use --anchor-lat/--anchor-lon if you need the model georeferenced
elsewhere.

Outputs:
  mirage-buildings.geojson
  mirage-roads.geojson
  mirage-water.geojson
  mirage-bridges.geojson
  mirage-districts.geojson
  mirage-voxcity-manifest.json
"""

from __future__ import annotations
import argparse
import json
import math
from pathlib import Path

DISTRICTS = [
    ("HILLS / VIP", -700, 700, 950, 1900, "#6e9c71"),
    ("OLD TOWN", -1800, -700, 250, 1100, "#c9916f"),
    ("DOWNTOWN", -600, 400, -100, 800, "#7bacc8"),
    ("TECH / BUSINESS", 550, 1450, 200, 1000, "#8da8d9"),
    ("INDUSTRIAL PORT", 1000, 1950, -1150, 100, "#9d9d96"),
    ("CANAL RESIDENTIAL", -1850, -750, -1150, 100, "#74b7ad"),
    ("NIGHTLIFE", -600, 500, -650, -200, "#b889b3"),
    ("RIVERSIDE", -600, 650, -1250, -750, "#a5b87e"),
    ("BEACH / MARINA", -800, 1100, -1750, -1350, "#d6c496"),
]

WEST_WATER = [(-650, 1150), (-650, 800), (-650, 200), (-700, -500), (-700, -1300), (-800, -1850)]
EAST_WATER = [(480, 1100), (480, 500), (500, -300), (700, -800), (720, -1400), (1000, -1800)]
SOUTH_WATER = [(-750, -1300), (-200, -1300), (400, -1300), (750, -1300)]

LANDMARKS = [
    (-100, 500, 65, 65, 220, "Apex Tower / LM-01"),
    (-490, 90, 75, 65, 35, "Police HQ / LM-02"),
    (1050, 530, 75, 65, 165, "Tech Tower / LM-03"),
    (-1250, 730, 80, 65, 16, "Market Hall / LM-04"),
    (250, 1690, 90, 60, 24, "Hilltop Mansion / LM-05"),
    (250, -470, 100, 75, 55, "Casino / LM-06"),
    (-250, -1100, 70, 50, 60, "Riverside Hotel / LM-07"),
    (-350, -1610, 140, 70, 85, "Grand Resort / LM-08"),
]


def elevation(x: float, z: float) -> float:
    if z < 1100:
        return 5.0
    return 5 + min(1.0, (z - 1100) / 700.0) * (100 + 60 * math.cos(x / 550.0))


class JSRng:
    def __init__(self, seed: int = 834):
        self.seed = seed

    def random(self) -> float:
        self.seed = (self.seed * 16807) % 2147483647
        return (self.seed - 1) / 2147483646


def js_round(v: float) -> int:
    return math.floor(v + 0.5)


def distance_to_segment(x, z, a, b):
    dx, dz = b[0] - a[0], b[1] - a[1]
    den = dx * dx + dz * dz
    t = 0.0 if den == 0 else max(0.0, min(1.0, ((x - a[0]) * dx + (z - a[1]) * dz) / den))
    return math.hypot(x - a[0] - t * dx, z - a[1] - t * dz)


def near(paths, x, z, pad):
    return any(
        distance_to_segment(x, z, r["points"][i - 1], r["points"][i]) < r["width"] / 2 + pad
        for r in paths
        for i in range(1, len(r["points"]))
    )


def build_linear_network():
    roads, water = [], []

    def add(points, width, target, kind):
        target.append({"points": [tuple(p) for p in points], "width": width, "kind": kind})

    add(WEST_WATER, 90, water, "canal")
    add(EAST_WATER, 90, water, "canal")
    add(SOUTH_WATER, 90, water, "canal")
    for z in (-200, -500, -800, -1050):
        add([(-1820, z), (-1400, z), (-1100, z), (-700, z)], 40, water, "canal")

    ring = [
        (-1850, -1350), (-1880, -400), (-1820, 700), (-1400, 1250), (-600, 1150),
        (400, 1150), (1450, 1080), (1550, 400), (1550, -1200), (1050, -1400),
        (0, -1400), (-850, -1400), (-1850, -1350),
    ]
    add(ring, 34, roads, "ring")
    for z in (950, 650, 350, -350, -950, -1400):
        add([(-1800, z), (1550, z)], 26, roads, "arterial")
    for x in (-1650, -1000, -400, 150, 900, 1350):
        add([(x, -1200), (x, 1050)], 24, roads, "arterial")
    add([(-1850, -1200), (-1500, -1400), (-850, -1550), (-650, -1770), (100, -1770)], 32, roads, "coastal")
    add([(1550, 1050), (1780, 400), (1780, -1150), (1050, -1400), (100, -1400)], 32, roads, "east-bypass")

    for d in DISTRICTS[1:8]:
        name, x1, x2, z1, z2, _ = d
        x = math.ceil(x1 / 200) * 200
        while x < x2:
            add([(x, z1), (x, z2)], 10 if name == "OLD TOWN" else 14, roads, "local")
            x += 200
        z = math.ceil(z1 / 200) * 200
        while z < z2:
            add([(x1, z), (x2, z)], 12, roads, "local")
            z += 200
    return roads, water


def district_for(x, z):
    for name, x1, x2, z1, z2, _ in DISTRICTS:
        if x1 <= x <= x2 and z1 <= z <= z2:
            return name
    return "OUTSIDE"


def build_buildings(roads, water):
    rng = JSRng(834)
    occupied = []
    buildings = []

    def add(x, z, w, d, h, color, name):
        bid = f"BLD-{len(buildings) + 1:03d}"
        b = {
            "id": bid,
            "type": name,
            "x": float(x),
            "z": float(z),
            "width": float(w),
            "depth": float(d),
            "height": float(h),
            "base": float(elevation(x, z)),
            "color": color,
            "district": district_for(x, z),
            "landmark": "/ LM-" in name,
        }
        buildings.append(b)
        occupied.append({"x": x, "z": z, "r": max(w, d) / 2})
        return b

    for x, z, w, d, h, name in LANDMARKS:
        add(x, z, w, d, h, "#d9e4e5", name)

    for x in (-520, -300, -80, 120, 330):
        for z in (80, 250, 470, 690, 760):
            if near(roads, x, z, 30) or math.hypot(x + 100, z - 500) < 95:
                continue
            h = 75 + js_round(100 * (1 - min(1, math.hypot(x, z - 400) / 700)))
            add(x, z, 42, 48, h, "#83aec4", "Downtown tower")

    for di, d in enumerate(DISTRICTS):
        name, x1, x2, z1, z2, color = d
        step = 170 if di == 0 else 180 if di == 4 else 150 if di == 8 else 100
        x = x1 + 60
        while x < x2 - 40:
            z = z1 + 60
            while z < z2 - 40:
                w = 100 if di == 4 else 42 if di == 0 else 35 if di == 1 else 58 if di == 3 else 42
                dep = 65 if di == 4 else 35
                pad = max(w, dep) * 0.65
                if near(roads, x, z, pad) or near(water, x, z, pad) or any(
                    math.hypot(x - o["x"], z - o["z"]) < o["r"] + 55 for o in occupied
                ):
                    z += step
                    continue
                if di == 8 and x > 200:
                    z += step
                    continue
                if di == 0 and rng.random() < 0.4:
                    z += step
                    continue
                if di == 2:
                    h = 35 + js_round(rng.random() * 100)
                elif di == 3:
                    h = 25 + rng.random() * 50
                elif di == 4:
                    h = 12 + rng.random() * 12
                elif di == 8:
                    h = 25 + rng.random() * 30
                elif di == 0:
                    h = 10 + rng.random() * 8
                else:
                    h = 12 + rng.random() * 22
                add(x, z, w, dep, h, color, name + " block")
                z += step
            x += step
    return buildings


def bridge_list():
    bridges = []

    def add(x, z, w, length, vertical=False):
        bridges.append({
            "id": f"BR-{len(bridges) + 1:02d}", "x": float(x), "z": float(z),
            "width": float(w), "length": float(length), "vertical": bool(vertical),
        })

    def x_at(points, z):
        for i in range(1, len(points)):
            if z <= points[i - 1][1] and z >= points[i][1]:
                t = (z - points[i - 1][1]) / (points[i][1] - points[i - 1][1])
                return points[i - 1][0] + t * (points[i][0] - points[i - 1][0])
        return 700

    for z in (950, 650, 350, -350, -950, -1400):
        add(x_at(WEST_WATER, z), z, 28, 140)
        add(x_at(EAST_WATER, z), z, 28, 140)
    for x in (-400, 150):
        add(x, -1300, 26, 140, True)
    for z in (-200, -500, -800, -1050):
        for x in (-1650, -1000):
            add(x, z, 14, 66, True)
    add(455, 1150, 34, 150)
    add(740, -1400, 34, 150)
    return bridges


def converter(anchor_lat, anchor_lon):
    m_per_deg_lat = 111_320.0
    m_per_deg_lon = max(1e-9, 111_320.0 * math.cos(math.radians(anchor_lat)))

    def ll(x, z):
        return [anchor_lon + x / m_per_deg_lon, anchor_lat + z / m_per_deg_lat]

    return ll


def polygon_from_center(ll, x, z, w, d):
    points = [
        (x - w / 2, z - d / 2), (x + w / 2, z - d / 2),
        (x + w / 2, z + d / 2), (x - w / 2, z + d / 2),
        (x - w / 2, z - d / 2),
    ]
    return [ll(px, pz) for px, pz in points]


def feature_collection(features, **meta):
    return {"type": "FeatureCollection", "features": features, "mirage": meta}


def write_json(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="public/voxcity", help="Output directory")
    parser.add_argument("--anchor-lat", type=float, default=0.0)
    parser.add_argument("--anchor-lon", type=float, default=0.0)
    args = parser.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    ll = converter(args.anchor_lat, args.anchor_lon)

    roads, water = build_linear_network()
    buildings = build_buildings(roads, water)
    bridges = bridge_list()

    bfeatures = []
    for b in buildings:
        props = {
            "id": b["id"], "building_id": b["id"], "name": b["type"], "type": b["type"],
            "height": round(b["height"], 3), "min_height": 0.0,
            "district": b["district"], "landmark": b["landmark"],
            "local_x_m": b["x"], "local_z_m": b["z"],
            "width_m": b["width"], "depth_m": b["depth"],
            "base_elevation_m": round(b["base"], 3), "planner_color": b["color"],
        }
        bfeatures.append({
            "type": "Feature", "properties": props,
            "geometry": {"type": "Polygon", "coordinates": [[*polygon_from_center(ll, b["x"], b["z"], b["width"], b["depth"])]]},
        })

    write_json(out / "mirage-buildings.geojson", feature_collection(
        bfeatures, source="Mirage City 3D Planning Explorer", units="metres",
        local_axes="X east, Z north, Y up", anchor_lat=args.anchor_lat,
        anchor_lon=args.anchor_lon, building_count=len(bfeatures),
        intended_consumer="VoxCity / GeoPandas",
    ))

    rfeatures = []
    for i, r in enumerate(roads, 1):
        rfeatures.append({
            "type": "Feature",
            "properties": {"id": f"ROAD-{i:03d}", "kind": r["kind"], "width_m": r["width"]},
            "geometry": {"type": "LineString", "coordinates": [ll(x, z) for x, z in r["points"]]},
        })
    write_json(out / "mirage-roads.geojson", feature_collection(rfeatures, anchor_lat=args.anchor_lat, anchor_lon=args.anchor_lon))

    wfeatures = []
    for i, r in enumerate(water, 1):
        wfeatures.append({
            "type": "Feature",
            "properties": {"id": f"WATER-{i:02d}", "kind": r["kind"], "width_m": r["width"]},
            "geometry": {"type": "LineString", "coordinates": [ll(x, z) for x, z in r["points"]]},
        })
    write_json(out / "mirage-water.geojson", feature_collection(wfeatures, anchor_lat=args.anchor_lat, anchor_lon=args.anchor_lon))

    dfeatures = []
    for i, (name, x1, x2, z1, z2, color) in enumerate(DISTRICTS, 1):
        ring = [ll(x1, z1), ll(x2, z1), ll(x2, z2), ll(x1, z2), ll(x1, z1)]
        dfeatures.append({
            "type": "Feature",
            "properties": {"id": f"DIST-{i:02d}", "name": name, "planner_color": color, "local_bounds_m": [x1, z1, x2, z2]},
            "geometry": {"type": "Polygon", "coordinates": [ring]},
        })
    write_json(out / "mirage-districts.geojson", feature_collection(dfeatures, anchor_lat=args.anchor_lat, anchor_lon=args.anchor_lon))

    brfeatures = []
    for b in bridges:
        w = b["width"] if b["vertical"] else b["length"]
        d = b["length"] if b["vertical"] else b["width"]
        brfeatures.append({
            "type": "Feature",
            "properties": {**b, "local_x_m": b["x"], "local_z_m": b["z"]},
            "geometry": {"type": "Polygon", "coordinates": [polygon_from_center(ll, b["x"], b["z"], w, d)]},
        })
    write_json(out / "mirage-bridges.geojson", feature_collection(brfeatures, anchor_lat=args.anchor_lat, anchor_lon=args.anchor_lon))

    all_lons = [c[0] for f in bfeatures for c in f["geometry"]["coordinates"][0]]
    all_lats = [c[1] for f in bfeatures for c in f["geometry"]["coordinates"][0]]
    manifest = {
        "city": "Mirage City", "planner_size_m": [4000, 4000], "source": "public/mirage-world.html",
        "anchor": {"lat": args.anchor_lat, "lon": args.anchor_lon, "synthetic": args.anchor_lat == 0 and args.anchor_lon == 0},
        "building_count": len(buildings), "road_feature_count": len(roads), "water_feature_count": len(water),
        "bridge_count": len(bridges), "district_count": len(DISTRICTS),
        "rectangle_vertices": [
            [min(all_lons), min(all_lats)], [min(all_lons), max(all_lats)],
            [max(all_lons), max(all_lats)], [max(all_lons), min(all_lats)],
        ],
        "files": {
            "buildings": "mirage-buildings.geojson", "roads": "mirage-roads.geojson",
            "water": "mirage-water.geojson", "bridges": "mirage-bridges.geojson", "districts": "mirage-districts.geojson",
        },
        "notes": [
            "The WGS84 anchor is synthetic by default; local metre coordinates are preserved in feature properties.",
            "Building footprints/heights reproduce the deterministic procedural planner, including its seeded infill.",
            "This is a planning export, not an engineering survey.",
        ],
    }
    write_json(out / "mirage-voxcity-manifest.json", manifest)
    print(json.dumps({"output": str(out), "buildings": len(buildings), "roads": len(roads), "water": len(water), "bridges": len(bridges)}, indent=2))


if __name__ == "__main__":
    main()
