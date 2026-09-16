# Mirage City → VoxCity GeoJSON

This repo now includes a deterministic exporter for the 4,000 × 4,000 metre Mirage City planner:

```bash
python tools/export_voxcity_geojson.py
```

It reproduces the planner's seeded building placement and writes these files to `public/voxcity/`:

- `mirage-buildings.geojson`
- `mirage-roads.geojson`
- `mirage-water.geojson`
- `mirage-bridges.geojson`
- `mirage-districts.geojson`
- `mirage-voxcity-manifest.json`

The current planner export contains **175 building footprints**, **84 road features**, **7 water/canal features**, **24 bridges**, and **9 districts**.

## Coordinate model

The source planner uses local metres:

- `X` = west/east
- `Z` = south/north
- `Y` = elevation

GeoJSON tooling normally expects geographic coordinates, so the exporter maps the local grid around a configurable WGS84 anchor. The default anchor is `(0, 0)` and is intentionally synthetic — it does **not** mean Mirage City is located there. Every building keeps its exact planner coordinates in `local_x_m` / `local_z_m`, plus `width_m`, `depth_m`, `height`, district, landmark flag and base elevation.

To choose another anchor:

```bash
python tools/export_voxcity_geojson.py \
  --anchor-lat 10.0 \
  --anchor-lon 20.0
```

The layout and dimensions stay unchanged; only the GeoJSON georeference moves.

## Load the buildings in VoxCity

Use the GeoDataFrame route so the generated GeoJSON can be passed directly to VoxCity:

```python
import json
import geopandas as gpd
from voxcity.generator import get_voxcity

buildings = gpd.read_file("public/voxcity/mirage-buildings.geojson")

with open("public/voxcity/mirage-voxcity-manifest.json", "r", encoding="utf-8") as f:
    manifest = json.load(f)

rectangle_vertices = manifest["rectangle_vertices"]

city = get_voxcity(
    rectangle_vertices=rectangle_vertices,
    meshsize=5,
    building_source="GeoDataFrame",
    building_gdf=buildings,
)
```

For a fully fictional build, do not accidentally treat the synthetic anchor as a real-world terrain/location source. If you want VoxCity to add external DEM, land-cover or canopy data, re-run the exporter with an intentional anchor first and explicitly choose those data sources.

## Why GeoDataFrame instead of `Local file`

VoxCity accepts a `building_gdf` argument directly. This is the safest route for this export because it preserves the GeoJSON attributes (`height`, `building_id`, district metadata, local metre coordinates) without depending on the local-file loader's format-specific handling.

## Regenerating after planner changes

The exporter mirrors the deterministic layout logic currently used by `public/mirage-world.html`, including the seeded procedural infill. If the planner's districts, roads, water network, random seed or building-generation rules are changed, update `tools/export_voxcity_geojson.py` at the same time and regenerate the GeoJSON bundle.

This remains a planning/game-world export, not survey or engineering data.
