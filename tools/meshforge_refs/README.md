# MeshForge reference images

This folder is used by `tools/meshforge_generate_city.py` when MeshForge is running in **image** mode (the open/free image-to-3D workflow).

Add one isolated PNG/JPG/WebP reference for each asset ID listed in `public/assets/meshforge/manifest.json`, for example:

- `downtown_tower.png`
- `old_town_block.png`
- `tech_business_block.png`
- `industrial_warehouse.png`
- `canal_residential.png`
- `nightlife_block.png`
- `riverside_block.png`
- `beach_resort_block.png`
- `vip_villa.png`
- `apex_tower.png`
- `police_hq.png`
- `tech_tower.png`
- `market_hall.png`
- `hilltop_mansion.png`
- `casino.png`
- `riverside_hotel.png`
- `grand_resort.png`

Best input: one building/object, centered, three-quarter view, simple background, complete silhouette, no people or surrounding city. The pipeline sends each image to MeshForge `generate_model` and copies the resulting GLB into `public/assets/meshforge/`.

If your MeshForge installation reports a valid tier that includes text-to-3D, `--mode text` uses the prompts already stored in the manifest instead.