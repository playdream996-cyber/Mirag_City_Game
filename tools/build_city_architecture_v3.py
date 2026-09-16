#!/usr/bin/env python3
"""Upgrade the Mirage City procedural detail GLB with visibly readable architecture.

This pass intentionally adds *large* architectural forms that remain visible at
medium camera distances. It runs after build_city_details_glb.py and augments the
same full/sector detail GLBs so the runtime does not need another asset layer.

Adds:
- strong floor/cornice bands and corner piers
- district-specific rooftop crowns and mechanical rooms
- large balconies/terraces/pergolas
- industrial roof monitors and loading canopies
- nightlife neon ribs
- villa wings/pools/pergolas
- larger landmark crowns/canopies

The base VoxCity shell stays responsible for terrain, roads, water and bridges.
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

ROOT = Path("public/voxcity")
OUT = ROOT / "glb"
CHUNKS = OUT / "chunks"
BUILDINGS = ROOT / "mirage-buildings.geojson"
EXTENT = 2000.0
EDGE = EXTENT * 2.0 / 3.0
BANDS = (-EXTENT, -EXTENT + EDGE, -EXTENT + 2.0 * EDGE, EXTENT)
SECTOR_IDS = ("sw", "s", "se", "w", "center", "e", "nw", "n", "ne")

COLORS: dict[str, tuple[int, int, int, int]] = {
    "arch_dark": (38, 46, 55, 255),
    "arch_mid": (86, 100, 112, 255),
    "arch_light": (205, 211, 214, 255),
    "arch_glass": (23, 66, 92, 255),
    "arch_warm": (173, 120, 72, 255),
    "arch_old": (133, 81, 55, 255),
    "arch_tech": (48, 114, 146, 255),
    "arch_canal": (73, 128, 116, 255),
    "arch_night": (109, 48, 125, 255),
    "arch_river": (99, 130, 91, 255),
    "arch_beach": (203, 176, 116, 255),
    "arch_villa": (174, 184, 161, 255),
    "arch_industrial": (101, 102, 99, 255),
    "arch_neon_cyan": (25, 214, 236, 255),
    "arch_neon_magenta": (236, 42, 156, 255),
    "arch_pool": (37, 148, 190, 255),
    "arch_green": (64, 117, 69, 255),
    "arch_roof": (67, 73, 77, 255),
}


def material(name: str) -> PBRMaterial:
    rgba = COLORS[name]
    emissive = [0.0, 0.0, 0.0]
    if name == "arch_neon_cyan":
        emissive = [0.12, 0.82, 0.92]
    elif name == "arch_neon_magenta":
        emissive = [0.92, 0.10, 0.58]
    return PBRMaterial(
        name=name,
        baseColorFactor=np.asarray(rgba, dtype=np.uint8),
        metallicFactor=0.03 if name in {"arch_dark", "arch_roof"} else 0.0,
        roughnessFactor=0.50 if name == "arch_glass" else 0.88,
        emissiveFactor=np.asarray(emissive, dtype=float),
    )


def transform(center: tuple[float, float, float], yaw: float = 0.0) -> np.ndarray:
    matrix = trimesh.transformations.rotation_matrix(yaw, [0.0, 1.0, 0.0])
    matrix[:3, 3] = np.asarray(center, dtype=float)
    return matrix


def box(center, size, yaw: float = 0.0) -> trimesh.Trimesh:
    return trimesh.creation.box(extents=size, transform=transform(center, yaw))


def cylinder(center, radius: float, height: float, sections: int = 12) -> trimesh.Trimesh:
    mesh = trimesh.creation.cylinder(radius=radius, height=height, sections=sections)
    # trimesh cylinders are Z-up; rotate to Y-up.
    mesh.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2.0, [1.0, 0.0, 0.0]))
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


class ArchitecturePass:
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

    def add_cylinder(self, mat: str, center, radius: float, height: float, kind: str) -> None:
        self.add(mat, cylinder(center, radius, height), float(center[0]), float(center[2]), kind)


def merged_geometry(buckets: dict[str, list[trimesh.Trimesh]]) -> list[tuple[str, trimesh.Trimesh]]:
    out: list[tuple[str, trimesh.Trimesh]] = []
    for mat_name, meshes in buckets.items():
        if not meshes:
            continue
        merged = trimesh.util.concatenate(meshes)
        merged.visual = TextureVisuals(material=material(mat_name))
        out.append((mat_name, merged))
    return out


def add_to_scene(scene: trimesh.Scene, buckets: dict[str, list[trimesh.Trimesh]], prefix: str) -> None:
    for mat_name, mesh in merged_geometry(buckets):
        name = f"{prefix}_{mat_name}"
        scene.add_geometry(mesh, geom_name=name, node_name=name)


def floor_band(pass_: ArchitecturePass, x: float, z: float, y: float, w: float, d: float, mat: str = "arch_light") -> None:
    pass_.add_box(mat, (x, y, z), (w + 1.6, 0.34, d + 1.6), "floor-band")


def corner_piers(pass_: ArchitecturePass, x: float, z: float, base: float, h: float, w: float, d: float, mat: str = "arch_dark") -> None:
    pier = 0.85 if max(w, d) < 55 else 1.15
    for sx in (-1.0, 1.0):
        for sz in (-1.0, 1.0):
            pass_.add_box(
                mat,
                (x + sx * (w * 0.5 + 0.20), base + h * 0.52, z + sz * (d * 0.5 + 0.20)),
                (pier, max(3.0, h - 1.5), pier),
                "corner-pier",
            )


def roof_mechanical(pass_: ArchitecturePass, x: float, z: float, top: float, w: float, d: float, seed: int) -> None:
    roof_w = max(5.0, min(w * 0.34, 22.0))
    roof_d = max(5.0, min(d * 0.30, 18.0))
    pass_.add_box("arch_roof", (x, top + 2.0, z), (roof_w, 4.0, roof_d), "roof-penthouse")
    for i in range(2 + seed % 3):
        ox = (-0.28 + 0.28 * i) * roof_w
        pass_.add_box("arch_mid", (x + ox, top + 4.6, z), (3.0, 1.2, 3.0), "roof-hvac-v3")


def add_downtown(pass_: ArchitecturePass, x, z, base, h, w, d, seed) -> None:
    corner_piers(pass_, x, z, base, h, w, d, "arch_dark")
    gap = 13.0 if h > 90 else 10.0
    for y in np.arange(base + gap, base + h - 3.0, gap):
        floor_band(pass_, x, z, float(y), w, d)
    # Deep podium and vertical glass fins.
    pass_.add_box("arch_dark", (x, base + 5.0, z - d * 0.5 - 2.0), (w * 0.76, 10.0, 4.0), "podium-canopy")
    for sx in (-0.30, 0.30):
        pass_.add_box("arch_glass", (x + sx * w, base + h * 0.55, z - d * 0.5 - 0.70), (1.4, h * 0.72, 1.1), "vertical-fin")
    crown_h = 7.0 if h > 100 else 4.5
    pass_.add_box("arch_mid", (x, base + h + crown_h * 0.5, z), (w * 0.62, crown_h, d * 0.62), "roof-crown")
    roof_mechanical(pass_, x, z, base + h + crown_h, w, d, seed)


def add_tech(pass_: ArchitecturePass, x, z, base, h, w, d, seed) -> None:
    corner_piers(pass_, x, z, base, h, w, d, "arch_tech")
    for y in np.arange(base + 11.0, base + h - 3.0, 11.0):
        floor_band(pass_, x, z, float(y), w, d, "arch_tech")
    for sx in (-1.0, 1.0):
        pass_.add_box("arch_neon_cyan", (x + sx * (w * 0.5 + 0.8), base + h * 0.56, z), (0.65, h * 0.72, d * 0.66), "tech-light-rib")
    pass_.add_box("arch_glass", (x, base + h * 0.62, z - d * 0.5 - 1.1), (w * 0.52, h * 0.42, 1.3), "tech-glass-blade")
    pass_.add_cylinder("arch_dark", (x, base + h + 11.0, z), 0.7, 22.0, "roof-spire")
    roof_mechanical(pass_, x, z, base + h, w, d, seed)


def add_old_town(pass_: ArchitecturePass, x, z, base, h, w, d, seed) -> None:
    corner_piers(pass_, x, z, base, h, w, d, "arch_old")
    floor_band(pass_, x, z, base + min(h - 1.0, 4.0), w, d, "arch_warm")
    if h > 11:
        floor_band(pass_, x, z, base + h - 2.2, w, d, "arch_warm")
    awning_y = base + min(4.2, h * 0.35)
    pass_.add_box("arch_warm", (x, awning_y, z - d * 0.5 - 2.1), (w * 0.72, 0.35, 4.2), "old-town-awning")
    # Repeated front pilasters are large enough to read from a distance.
    for sx in (-0.36, -0.12, 0.12, 0.36):
        pass_.add_box("arch_light", (x + sx * w, base + h * 0.48, z - d * 0.5 - 0.45), (0.8, max(4.0, h * 0.78), 0.8), "old-town-pilaster")
    pass_.add_box("arch_roof", (x, base + h + 1.1, z), (w * 0.86, 2.2, d * 0.86), "old-town-roof")


def add_industrial(pass_: ArchitecturePass, x, z, base, h, w, d, seed) -> None:
    # Large loading canopy and roof monitor volumes.
    pass_.add_box("arch_industrial", (x, base + h + 1.0, z), (w * 0.82, 2.0, d * 0.66), "industrial-roof")
    bays = 3 if w > 65 else 2
    for i in range(bays):
        sx = (i - (bays - 1) / 2.0) * min(18.0, w / max(3, bays))
        pass_.add_box("arch_dark", (x + sx, base + 3.0, z - d * 0.5 - 0.8), (10.0, 5.0, 1.1), "loading-bay")
    for i in range(3):
        sx = (-0.28 + 0.28 * i) * w
        pass_.add_box("arch_light", (x + sx, base + h + 3.2, z), (4.0, 4.2, max(7.0, d * 0.45)), "roof-monitor")
    pass_.add_cylinder("arch_dark", (x + w * 0.26, base + h + 8.0, z), 1.0, 14.0, "industrial-stack")


def add_residential(pass_: ArchitecturePass, x, z, base, h, w, d, district, seed) -> None:
    body_mat = "arch_canal" if district == "CANAL RESIDENTIAL" else "arch_river" if district == "RIVERSIDE" else "arch_beach"
    corner_piers(pass_, x, z, base, h, w, d, body_mat)
    balcony_gap = 7.2
    for y in np.arange(base + 7.0, base + h - 2.0, balcony_gap):
        pass_.add_box("arch_light", (x, float(y), z - d * 0.5 - 1.65), (w * 0.74, 0.26, 3.0), "large-balcony")
        pass_.add_box("arch_dark", (x, float(y) + 0.85, z - d * 0.5 - 3.0), (w * 0.72, 1.15, 0.20), "balcony-rail-v3")
    pass_.add_box(body_mat, (x, base + h + 2.0, z), (w * 0.46, 4.0, d * 0.46), "roof-lounge")
    # Roof pergola.
    pergola_y = base + h + 5.0
    for sx in (-0.35, 0.35):
        pass_.add_box("arch_light", (x + sx * w * 0.45, pergola_y, z), (0.8, 6.0, d * 0.35), "pergola-post")
    pass_.add_box("arch_light", (x, pergola_y + 3.0, z), (w * 0.42, 0.45, d * 0.38), "pergola-roof")


def add_nightlife(pass_: ArchitecturePass, x, z, base, h, w, d, seed) -> None:
    corner_piers(pass_, x, z, base, h, w, d, "arch_night")
    for y in np.arange(base + 8.0, base + h - 2.0, 9.0):
        mat = "arch_neon_cyan" if int((y - base) / 9.0) % 2 == 0 else "arch_neon_magenta"
        pass_.add_box(mat, (x, float(y), z - d * 0.5 - 0.8), (w * 0.80, 0.55, 0.65), "nightlife-neon-band")
    pass_.add_box("arch_dark", (x, base + 5.0, z - d * 0.5 - 3.2), (w * 0.64, 8.0, 6.0), "nightlife-entry")
    pass_.add_box("arch_neon_magenta", (x, base + h + 3.0, z), (w * 0.62, 5.0, d * 0.50), "nightlife-crown")


def add_villa(pass_: ArchitecturePass, x, z, base, h, w, d, seed) -> None:
    # Villa wings and courtyard features are intentionally broad and obvious.
    wing_h = min(9.0, max(5.0, h * 0.42))
    for sx in (-1.0, 1.0):
        pass_.add_box("arch_villa", (x + sx * w * 0.55, base + wing_h * 0.5, z), (w * 0.34, wing_h, d * 0.62), "villa-wing")
        pass_.add_box("arch_dark", (x + sx * w * 0.55, base + wing_h + 0.8, z), (w * 0.36, 1.6, d * 0.66), "villa-roof")
    pass_.add_box("arch_light", (x, base + 4.5, z - d * 0.5 - 5.0), (w * 0.48, 0.7, 10.0), "villa-portico")
    pool_z = z + d * 0.62
    pass_.add_box("arch_pool", (x, base + 0.18, pool_z), (w * 0.54, 0.28, max(10.0, d * 0.26)), "villa-pool")
    # Pergola beside the pool.
    px = x + w * 0.34
    for ox in (-5.0, 5.0):
        pass_.add_box("arch_light", (px + ox, base + 2.3, pool_z + 8.0), (0.7, 4.6, 0.7), "villa-pergola")
    pass_.add_box("arch_light", (px, base + 4.7, pool_z + 8.0), (11.0, 0.35, 5.5), "villa-pergola")


def add_landmark(pass_: ArchitecturePass, p: dict) -> None:
    name = str(p.get("name") or p.get("type") or "")
    x, z = float(p["local_x_m"]), float(p["local_z_m"])
    base, h = float(p["base_elevation_m"]), float(p["height"])
    w, d = float(p["width_m"]), float(p["depth_m"])
    top = base + h

    if "Apex Tower" in name:
        for i, scale in enumerate((0.78, 0.58, 0.38)):
            pass_.add_box("arch_light", (x, top + 3.0 + i * 5.0, z), (w * scale, 4.5, d * scale), "landmark-v3")
        pass_.add_cylinder("arch_neon_cyan", (x, top + 28.0, z), 0.9, 28.0, "landmark-v3")
    elif "Police HQ" in name:
        pass_.add_box("arch_dark", (x, base + 5.5, z - d * 0.5 - 8.5), (34.0, 1.0, 15.0), "landmark-v3")
        pass_.add_box("arch_tech", (x, top + 2.5, z), (w * 0.55, 5.0, d * 0.42), "landmark-v3")
    elif "Tech Tower" in name:
        pass_.add_box("arch_neon_cyan", (x, top + 6.0, z), (w * 0.54, 8.0, d * 0.54), "landmark-v3")
        pass_.add_cylinder("arch_dark", (x, top + 21.0, z), 0.8, 26.0, "landmark-v3")
    elif "Market Hall" in name:
        pass_.add_box("arch_warm", (x, top + 3.0, z), (w * 0.86, 5.5, d * 0.78), "landmark-v3")
    elif "Hilltop Mansion" in name:
        gate_z = z - d * 0.5 - 15.0
        for sx in (-10.0, 10.0):
            pass_.add_box("arch_light", (x + sx, base + 4.0, gate_z), (2.0, 8.0, 2.0), "landmark-v3")
        pass_.add_box("arch_dark", (x, base + 3.0, gate_z), (18.0, 4.8, 0.5), "landmark-v3")
    elif "Casino" in name:
        pass_.add_box("arch_neon_magenta", (x, top + 5.0, z), (w * 0.68, 8.0, d * 0.54), "landmark-v3")
        pass_.add_box("arch_neon_cyan", (x, base + 8.0, z - d * 0.5 - 6.0), (40.0, 1.0, 12.0), "landmark-v3")
    elif "Riverside Hotel" in name:
        pass_.add_box("arch_light", (x, top + 3.0, z), (w * 0.52, 6.0, d * 0.52), "landmark-v3")
    elif "Grand Resort" in name:
        pass_.add_box("arch_light", (x, top + 4.0, z), (w * 0.64, 8.0, d * 0.46), "landmark-v3")
        pass_.add_box("arch_pool", (x + w * 0.64, base + 0.2, z), (42.0, 0.32, 22.0), "landmark-v3")


def add_building(pass_: ArchitecturePass, feature: dict) -> None:
    p = feature["properties"]
    x, z = float(p["local_x_m"]), float(p["local_z_m"])
    base, h = float(p["base_elevation_m"]), float(p["height"])
    w, d = float(p["width_m"]), float(p["depth_m"])
    district = str(p["district"])
    seed = int(str(p["building_id"]).split("-")[-1])

    # Strong dark entry frame on every building.
    door_w = min(8.0, max(3.0, w * 0.16))
    pass_.add_box("arch_dark", (x, base + 3.1, z - d * 0.5 - 0.95), (door_w + 2.0, 6.2, 1.4), "entry-frame-v3")
    pass_.add_box("arch_glass", (x, base + 2.9, z - d * 0.5 - 1.35), (door_w, 5.2, 0.35), "entry-glass-v3")

    if district == "DOWNTOWN":
        add_downtown(pass_, x, z, base, h, w, d, seed)
    elif district == "TECH / BUSINESS":
        add_tech(pass_, x, z, base, h, w, d, seed)
    elif district == "OLD TOWN":
        add_old_town(pass_, x, z, base, h, w, d, seed)
    elif district == "INDUSTRIAL PORT":
        add_industrial(pass_, x, z, base, h, w, d, seed)
    elif district in {"CANAL RESIDENTIAL", "RIVERSIDE", "BEACH / MARINA"}:
        add_residential(pass_, x, z, base, h, w, d, district, seed)
    elif district == "NIGHTLIFE":
        add_nightlife(pass_, x, z, base, h, w, d, seed)
    elif district == "HILLS / VIP":
        add_villa(pass_, x, z, base, h, w, d, seed)
    else:
        corner_piers(pass_, x, z, base, h, w, d, "arch_mid")
        roof_mechanical(pass_, x, z, base + h, w, d, seed)

    if bool(p.get("landmark")):
        add_landmark(pass_, p)


def append_architecture(path: Path, buckets: dict[str, list[trimesh.Trimesh]], prefix: str) -> None:
    scene = trimesh.load(path, force="scene") if path.exists() else trimesh.Scene()
    add_to_scene(scene, buckets, prefix)
    path.write_bytes(scene.export(file_type="glb"))


def main() -> int:
    data = json.loads(BUILDINGS.read_text(encoding="utf-8"))
    features = data.get("features", [])
    pass_ = ArchitecturePass()
    for feature in features:
        add_building(pass_, feature)

    append_architecture(OUT / "mirage-city-details.glb", pass_.full, "v3")
    for sid in SECTOR_IDS:
        append_architecture(CHUNKS / f"detail-sector-{sid}.glb", pass_.sectors.get(sid, {}), f"v3_{sid}")

    status_path = OUT / "mirage-city-details-status.json"
    status = json.loads(status_path.read_text(encoding="utf-8")) if status_path.exists() else {}
    counts = dict(status.get("counts") or {})
    for key, value in pass_.counts.items():
        counts[key] = int(counts.get(key, 0)) + int(value)
    status.update(
        {
            "generator": "Mirage procedural city detail + architecture pass v3",
            "detail_version": 3,
            "buildings_detailed": len(features),
            "counts": dict(sorted(counts.items())),
        }
    )
    features_list = list(status.get("features") or [])
    features_list.extend(
        [
            "large architectural floor bands and corner piers",
            "district-specific roof crowns and mechanical volumes",
            "large balconies, pergolas, loading bays and villa wings",
            "high-contrast nightlife and tech light ribs",
            "larger landmark crowns and entrance structures",
        ]
    )
    status["features"] = list(dict.fromkeys(features_list))
    status_path.write_text(json.dumps(status, indent=2) + "\n", encoding="utf-8")

    manifest_path = CHUNKS / "manifest.json"
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["detailVersion"] = 3
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({"detail_version": 3, "architecture_counts": dict(sorted(pass_.counts.items()))}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
