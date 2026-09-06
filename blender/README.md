# Mirag City Blender Workspace

This folder makes Blender part of the repository workflow for the Tokyo × Bangkok city rebuild.

## What it does

`build_city.py` builds the physical city scene in Blender, imports available Quaternius and Neon Tech assets from the repo, saves an editable `.blend` source file, and exports browser-ready district `.glb` chunks.

Generated outputs:

- `blender/MiragCity_TokyoBangkok.blend`
- `public/assets/city-generated/common-infrastructure.glb`
- `public/assets/city-generated/hills-vip.glb`
- `public/assets/city-generated/old-market.glb`
- `public/assets/city-generated/central-downtown.glb`
- `public/assets/city-generated/tech-port.glb`
- `public/assets/city-generated/neon-quarter.glb`
- `public/assets/city-generated/canal-town.glb`
- `public/assets/city-generated/riverside.glb`
- `public/assets/city-generated/industrial-docks.glb`
- `public/assets/city-generated/beach-marina.glb`
- `public/assets/city-generated/manifest.json`

## Run

Install Blender and make sure the `blender` executable is available on your PATH, then from the repository root run:

```bash
npm run blender:city
```

Equivalent direct command:

```bash
blender --background --python blender/build_city.py
```

## Game integration

`src/game/BlenderCityLoader.ts` checks `public/assets/city-generated/manifest.json`.

- If `generated` is `true`, Babylon loads the exported Blender district GLBs.
- If no Blender export exists yet, the rebuild branch falls back to `CityExpansion.ts`.

This means Blender is the preferred city source while gameplay remains in Babylon.js.

## Asset sources

The Blender script reads modular assets directly from:

- `public/assets/city-kit/`
- `public/assets/neon-tech/`

NPC/player assets are left to the Babylon gameplay systems:

- `public/assets/characters/`
- `public/assets/npcs/`

## Branch safety

Current work is on `city-rebuild/tokyo-bangkok-v1`. Do not merge the draft PR into `main` until the Blender-generated city has been visually reviewed.
