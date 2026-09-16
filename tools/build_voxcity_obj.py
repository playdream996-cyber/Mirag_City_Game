#!/usr/bin/env python3
"""Build a VoxCity-style OBJ directly from the deterministic Mirage City planner.

This keeps Mirage City's fictional 4 km layout fully local: no OpenStreetMap,
Earth Engine, DEM, or other real-world downloads are required. The script
reuses the exact seeded planner definitions from export_voxcity_geojson.py,
rasterizes terrain/roads/water/buildings/bridges into a voxel grid, and then
uses VoxCity's official OBJ exporter (greedy meshing + MTL output).

Install once:
    pip install voxcity

Run:
    python tools/build_voxcity_obj.py

Higher detail (slower/larger):
    python tools/build_voxcity_obj.py --meshsize 5
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np

from export_voxcity_geojson import (
    bridge_list,
    build_buildings,
    build_linear_network,
    distance_to_segment,
    elevation,
)

# Custom material ids. VoxCity accepts arbitrary non-zero ids when a matching
# color map is supplied to export_obj().
GROUND = 1
ROAD = 2
WATER = 3
BUILDING = 4
LANDMARK = 5
BRIDGE = 6

COLORS = {
    GROUND: [83, 121, 92],
    ROAD: [52, 68, 83],
    WATER: [36, 101, 120],
    BUILDING: [131, 174, 196],
    LANDMARK: [217, 228, 229],
    BRIDGE: [221, 195, 145],
}


def clamp(v: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, v))


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Generate Mirage City OBJ using VoxCity's OBJ exporter")
    p.add_argument("--meshsize", type=float, default=10.0, help="Voxel edge length in metres (default: 10)")
    p.add_argument("--out", default="public/voxcity/obj", help="Output folder")
    p.add_argument("--name", default="mirage-city-voxcity", help="OBJ/MTL base filename")
    p.add_argument("--extent", type=float, default=2000.0, help="Half-size of square world in metres")
    return p.parse_args()


def world_to_ix(x: float, x_min: float, mesh: float) -> int:
    return int(math.floor((x - x_min) / mesh))


def world_to_iz(z: float, z_min: float, mesh: float) -> int:
    return int(math.floor((z - z_min) / mesh))


def surface_layer(x: float, z: float, mesh: float, ny: int) -> int:
    # Terrain occupies [0, elevation). The visible top terrain voxel is the
    # last filled layer, which roads/water replace for material visibility.
    return clamp(max(0, int(math.ceil(elevation(x, z) / mesh)) - 1), 0, ny - 1)


def paint_paths(vox: np.ndarray, paths: list[dict], value: int, *, x_min: float, z_min: float, mesh: float) -> None:
    nz, nx, ny = vox.shape
    for path in paths:
        radius = float(path["width"]) / 2.0
        points = path["points"]
        for idx in range(1, len(points)):
            a = points[idx - 1]
            b = points[idx]
            bx0 = min(a[0], b[0]) - radius - mesh
            bx1 = max(a[0], b[0]) + radius + mesh
            bz0 = min(a[1], b[1]) - radius - mesh
            bz1 = max(a[1], b[1]) + radius + mesh
            ix0 = clamp(world_to_ix(bx0, x_min, mesh), 0, nx - 1)
            ix1 = clamp(world_to_ix(bx1, x_min, mesh), 0, nx - 1)
            iz0 = clamp(world_to_iz(bz0, z_min, mesh), 0, nz - 1)
            iz1 = clamp(world_to_iz(bz1, z_min, mesh), 0, nz - 1)
            for iz in range(iz0, iz1 + 1):
                z = z_min + (iz + 0.5) * mesh
                for ix in range(ix0, ix1 + 1):
                    x = x_min + (ix + 0.5) * mesh
                    if distance_to_segment(x, z, a, b) <= radius:
                        vox[iz, ix, surface_layer(x, z, mesh, ny)] = value


def paint_buildings(vox: np.ndarray, buildings: list[dict], *, x_min: float, z_min: float, mesh: float) -> None:
    nz, nx, ny = vox.shape
    for b in buildings:
        x0 = b["x"] - b["width"] / 2.0
        x1 = b["x"] + b["width"] / 2.0
        z0 = b["z"] - b["depth"] / 2.0
        z1 = b["z"] + b["depth"] / 2.0
        ix0 = clamp(world_to_ix(x0, x_min, mesh), 0, nx - 1)
        ix1 = clamp(world_to_ix(x1, x_min, mesh), 0, nx - 1)
        iz0 = clamp(world_to_iz(z0, z_min, mesh), 0, nz - 1)
        iz1 = clamp(world_to_iz(z1, z_min, mesh), 0, nz - 1)
        k0 = clamp(int(math.floor(float(b["base"]) / mesh)), 0, ny - 1)
        k1 = clamp(int(math.ceil((float(b["base"]) + float(b["height"])) / mesh)), k0 + 1, ny)
        value = LANDMARK if b.get("landmark") else BUILDING
        vox[iz0 : iz1 + 1, ix0 : ix1 + 1, k0:k1] = value


def paint_bridges(vox: np.ndarray, bridges: list[dict], *, x_min: float, z_min: float, mesh: float) -> None:
    nz, nx, ny = vox.shape
    for b in bridges:
        if b["vertical"]:
            width_x = b["width"]
            depth_z = b["length"]
        else:
            width_x = b["length"]
            depth_z = b["width"]
        x0, x1 = b["x"] - width_x / 2.0, b["x"] + width_x / 2.0
        z0, z1 = b["z"] - depth_z / 2.0, b["z"] + depth_z / 2.0
        ix0 = clamp(world_to_ix(x0, x_min, mesh), 0, nx - 1)
        ix1 = clamp(world_to_ix(x1, x_min, mesh), 0, nx - 1)
        iz0 = clamp(world_to_iz(z0, z_min, mesh), 0, nz - 1)
        iz1 = clamp(world_to_iz(z1, z_min, mesh), 0, nz - 1)
        # Planner bridge deck sits at roughly Y=13..18 m.
        k0 = clamp(int(math.floor(13.0 / mesh)), 0, ny - 1)
        k1 = clamp(max(k0 + 1, int(math.ceil(18.0 / mesh))), k0 + 1, ny)
        vox[iz0 : iz1 + 1, ix0 : ix1 + 1, k0:k1] = BRIDGE


def main() -> int:
    args = parse_args()
    if args.meshsize <= 0:
        raise SystemExit("--meshsize must be > 0")

    try:
        from voxcity.exporter.obj import export_obj
    except Exception as exc:
        raise SystemExit(
            "VoxCity is required. Install it with: pip install voxcity\n"
            f"Import error: {exc}"
        ) from exc

    roads, water = build_linear_network()
    buildings = build_buildings(roads, water)
    bridges = bridge_list()

    extent = float(args.extent)
    mesh = float(args.meshsize)
    x_min = -extent
    z_min = -extent
    x_max = extent
    z_max = extent
    nx = int(math.ceil((x_max - x_min) / mesh))
    nz = int(math.ceil((z_max - z_min) / mesh))

    max_y = max(float(b["base"]) + float(b["height"]) for b in buildings) + 30.0
    ny = int(math.ceil(max_y / mesh))
    vox = np.zeros((nz, nx, ny), dtype=np.uint8)

    print(f"Voxel grid: north={nz} east={nx} up={ny} @ {mesh:g} m")

    # Terrain: fill from sea level to the planner's procedural elevation.
    xs = x_min + (np.arange(nx) + 0.5) * mesh
    zs = z_min + (np.arange(nz) + 0.5) * mesh
    terrain_layers = np.empty((nz, nx), dtype=np.int16)
    for iz, z in enumerate(zs):
        for ix, x in enumerate(xs):
            terrain_layers[iz, ix] = max(1, int(math.ceil(elevation(float(x), float(z)) / mesh)))
    for k in range(min(ny, int(terrain_layers.max()))):
        vox[:, :, k][terrain_layers > k] = GROUND

    paint_paths(vox, roads, ROAD, x_min=x_min, z_min=z_min, mesh=mesh)
    paint_paths(vox, water, WATER, x_min=x_min, z_min=z_min, mesh=mesh)
    paint_bridges(vox, bridges, x_min=x_min, z_min=z_min, mesh=mesh)
    paint_buildings(vox, buildings, x_min=x_min, z_min=z_min, mesh=mesh)

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    export_obj(vox, str(out), args.name, voxel_size=mesh, voxel_color_map=COLORS)

    status = {
        "generator": "VoxCity export_obj",
        "source": "Mirage City deterministic planner",
        "meshsize_m": mesh,
        "world_extent_m": [x_min, z_min, x_max, z_max],
        "voxel_shape_north_east_up": [nz, nx, ny],
        "buildings": len(buildings),
        "roads": len(roads),
        "water_paths": len(water),
        "bridges": len(bridges),
        "obj": f"{args.name}.obj",
        "mtl": f"{args.name}.mtl",
        "materials": {
            "1": "ground", "2": "road", "3": "water",
            "4": "building", "5": "landmark", "6": "bridge",
        },
    }
    (out / f"{args.name}-status.json").write_text(json.dumps(status, indent=2) + "\n", encoding="utf-8")

    print(f"Created: {out / (args.name + '.obj')}")
    print(f"Created: {out / (args.name + '.mtl')}")
    print(f"Created: {out / (args.name + '-status.json')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
