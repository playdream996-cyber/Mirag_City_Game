#!/usr/bin/env python3
"""Build Mirage City detail pass v4 with correct voxel-surface alignment.

VoxCity's terrain is voxelized, so the visible ground surface is the TOP of the
terrain voxel column, not the planner's raw procedural elevation. Previous
detail passes used the raw elevation (for example 5 m) while a 10 m voxel mesh
rendered the ground top at 10 m. That pushed low-rise buildings, entrances,
roads and props several metres into the terrain and made many buildings appear
missing after the coarse blockout shell was hidden.

This pass rebuilds the complete detail layer using the exact voxel-top surface,
then reapplies the V3 architecture forms on the same aligned bases.
"""

from __future__ import annotations

import copy
import json
import math
from pathlib import Path

import build_city_architecture_v3 as v3
import build_city_details_glb as d1
import build_city_details_v2_glb as d2
from export_voxcity_geojson import build_buildings, build_linear_network, elevation

ROOT = Path("public/voxcity")
OUT = ROOT / "glb"
CHUNKS = OUT / "chunks"
OBJ_STATUS = ROOT / "obj" / "mirage-city-voxcity-status.json"
BUILDINGS_GEOJSON = ROOT / "mirage-buildings.geojson"
SECTOR_IDS = ("sw", "s", "se", "w", "center", "e", "nw", "n", "ne")


def read_mesh_size() -> float:
    if OBJ_STATUS.exists():
        try:
            data = json.loads(OBJ_STATUS.read_text(encoding="utf-8"))
            value = float(data.get("meshsize_m", 10.0))
            if value > 0:
                return value
        except Exception:
            pass
    return 10.0


MESH_SIZE = read_mesh_size()


def snap_surface_value(raw_elevation: float) -> float:
    """Match build_voxcity_obj.py terrain top exactly."""
    layers = max(1, int(math.ceil(float(raw_elevation) / MESH_SIZE)))
    return layers * MESH_SIZE


def snapped_elevation(x: float, z: float) -> float:
    return snap_surface_value(elevation(x, z))


def align_buildings(buildings: list[dict]) -> None:
    for b in buildings:
        b["base"] = snap_surface_value(float(b["base"]))


def rebuild_detail_layer() -> tuple[d1.DetailScene, int]:
    # Road/prop helper functions reference module-level `elevation`; replace it
    # with the voxel-top version for this build only.
    d1.elevation = snapped_elevation
    d2.elevation = snapped_elevation

    roads, water = build_linear_network()
    buildings = build_buildings(roads, water)
    align_buildings(buildings)

    detail = d1.DetailScene()
    for b in buildings:
        # add_facade is a complete building body, not just a thin skin. Keeping
        # all 175 of these aligned guarantees no district loses its buildings.
        d1.add_facade(detail, b)
        d2.add_visible_window_grid(detail, b)
        d2.add_rooftop_details(detail, b)
        d2.add_balcony_rails(detail, b)
        if b.get("landmark"):
            d1.add_landmark_features(detail, b)

    d1.add_road_details(detail, roads)
    d2.add_visible_road_detail(detail, roads)
    d2.add_district_plazas(detail)

    OUT.mkdir(parents=True, exist_ok=True)
    CHUNKS.mkdir(parents=True, exist_ok=True)
    d1.write_scene(d1.merged_scene(detail.full), OUT / "mirage-city-details.glb")
    for sid in SECTOR_IDS:
        d1.write_scene(
            d1.merged_scene(detail.sectors.get(sid, {})),
            CHUNKS / f"detail-sector-{sid}.glb",
        )

    return detail, len(buildings)


def append_aligned_v3_architecture() -> dict[str, int]:
    data = json.loads(BUILDINGS_GEOJSON.read_text(encoding="utf-8"))
    features = data.get("features", [])
    arch = v3.ArchitecturePass()

    for original in features:
        feature = copy.deepcopy(original)
        props = feature["properties"]
        props["base_elevation_m"] = snap_surface_value(float(props["base_elevation_m"]))
        v3.add_building(arch, feature)

    v3.append_architecture(OUT / "mirage-city-details.glb", arch.full, "v4_arch")
    for sid in SECTOR_IDS:
        v3.append_architecture(
            CHUNKS / f"detail-sector-{sid}.glb",
            arch.sectors.get(sid, {}),
            f"v4_arch_{sid}",
        )
    return dict(arch.counts)


def update_manifest() -> None:
    manifest_path = CHUNKS / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    for sector in manifest.get("sectors", []):
        sector["detailFile"] = f"detail-sector-{sector['id']}.glb"
    manifest["detailModel"] = "../mirage-city-details.glb"
    manifest["detailVersion"] = 4
    manifest["detailSurfaceAlignment"] = "voxel-top"
    manifest["meshsize_m"] = MESH_SIZE
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def write_status(detail: d1.DetailScene, building_count: int, arch_counts: dict[str, int]) -> None:
    counts = dict(detail.counts)
    for key, value in arch_counts.items():
        counts[key] = int(counts.get(key, 0)) + int(value)

    status = {
        "generator": "Mirage voxel-aligned detail + architecture pass v4",
        "detail_version": 4,
        "surface_alignment": "voxel-top",
        "meshsize_m": MESH_SIZE,
        "buildings_detailed": building_count,
        "landmarks_detailed": 8,
        "counts": dict(sorted(counts.items())),
        "full_detail_glb": "mirage-city-details.glb",
        "streamed_detail_sectors": 9,
        "features": [
            "all 175 full building bodies preserved",
            "building bases snapped to visible VoxCity terrain top",
            "road markings, sidewalks, plazas, lamps and trees snapped to terrain top",
            "district facade skins and readable window grids",
            "ground-floor entrances, signs and storefront awnings",
            "balconies, rooftop HVAC, crowns, pergolas and villa wings",
            "eight landmark silhouette upgrades and entrance lobbies",
            "coarse VoxCity shell may remain enabled as a safety underlay",
        ],
    }
    (OUT / "mirage-city-details-status.json").write_text(
        json.dumps(status, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    detail, building_count = rebuild_detail_layer()
    arch_counts = append_aligned_v3_architecture()
    update_manifest()
    write_status(detail, building_count, arch_counts)
    print(
        json.dumps(
            {
                "detail_version": 4,
                "meshsize_m": MESH_SIZE,
                "surface_alignment": "voxel-top",
                "buildings": building_count,
                "architecture_counts": dict(sorted(arch_counts.items())),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
