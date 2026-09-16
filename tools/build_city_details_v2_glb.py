#!/usr/bin/env python3
"""Build Mirage City visible-detail pass v2.

This is intentionally much more obvious at street distance than the first pass.
It keeps the lightweight VoxCity shell, then layers readable game-art geometry:
individual window grids/mullions, entrances, storefront canopies, rooftop HVAC,
balcony rails, sidewalks, zebra crossings, road edge lines, trees/lamps/benches,
and landmark accents. Outputs replace the same runtime detail GLBs so Babylon
needs no separate code path.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np

from build_city_details_glb import (
    CHUNKS,
    OUT,
    DetailScene,
    add_facade,
    add_landmark_features,
    add_road_details,
    merged_scene,
    write_scene,
)
from export_voxcity_geojson import build_buildings, build_linear_network, district_for, elevation


def row_spec(b: dict) -> tuple[int, float, str]:
    district = str(b["district"])
    h = float(b["height"])
    if district == "INDUSTRIAL PORT":
        gap, glass = 8.0, "glass_warm"
    elif district == "OLD TOWN":
        gap, glass = 7.0, "glass_warm"
    else:
        gap, glass = 5.2, "glass_blue"
    cap = 12 if district in {"DOWNTOWN", "TECH / BUSINESS"} else 8
    rows = max(1, min(cap, int((h - 3.0) / gap)))
    return rows, gap, glass


def add_visible_window_grid(detail: DetailScene, b: dict) -> None:
    """Break the old ribbon windows into a clearly readable pane grid."""
    x, z = float(b["x"]), float(b["z"])
    w, d, h = float(b["width"]), float(b["depth"]), float(b["height"])
    base = float(b["base"])
    district = str(b["district"])
    rows, gap, _ = row_spec(b)

    front_count = max(3, min(10, int(w / 8.0)))
    side_count = max(2, min(8, int(d / 8.0)))
    bar_mat = "trim_light" if district not in {"INDUSTRIAL PORT", "OLD TOWN"} else "trim_dark"

    # Strong corner pilasters make silhouettes less box-like.
    pilaster_h = max(5.0, h - 1.0)
    for sx in (-1.0, 1.0):
        for sz in (-1.0, 1.0):
            detail.add_box(
                bar_mat,
                (x + sx * (w * 0.5 + 0.34), base + pilaster_h * 0.5, z + sz * (d * 0.5 + 0.34)),
                (0.55, pilaster_h, 0.55),
                "facade-pilaster",
            )

    for row in range(rows):
        y = base + 3.3 + row * gap
        if y > base + h - 1.5:
            break
        pane_h = 1.9 if district not in {"OLD TOWN", "INDUSTRIAL PORT"} else 1.55

        # Front/back vertical mullions.
        span = w * (0.72 if district != "OLD TOWN" else 0.58)
        for i in range(front_count + 1):
            px = x - span * 0.5 + span * (i / front_count)
            for side in (-1.0, 1.0):
                pz = z + side * (d * 0.5 + 0.405)
                detail.add_box(bar_mat, (px, y, pz), (0.16, pane_h + 0.30, 0.16), "window-mullion")

        # Side mullions.
        span_d = d * (0.72 if district != "OLD TOWN" else 0.58)
        for i in range(side_count + 1):
            pz = z - span_d * 0.5 + span_d * (i / side_count)
            for side in (-1.0, 1.0):
                px = x + side * (w * 0.5 + 0.405)
                detail.add_box(bar_mat, (px, y, pz), (0.16, pane_h + 0.30, 0.16), "window-mullion")

        # Horizontal sill/cap lines make every floor legible from medium distance.
        for side in (-1.0, 1.0):
            pz = z + side * (d * 0.5 + 0.41)
            detail.add_box(bar_mat, (x, y - pane_h * 0.60, pz), (span + 0.4, 0.15, 0.15), "window-sill")
            detail.add_box(bar_mat, (x, y + pane_h * 0.60, pz), (span + 0.4, 0.15, 0.15), "window-sill")

    # Readable ground-floor entrance on every building.
    front_z = z - d * 0.5 - 0.52
    door_w = min(8.0, max(4.0, w * 0.16))
    door_h = 4.2 if h > 15 else 3.4
    detail.add_box("glass_blue", (x, base + door_h * 0.5, front_z), (door_w, door_h, 0.20), "door-glass")
    for sx in (-1.0, 1.0):
        detail.add_box("trim_dark", (x + sx * door_w * 0.52, base + door_h * 0.5, front_z - 0.02), (0.30, door_h + 0.35, 0.30), "door-frame")
    detail.add_box("trim_dark", (x, base + door_h + 0.15, front_z - 0.02), (door_w + 0.6, 0.30, 0.30), "door-frame")

    # District storefront/awning language.
    if district in {"DOWNTOWN", "OLD TOWN", "NIGHTLIFE", "BEACH / MARINA"}:
        awning_mat = "neon_pink" if district == "NIGHTLIFE" else "trim_light"
        detail.add_box(awning_mat, (x, base + door_h + 1.25, front_z - 1.55), (min(w * 0.62, 26.0), 0.28, 3.0), "awning")
        sign_mat = "neon_cyan" if district in {"DOWNTOWN", "BEACH / MARINA"} else "neon_pink" if district == "NIGHTLIFE" else "road_yellow"
        detail.add_box(sign_mat, (x, base + door_h + 2.25, front_z - 0.10), (min(w * 0.42, 15.0), 0.75, 0.25), "building-sign")


def add_rooftop_details(detail: DetailScene, b: dict) -> None:
    x, z = float(b["x"]), float(b["z"])
    w, d, h = float(b["width"]), float(b["depth"]), float(b["height"])
    top = float(b["base"]) + h
    district = str(b["district"])

    # HVAC / plant boxes visible from aerial views.
    unit_w = min(7.0, max(3.0, w * 0.10))
    unit_d = min(5.5, max(2.4, d * 0.10))
    for ox, oz in ((-0.22, -0.18), (0.20, 0.16)):
        detail.add_box("metal", (x + w * ox, top + 1.1, z + d * oz), (unit_w, 2.0, unit_d), "roof-hvac")
        detail.add_box("trim_dark", (x + w * ox, top + 2.18, z + d * oz), (unit_w * 0.75, 0.18, unit_d * 0.75), "roof-hvac")

    if district in {"DOWNTOWN", "TECH / BUSINESS", "NIGHTLIFE"} and h > 35:
        mast_h = min(10.0, 4.0 + h * 0.04)
        detail.add_box("metal", (x, top + mast_h * 0.5, z), (0.35, mast_h, 0.35), "roof-mast")
        detail.add_box("neon_cyan", (x, top + mast_h, z), (1.2, 0.22, 1.2), "roof-mast")


def add_balcony_rails(detail: DetailScene, b: dict) -> None:
    district = str(b["district"])
    if district not in {"CANAL RESIDENTIAL", "RIVERSIDE", "BEACH / MARINA"}:
        return
    x, z = float(b["x"]), float(b["z"])
    w, d = float(b["width"]), float(b["depth"])
    base = float(b["base"])
    rows, gap, _ = row_spec(b)
    span = w * 0.62
    for row in range(rows):
        if row % 2:
            continue
        y = base + 3.3 + row * gap - 0.55
        pz = z - d * 0.5 - 1.58
        detail.add_box("metal", (x, y, pz), (span, 0.12, 0.12), "balcony-rail")
        posts = max(3, min(9, int(span / 5.0)))
        for i in range(posts):
            px = x - span * 0.5 + span * (i / max(1, posts - 1))
            detail.add_box("metal", (px, y - 0.42, pz), (0.10, 0.85, 0.10), "balcony-rail")


def road_segment_frames(points):
    for idx in range(1, len(points)):
        ax, az = points[idx - 1]
        bx, bz = points[idx]
        dx, dz = bx - ax, bz - az
        length = math.hypot(dx, dz)
        if length < 1.0:
            continue
        ux, uz = dx / length, dz / length
        nx, nz = -uz, ux
        yaw = -math.atan2(dz, dx)
        yield ax, az, bx, bz, dx, dz, length, ux, uz, nx, nz, yaw


def add_visible_road_detail(detail: DetailScene, roads: list[dict]) -> None:
    crosswalk_counter = 0
    for road in roads:
        width = float(road["width"])
        kind = str(road["kind"])
        if width < 14:
            continue
        for ax, az, bx, bz, dx, dz, length, ux, uz, nx, nz, yaw in road_segment_frames(road["points"]):
            mx, mz = (ax + bx) * 0.5, (az + bz) * 0.5
            by = elevation(mx, mz)

            # Broad sidewalks: visually obvious compared with first pass.
            sidewalk_w = 4.5 if width >= 20 else 3.0
            for side in (-1.0, 1.0):
                off = width * 0.5 + sidewalk_w * 0.5 + 0.7
                detail.add_box(
                    "trim_light",
                    (mx + nx * off * side, by + 0.10, mz + nz * off * side),
                    (length, 0.20, sidewalk_w),
                    "sidewalk",
                    yaw,
                )
                # Strong road-edge paint.
                edge_off = width * 0.5 - 0.75
                detail.add_box(
                    "road_white",
                    (mx + nx * edge_off * side, by + 0.24, mz + nz * edge_off * side),
                    (length, 0.055, 0.22),
                    "road-edge-line",
                    yaw,
                )

            # Zebra crossings on a controlled subset of primary segments.
            if width >= 24 and kind in {"ring", "arterial", "coastal", "east-bypass"}:
                crosswalk_counter += 1
                if crosswalk_counter % 3 == 0:
                    t = 0.18
                    cx, cz = ax + dx * t, az + dz * t
                    cy = elevation(cx, cz) + 0.25
                    for stripe in range(-4, 5):
                        along = stripe * 1.9
                        px, pz = cx + ux * along, cz + uz * along
                        detail.add_box("road_white", (px, cy, pz), (1.05, 0.06, width * 0.72), "crosswalk", yaw)


def add_district_plazas(detail: DetailScene) -> None:
    """A few obvious composed spaces so the city no longer reads as a raw grid."""
    plazas = [
        (-100.0, 410.0, 46.0, 28.0, "DOWNTOWN"),
        (250.0, -560.0, 54.0, 24.0, "NIGHTLIFE"),
        (-350.0, -1690.0, 70.0, 25.0, "BEACH / MARINA"),
        (-1250.0, 650.0, 58.0, 22.0, "OLD TOWN"),
    ]
    for x, z, w, d, district in plazas:
        base = elevation(x, z)
        detail.add_box("trim_light", (x, base + 0.10, z), (w, 0.20, d), "plaza")
        for sx in (-0.35, 0.35):
            for sz in (-0.28, 0.28):
                px, pz = x + w * sx, z + d * sz
                # planter base + tree
                detail.add_box("bench", (px, base + 0.35, pz), (3.2, 0.7, 3.2), "planter")
                from build_city_details_glb import add_tree, add_lamp, add_bench
                add_tree(detail, px, pz, base + 0.7, district == "BEACH / MARINA")
        from build_city_details_glb import add_lamp, add_bench
        add_lamp(detail, x - w * 0.45, z, base)
        add_lamp(detail, x + w * 0.45, z, base)
        add_bench(detail, x, z - d * 0.35, base, 0.0)


def main() -> int:
    roads, water = build_linear_network()
    buildings = build_buildings(roads, water)
    detail = DetailScene()

    for b in buildings:
        add_facade(detail, b)
        add_visible_window_grid(detail, b)
        add_rooftop_details(detail, b)
        add_balcony_rails(detail, b)
        if b.get("landmark"):
            add_landmark_features(detail, b)

    add_road_details(detail, roads)
    add_visible_road_detail(detail, roads)
    add_district_plazas(detail)

    OUT.mkdir(parents=True, exist_ok=True)
    CHUNKS.mkdir(parents=True, exist_ok=True)
    write_scene(merged_scene(detail.full), OUT / "mirage-city-details.glb")

    sector_ids = ("sw", "s", "se", "w", "center", "e", "nw", "n", "ne")
    for sid in sector_ids:
        write_scene(merged_scene(detail.sectors.get(sid, {})), CHUNKS / f"detail-sector-{sid}.glb")

    manifest_path = CHUNKS / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    for sector in manifest.get("sectors", []):
        sector["detailFile"] = f"detail-sector-{sector['id']}.glb"
    manifest["detailModel"] = "../mirage-city-details.glb"
    manifest["detailVersion"] = 2
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    status = {
        "generator": "Mirage visible procedural city detail pass v2",
        "buildings_detailed": len(buildings),
        "landmarks_detailed": sum(1 for b in buildings if b.get("landmark")),
        "counts": dict(sorted(detail.counts.items())),
        "full_detail_glb": "mirage-city-details.glb",
        "streamed_detail_sectors": 9,
        "detail_version": 2,
        "features": [
            "district facade skins",
            "readable window grids, mullions and sills",
            "ground-floor entrances, signs and storefront awnings",
            "balcony rails and rooftop HVAC/masts",
            "broad sidewalks, edge lines and zebra crossings",
            "street lamps, trees, benches, bins and planted plazas",
            "eight landmark silhouette upgrades",
            "landmark entrance-lobby geometry",
        ],
    }
    (OUT / "mirage-city-details-status.json").write_text(json.dumps(status, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(status, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
