#!/usr/bin/env python3
"""Generate a detailed visual overlay for the 4 km Mirage City VoxCity shell.

The base VoxCity mesh intentionally stays lightweight. This pass adds game-readable
facades, window bands, balconies, roof trims, street trees, lamps, benches, bins,
road curbs/markings, landmark silhouettes, and open landmark entrance lobbies.

Outputs:
  public/voxcity/glb/mirage-city-details.glb
  public/voxcity/glb/chunks/detail-sector-*.glb

It also augments the existing chunk manifest with `detailFile` so the Babylon
runtime streams each detail sector together with its VoxCity shell sector.
"""

from __future__ import annotations

import json
import math
from collections import defaultdict
from pathlib import Path

import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals

from export_voxcity_geojson import (
    build_buildings,
    build_linear_network,
    district_for,
    elevation,
)

OUT = Path("public/voxcity/glb")
CHUNKS = OUT / "chunks"
EXTENT = 2000.0
EDGE = EXTENT * 2.0 / 3.0
BANDS = (-EXTENT, -EXTENT + EDGE, -EXTENT + 2.0 * EDGE, EXTENT)

COLORS: dict[str, tuple[int, int, int, int]] = {
    "facade_downtown": (91, 119, 143, 255),
    "facade_old": (168, 125, 92, 255),
    "facade_tech": (78, 111, 145, 255),
    "facade_industrial": (111, 115, 113, 255),
    "facade_canal": (121, 155, 146, 255),
    "facade_night": (119, 86, 128, 255),
    "facade_river": (142, 155, 118, 255),
    "facade_beach": (203, 187, 145, 255),
    "facade_hills": (146, 160, 128, 255),
    "facade_outside": (135, 142, 145, 255),
    "glass_blue": (38, 83, 111, 255),
    "glass_warm": (165, 131, 79, 255),
    "trim_light": (210, 214, 211, 255),
    "trim_dark": (54, 60, 64, 255),
    "road_white": (232, 231, 219, 255),
    "road_yellow": (232, 192, 62, 255),
    "curb": (169, 171, 168, 255),
    "tree_trunk": (105, 72, 45, 255),
    "tree_leaf": (69, 121, 67, 255),
    "palm_leaf": (52, 123, 75, 255),
    "metal": (62, 69, 76, 255),
    "bench": (126, 88, 56, 255),
    "bin": (58, 74, 70, 255),
    "interior_floor": (176, 164, 143, 255),
    "interior_wall": (225, 219, 205, 255),
    "interior_furniture": (88, 71, 60, 255),
    "neon_cyan": (39, 203, 224, 255),
    "neon_pink": (229, 59, 151, 255),
    "police_blue": (38, 89, 208, 255),
    "police_red": (210, 47, 47, 255),
    "resort_pool": (51, 151, 190, 255),
}

DISTRICT_MATERIAL = {
    "DOWNTOWN": "facade_downtown",
    "OLD TOWN": "facade_old",
    "TECH / BUSINESS": "facade_tech",
    "INDUSTRIAL PORT": "facade_industrial",
    "CANAL RESIDENTIAL": "facade_canal",
    "NIGHTLIFE": "facade_night",
    "RIVERSIDE": "facade_river",
    "BEACH / MARINA": "facade_beach",
    "HILLS / VIP": "facade_hills",
    "OUTSIDE": "facade_outside",
}


def material(name: str) -> PBRMaterial:
    rgba = COLORS[name]
    return PBRMaterial(
        name=name,
        baseColorFactor=np.asarray(rgba, dtype=np.uint8),
        metallicFactor=0.05 if name in {"metal", "trim_dark"} else 0.0,
        roughnessFactor=0.55 if name.startswith("glass") else 0.9,
        emissiveFactor=np.asarray(
            [0.18, 0.65, 0.72] if name == "neon_cyan"
            else [0.72, 0.10, 0.42] if name == "neon_pink"
            else [0.0, 0.0, 0.0],
            dtype=float,
        ),
    )


def transform(center: tuple[float, float, float], yaw: float = 0.0) -> np.ndarray:
    matrix = trimesh.transformations.rotation_matrix(yaw, [0.0, 1.0, 0.0])
    matrix[:3, 3] = np.asarray(center, dtype=float)
    return matrix


def box(center: tuple[float, float, float], size: tuple[float, float, float], yaw: float = 0.0) -> trimesh.Trimesh:
    return trimesh.creation.box(extents=size, transform=transform(center, yaw))


def sphere(center: tuple[float, float, float], radius: float, scale_y: float = 1.0) -> trimesh.Trimesh:
    mesh = trimesh.creation.icosphere(subdivisions=1, radius=radius)
    mesh.apply_scale([1.0, scale_y, 1.0])
    mesh.apply_translation(center)
    return mesh


def sector_id(x: float, z: float) -> str:
    xi = 0 if x < BANDS[1] else 1 if x < BANDS[2] else 2
    zi = 0 if z < BANDS[1] else 1 if z < BANDS[2] else 2
    return (
        ("sw", "s", "se"),
        ("w", "center", "e"),
        ("nw", "n", "ne"),
    )[zi][xi]


class DetailScene:
    def __init__(self) -> None:
        self.full: dict[str, list[trimesh.Trimesh]] = defaultdict(list)
        self.sectors: dict[str, dict[str, list[trimesh.Trimesh]]] = defaultdict(lambda: defaultdict(list))
        self.counts: dict[str, int] = defaultdict(int)

    def add(self, mat: str, mesh: trimesh.Trimesh, x: float, z: float, kind: str) -> None:
        self.full[mat].append(mesh)
        self.sectors[sector_id(x, z)][mat].append(mesh.copy())
        self.counts[kind] += 1

    def add_box(self, mat: str, center, size, kind: str, yaw: float = 0.0) -> None:
        self.add(mat, box(center, size, yaw), float(center[0]), float(center[2]), kind)

    def add_sphere(self, mat: str, center, radius: float, kind: str, scale_y: float = 1.0) -> None:
        self.add(mat, sphere(center, radius, scale_y), float(center[0]), float(center[2]), kind)


def merged_scene(buckets: dict[str, list[trimesh.Trimesh]]) -> trimesh.Scene:
    scene = trimesh.Scene()
    for mat_name, meshes in buckets.items():
        if not meshes:
            continue
        merged = trimesh.util.concatenate(meshes)
        merged.visual = TextureVisuals(material=material(mat_name))
        scene.add_geometry(merged, geom_name=mat_name, node_name=mat_name)
    return scene


def facade_material(district: str) -> str:
    return DISTRICT_MATERIAL.get(district, "facade_outside")


def add_facade(detail: DetailScene, b: dict) -> None:
    x, z = float(b["x"]), float(b["z"])
    w, d, h = float(b["width"]), float(b["depth"]), float(b["height"])
    base = float(b["base"])
    district = str(b["district"])
    mat = facade_material(district)

    # Clean architectural skin over the coarse voxel mass.
    detail.add_box(mat, (x, base + h * 0.5, z), (w + 0.45, h, d + 0.45), "facade")
    detail.add_box("trim_dark", (x, base + 0.45, z), (w + 0.8, 0.9, d + 0.8), "plinth")

    # Roof parapet/cornice.
    roof_y = base + h + 0.45
    detail.add_box("trim_light", (x, roof_y, z - d * 0.5), (w + 0.8, 0.9, 0.55), "roof-trim")
    detail.add_box("trim_light", (x, roof_y, z + d * 0.5), (w + 0.8, 0.9, 0.55), "roof-trim")
    detail.add_box("trim_light", (x - w * 0.5, roof_y, z), (0.55, 0.9, d + 0.8), "roof-trim")
    detail.add_box("trim_light", (x + w * 0.5, roof_y, z), (0.55, 0.9, d + 0.8), "roof-trim")

    if district == "INDUSTRIAL PORT":
        row_gap = 8.0
        glass = "glass_warm"
    elif district == "OLD TOWN":
        row_gap = 7.0
        glass = "glass_warm"
    else:
        row_gap = 5.2
        glass = "glass_blue"

    max_rows = 12 if district in {"DOWNTOWN", "TECH / BUSINESS"} else 8
    rows = max(1, min(max_rows, int((h - 3.0) / row_gap)))
    for row in range(rows):
        y = base + 3.3 + row * row_gap
        if y > base + h - 1.6:
            break
        front_span = max(3.0, w * (0.72 if district != "OLD TOWN" else 0.58))
        side_span = max(3.0, d * (0.72 if district != "OLD TOWN" else 0.58))
        height = 1.55 if district != "OLD TOWN" else 1.25
        detail.add_box(glass, (x, y, z - d * 0.5 - 0.28), (front_span, height, 0.22), "windows")
        detail.add_box(glass, (x, y, z + d * 0.5 + 0.28), (front_span, height, 0.22), "windows")
        detail.add_box(glass, (x - w * 0.5 - 0.28, y, z), (0.22, height, side_span), "windows")
        detail.add_box(glass, (x + w * 0.5 + 0.28, y, z), (0.22, height, side_span), "windows")

        if district in {"CANAL RESIDENTIAL", "RIVERSIDE", "BEACH / MARINA"} and row % 2 == 0:
            detail.add_box("trim_light", (x, y - 1.15, z - d * 0.5 - 0.9), (w * 0.62, 0.16, 1.35), "balcony")


def add_open_lobby(detail: DetailScene, b: dict) -> None:
    x, z = float(b["x"]), float(b["z"])
    w, d = float(b["width"]), float(b["depth"])
    base = float(b["base"])
    lobby_w = min(28.0, max(18.0, w * 0.42))
    lobby_d = 13.0
    lobby_z = z - d * 0.5 - lobby_d * 0.43

    detail.add_box("interior_floor", (x, base + 0.12, lobby_z), (lobby_w, 0.24, lobby_d), "interior")
    detail.add_box("interior_wall", (x, base + 3.5, lobby_z + lobby_d * 0.48), (lobby_w, 7.0, 0.35), "interior")
    detail.add_box("glass_blue", (x - lobby_w * 0.49, base + 3.5, lobby_z), (0.30, 7.0, lobby_d), "interior")
    detail.add_box("glass_blue", (x + lobby_w * 0.49, base + 3.5, lobby_z), (0.30, 7.0, lobby_d), "interior")
    detail.add_box("trim_dark", (x, base + 7.05, lobby_z), (lobby_w, 0.30, lobby_d), "interior")
    detail.add_box("interior_furniture", (x, base + 1.15, lobby_z + 2.2), (5.8, 1.4, 1.2), "interior")
    for sx in (-1, 1):
        detail.add_box("interior_furniture", (x + sx * 6.2, base + 0.75, lobby_z - 1.6), (3.6, 0.9, 1.8), "interior")
    for sx in (-0.35, 0.35):
        detail.add_box("neon_cyan", (x + lobby_w * sx, base + 6.65, lobby_z), (3.0, 0.12, 0.55), "interior-light")


def add_landmark_features(detail: DetailScene, b: dict) -> None:
    name = str(b["type"])
    x, z = float(b["x"]), float(b["z"])
    w, d, h = float(b["width"]), float(b["depth"]), float(b["height"])
    base = float(b["base"])
    top = base + h

    add_open_lobby(detail, b)

    if "Apex Tower" in name:
        for i, scale in enumerate((0.74, 0.50, 0.30)):
            detail.add_box("trim_light", (x, top + 2.0 + i * 3.3, z), (w * scale, 2.2, d * scale), "landmark")
        detail.add_box("neon_cyan", (x, top + 15.0, z), (1.3, 21.0, 1.3), "landmark")
    elif "Police HQ" in name:
        canopy_z = z - d * 0.5 - 7.0
        detail.add_box("trim_light", (x, base + 5.3, canopy_z), (28.0, 0.7, 11.0), "landmark")
        for sx in (-10.0, -3.3, 3.3, 10.0):
            detail.add_box("trim_light", (x + sx, base + 2.7, canopy_z), (0.9, 5.4, 0.9), "landmark")
        detail.add_box("police_blue", (x - 6.0, top + 1.1, z), (10.0, 1.5, 2.2), "landmark")
        detail.add_box("police_red", (x + 6.0, top + 1.1, z), (10.0, 1.5, 2.2), "landmark")
    elif "Tech Tower" in name:
        for sx in (-1, 1):
            detail.add_box("neon_cyan", (x + sx * (w * 0.5 + 0.6), base + h * 0.55, z), (0.8, h * 0.76, d * 0.70), "landmark")
        detail.add_box("metal", (x, top + 11.0, z), (1.2, 22.0, 1.2), "landmark")
    elif "Market Hall" in name:
        detail.add_box("facade_old", (x, top + 3.0, z), (w * 0.82, 6.0, d * 0.76), "landmark")
        awning_z = z - d * 0.5 - 2.5
        for sx in (-0.32, 0.0, 0.32):
            detail.add_box("road_yellow", (x + sx * w, base + 4.0, awning_z), (w * 0.22, 0.35, 5.0), "landmark")
    elif "Hilltop Mansion" in name:
        gate_z = z - d * 0.5 - 11.0
        for sx in (-8.0, 8.0):
            detail.add_box("trim_light", (x + sx, base + 3.0, gate_z), (1.8, 6.0, 1.8), "landmark")
        detail.add_box("metal", (x, base + 2.2, gate_z), (13.5, 3.8, 0.35), "landmark")
        for sx in (-22.0, 22.0):
            add_tree(detail, x + sx, z - d * 0.5 - 9.0, base, palm=False)
    elif "Casino" in name:
        detail.add_box("neon_pink", (x, top - 4.0, z - d * 0.5 - 0.45), (w * 0.78, 1.15, 0.35), "landmark")
        detail.add_box("neon_cyan", (x, top - 8.0, z - d * 0.5 - 0.48), (w * 0.62, 0.8, 0.38), "landmark")
        detail.add_box("trim_light", (x, base + 6.0, z - d * 0.5 - 8.0), (34.0, 0.7, 14.0), "landmark")
    elif "Riverside Hotel" in name:
        for y in np.arange(base + 8.0, top - 2.0, 7.5):
            detail.add_box("trim_light", (x, float(y), z - d * 0.5 - 0.9), (w * 0.72, 0.18, 1.6), "landmark")
    elif "Grand Resort" in name:
        for y in np.arange(base + 8.0, top - 2.0, 8.0):
            detail.add_box("trim_light", (x, float(y), z - d * 0.5 - 1.0), (w * 0.78, 0.18, 1.8), "landmark")
        detail.add_box("trim_light", (x, base + 6.0, z - d * 0.5 - 9.0), (42.0, 0.8, 16.0), "landmark")
        detail.add_box("resort_pool", (x + w * 0.58, base + 0.16, z - 7.0), (34.0, 0.25, 18.0), "landmark")

    # Landmark street furniture around the entrance.
    entry_z = z - d * 0.5 - 13.0
    for sx in (-12.0, 12.0):
        add_lamp(detail, x + sx, entry_z, base)
    add_bench(detail, x - 7.0, entry_z - 3.0, base, 0.0)
    add_bench(detail, x + 7.0, entry_z - 3.0, base, math.pi)
    detail.add_box("bin", (x + 14.5, base + 0.55, entry_z - 3.0), (0.8, 1.1, 0.8), "street-prop")


def add_tree(detail: DetailScene, x: float, z: float, base: float, palm: bool) -> None:
    if palm:
        detail.add_box("tree_trunk", (x, base + 3.8, z), (0.7, 7.6, 0.7), "tree")
        for ox, oz in ((0, 0), (1.5, 0), (-1.5, 0), (0, 1.5), (0, -1.5)):
            detail.add_sphere("palm_leaf", (x + ox, base + 8.0, z + oz), 2.2, "tree", 0.42)
    else:
        detail.add_box("tree_trunk", (x, base + 2.2, z), (0.75, 4.4, 0.75), "tree")
        detail.add_sphere("tree_leaf", (x, base + 5.7, z), 3.2, "tree", 1.05)


def add_lamp(detail: DetailScene, x: float, z: float, base: float) -> None:
    detail.add_box("metal", (x, base + 3.2, z), (0.28, 6.4, 0.28), "lamp")
    detail.add_box("trim_light", (x + 0.7, base + 6.35, z), (1.55, 0.26, 0.48), "lamp")


def add_bench(detail: DetailScene, x: float, z: float, base: float, yaw: float) -> None:
    detail.add_box("bench", (x, base + 0.7, z), (3.4, 0.28, 1.0), "street-prop", yaw)
    detail.add_box("bench", (x, base + 1.25, z + math.cos(yaw) * 0.42), (3.4, 1.0, 0.18), "street-prop", yaw)


def split_segment(a: tuple[float, float], b: tuple[float, float], max_len: float = 170.0):
    dx, dz = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dz)
    parts = max(1, int(math.ceil(length / max_len)))
    for i in range(parts):
        t0, t1 = i / parts, (i + 1) / parts
        yield (
            (a[0] + dx * t0, a[1] + dz * t0),
            (a[0] + dx * t1, a[1] + dz * t1),
        )


def add_road_details(detail: DetailScene, roads: list[dict]) -> None:
    prop_counter = 0
    for road in roads:
        width = float(road["width"])
        kind = str(road["kind"])
        points = road["points"]
        for idx in range(1, len(points)):
            a, b = points[idx - 1], points[idx]
            for sa, sb in split_segment(a, b):
                dx, dz = sb[0] - sa[0], sb[1] - sa[1]
                length = math.hypot(dx, dz)
                if length < 1.0:
                    continue
                ux, uz = dx / length, dz / length
                nx, nz = -uz, ux
                yaw = -math.atan2(dz, dx)
                mx, mz = (sa[0] + sb[0]) * 0.5, (sa[1] + sb[1]) * 0.5
                base = elevation(mx, mz)

                if width >= 14:
                    for side in (-1.0, 1.0):
                        off = width * 0.5 + 0.35
                        detail.add_box(
                            "curb",
                            (mx + nx * off * side, base + 0.19, mz + nz * off * side),
                            (length, 0.30, 0.48),
                            "curb",
                            yaw,
                        )

                # Lane markings, split into short dashes so streaming remains local.
                dash_step = 30.0 if width >= 20 else 36.0
                dash_len = 7.0 if width >= 20 else 5.0
                samples = max(1, int(length / dash_step))
                for i in range(samples):
                    t = (i + 0.5) / samples
                    px, pz = sa[0] + dx * t, sa[1] + dz * t
                    py = elevation(px, pz) + 0.22
                    center_mat = "road_yellow" if kind in {"ring", "arterial", "coastal", "east-bypass"} else "road_white"
                    detail.add_box(center_mat, (px, py, pz), (dash_len, 0.06, 0.24), "road-marking", yaw)
                    if width >= 24:
                        lane_off = width * 0.22
                        for side in (-1.0, 1.0):
                            detail.add_box(
                                "road_white",
                                (px + nx * lane_off * side, py, pz + nz * lane_off * side),
                                (dash_len, 0.055, 0.20),
                                "road-marking",
                                yaw,
                            )

                if width < 20 or kind == "local":
                    continue

                # Spaced lamps / trees on important roads.
                prop_counter += 1
                if prop_counter % 2 != 0:
                    continue
                for side in (-1.0, 1.0):
                    off = width * 0.5 + 7.0
                    px, pz = mx + nx * off * side, mz + nz * off * side
                    py = elevation(px, pz)
                    add_lamp(detail, px, pz, py)
                    district = district_for(px, pz)
                    if district != "INDUSTRIAL PORT" and prop_counter % 4 == 0:
                        add_tree(detail, px + ux * 9.0, pz + uz * 9.0, py, district == "BEACH / MARINA")
                    if prop_counter % 7 == 0 and district not in {"INDUSTRIAL PORT", "OUTSIDE"}:
                        add_bench(detail, px - ux * 7.0, pz - uz * 7.0, py, yaw)


def write_scene(scene: trimesh.Scene, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(scene.export(file_type="glb"))


def main() -> int:
    roads, water = build_linear_network()
    buildings = build_buildings(roads, water)
    detail = DetailScene()

    for b in buildings:
        add_facade(detail, b)
        if b.get("landmark"):
            add_landmark_features(detail, b)

    add_road_details(detail, roads)

    OUT.mkdir(parents=True, exist_ok=True)
    CHUNKS.mkdir(parents=True, exist_ok=True)
    write_scene(merged_scene(detail.full), OUT / "mirage-city-details.glb")

    for sid in ("sw", "s", "se", "w", "center", "e", "nw", "n", "ne"):
        write_scene(merged_scene(detail.sectors.get(sid, {})), CHUNKS / f"detail-sector-{sid}.glb")

    manifest_path = CHUNKS / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    for sector in manifest.get("sectors", []):
        sid = sector["id"]
        sector["detailFile"] = f"detail-sector-{sid}.glb"
    manifest["detailModel"] = "../mirage-city-details.glb"
    manifest["detailVersion"] = 1
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    status = {
        "generator": "Mirage procedural city detail pass",
        "buildings_detailed": len(buildings),
        "landmarks_detailed": sum(1 for b in buildings if b.get("landmark")),
        "counts": dict(sorted(detail.counts.items())),
        "full_detail_glb": "mirage-city-details.glb",
        "streamed_detail_sectors": 9,
        "features": [
            "district facade skins",
            "window ribbons",
            "balconies and roof trims",
            "road curbs and lane markings",
            "street lamps, trees, benches and bins",
            "eight landmark silhouette upgrades",
            "open landmark entrance lobby geometry",
        ],
    }
    (OUT / "mirage-city-details-status.json").write_text(json.dumps(status, indent=2) + "\n", encoding="utf-8")

    print(json.dumps(status, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
