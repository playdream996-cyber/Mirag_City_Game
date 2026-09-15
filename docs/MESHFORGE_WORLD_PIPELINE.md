# Mirage City + MeshForge3D world pipeline

## Goal

The uploaded `file.html` is treated as the planning source for the new 4,000 × 4,000 metre interactive Mirage City world: district extents, water channels, arterial roads, bridges, landmark positions, hills, marina, port, traffic and walk/drive exploration are carried into `public/mirage-world.html`.

MeshForge3D is used as an **asset generator**, not as the city-layout engine. Roads, bridges, terrain and placements remain authored by the city plan; generated GLBs replace the procedural building shells at runtime.

## Why this split

MeshForge3D reconstructs an individual object/building from a single image, and its MCP server exposes `generate_model(image_path, resolution)` plus `text_to_3d(prompt)` where the active MeshForge tier permits it. A complete city should therefore keep the road graph and placement data deterministic while using MeshForge for reusable building/landmark meshes.

## Files

- `public/mirage-world.html` — the uploaded Three.js city planner promoted to a standalone interactive world.
- `public/mirage-world-meshforge.html` — same world wrapped with the MeshForge GLB replacement layer. This is the page to open for the upgraded build.
- `public/assets/meshforge/manifest.json` — 17 city archetypes/landmarks and their matching world types.
- `tools/meshforge_generate_city.py` — MCP client that generates/copies GLBs from a local MeshForge checkout.
- `tools/meshforge_refs/` — reference images used by the free image-to-3D path.

## Generate assets with a local MeshForge checkout

MeshForge recommends Python 3.10–3.12. Install it according to its repository instructions first, then run this script from a Python environment that has MeshForge's dependencies available.

### Free / image-to-3D path

Place isolated reference images in `tools/meshforge_refs/` using the manifest IDs as filenames, then run:

```bash
python tools/meshforge_generate_city.py --meshforge C:/Tools/MeshForge3D --mode image
```

The script calls MeshForge's MCP `generate_model` tool and copies every successful `.glb` to `public/assets/meshforge/`.

### Text-to-3D path

If MeshForge reports a valid tier that includes text-to-image/text-to-3D:

```bash
python tools/meshforge_generate_city.py --meshforge C:/Tools/MeshForge3D --mode text
```

The prompts are already stored in `manifest.json`. The script intentionally refuses to force text mode when MeshForge reports the free tier.

### Generate selected models only

```bash
python tools/meshforge_generate_city.py --meshforge C:/Tools/MeshForge3D --mode text --ids apex_tower police_hq casino
```

## Runtime behavior

Open `mirage-world-meshforge.html`. It loads `mirage-world.html` as the authoritative interactive city, exposes the city runtime inside the same-origin frame, then reads `assets/meshforge/manifest.json`. For each GLB that exists, the wrapper:

1. loads the model with Three.js `GLTFLoader`,
2. finds matching city building lots by semantic type,
3. scales the GLB to the planned lot width/depth/height,
4. aligns the mesh to the building base elevation,
5. hides the fallback procedural shell.

This means the world remains playable while the asset pack is incomplete, and it progressively upgrades as generated GLBs are added. The top-right MeshForge badge reports how many GLBs loaded and how many city shells were replaced.

## Important licensing note

MeshForge3D's repository software is published under MIT, but its repository also documents tier-specific feature/commercial policies and model-weight licenses. Keep the MeshForge license notice and check the active model/license terms before shipping generated assets commercially.