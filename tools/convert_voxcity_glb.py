#!/usr/bin/env python3
"""Convert Mirage City's VoxCity OBJ into Babylon-ready GLB assets.

The VoxCity OBJ uses X=east, Y=north, Z=up with coordinates starting at zero.
This converter recenters the 4 km world around (0, 0, 0), converts it to the
Babylon-friendly X=east, Y=up, Z=north convention, writes a full GLB, and
creates nine spatial GLB sectors for runtime streaming.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import trimesh
from trimesh.intersections import slice_mesh_plane
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals

MATERIALS = {
    "material_1": (83, 121, 92, 255),    # ground
    "material_2": (52, 68, 83, 255),     # road
    "material_3": (36, 101, 120, 255),   # water
    "material_4": (131, 174, 196, 255),  # building
    "material_5": (217, 228, 229, 255),  # landmark
    "material_6": (221, 195, 145, 255),  # bridge
}

SECTORS = (
    ("sw", -1333.333333, -1333.333333),
    ("s", 0.0, -1333.333333),
    ("se", 1333.333333, -1333.333333),
    ("w", -1333.333333, 0.0),
    ("center", 0.0, 0.0),
    ("e", 1333.333333, 0.0),
    ("nw", -1333.333333, 1333.333333),
    ("n", 0.0, 1333.333333),
    ("ne", 1333.333333, 1333.333333),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--obj", default="public/voxcity/obj/mirage-city-voxcity.obj")
    parser.add_argument("--out", default="public/voxcity/glb")
    parser.add_argument("--extent", type=float, default=2000.0)
    return parser.parse_args()


def pbr_for(name: str) -> PBRMaterial:
    rgba = MATERIALS.get(name, (180, 180, 180, 255))
    return PBRMaterial(
        name=name,
        baseColorFactor=np.asarray(rgba, dtype=np.uint8),
        metallicFactor=0.0,
        roughnessFactor=0.95,
        emissiveFactor=np.array([0.0, 0.0, 0.0]),
    )


def transform_mesh(mesh: trimesh.Trimesh, name: str, extent: float) -> trimesh.Trimesh:
    vertices = np.asarray(mesh.vertices, dtype=np.float64)
    transformed = np.column_stack(
        (
            vertices[:, 0] - extent,
            vertices[:, 2],
            vertices[:, 1] - extent,
        )
    )

    # Axis swap changes handedness; reverse winding to keep outward-facing faces.
    faces = np.asarray(mesh.faces, dtype=np.int64)[:, [0, 2, 1]]
    result = trimesh.Trimesh(vertices=transformed, faces=faces, process=False)
    result.visual = TextureVisuals(material=pbr_for(name))
    return result


def clip_axis(mesh: trimesh.Trimesh, axis: int, lo: float, hi: float) -> trimesh.Trimesh | None:
    current = mesh
    normal_lo = np.zeros(3, dtype=float)
    normal_lo[axis] = 1.0
    origin_lo = np.zeros(3, dtype=float)
    origin_lo[axis] = lo
    current = slice_mesh_plane(current, normal_lo, origin_lo, cap=False)
    if current is None or len(current.faces) == 0:
        return None

    normal_hi = np.zeros(3, dtype=float)
    normal_hi[axis] = -1.0
    origin_hi = np.zeros(3, dtype=float)
    origin_hi[axis] = hi
    current = slice_mesh_plane(current, normal_hi, origin_hi, cap=False)
    if current is None or len(current.faces) == 0:
        return None
    return current


def clip_sector(mesh: trimesh.Trimesh, x0: float, x1: float, z0: float, z1: float) -> trimesh.Trimesh | None:
    current = clip_axis(mesh, 0, x0, x1)
    if current is None:
        return None
    current = clip_axis(current, 2, z0, z1)
    return current


def export_glb(scene: trimesh.Scene, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(scene.export(file_type="glb"))


def main() -> int:
    args = parse_args()
    source = Path(args.obj)
    out = Path(args.out)
    chunks = out / "chunks"
    out.mkdir(parents=True, exist_ok=True)
    chunks.mkdir(parents=True, exist_ok=True)

    raw = trimesh.load(source, force="scene")
    transformed = trimesh.Scene()
    transformed_meshes: dict[str, trimesh.Trimesh] = {}

    for name, geometry in raw.geometry.items():
        mesh = transform_mesh(geometry, name, float(args.extent))
        transformed_meshes[name] = mesh
        transformed.add_geometry(mesh, geom_name=name, node_name=name)

    full_path = out / "mirage-city-voxcity.glb"
    export_glb(transformed, full_path)

    edge = (float(args.extent) * 2.0) / 3.0
    bands = [-float(args.extent), -float(args.extent) + edge, -float(args.extent) + 2.0 * edge, float(args.extent)]
    sector_specs = [
        ("sw", 0, 0), ("s", 1, 0), ("se", 2, 0),
        ("w", 0, 1), ("center", 1, 1), ("e", 2, 1),
        ("nw", 0, 2), ("n", 1, 2), ("ne", 2, 2),
    ]

    manifest_sectors = []
    for sector_id, xi, zi in sector_specs:
        x0, x1 = bands[xi], bands[xi + 1]
        z0, z1 = bands[zi], bands[zi + 1]
        sector_scene = trimesh.Scene()
        for material_name, mesh in transformed_meshes.items():
            clipped = clip_sector(mesh, x0, x1, z0, z1)
            if clipped is None or len(clipped.faces) == 0:
                continue
            clipped.visual = TextureVisuals(material=pbr_for(material_name))
            sector_scene.add_geometry(clipped, geom_name=material_name, node_name=material_name)

        sector_file = f"sector-{sector_id}.glb"
        export_glb(sector_scene, chunks / sector_file)
        manifest_sectors.append(
            {
                "id": sector_id,
                "file": sector_file,
                "center": [(x0 + x1) * 0.5, 0.0, (z0 + z1) * 0.5],
                "bounds": [x0, z0, x1, z1],
                "loadDistance": 1550.0,
                "unloadDistance": 1900.0,
            }
        )

    manifest = {
        "version": 1,
        "worldSize": float(args.extent) * 2.0,
        "coordinateSystem": "Babylon X=east, Y=up, Z=north",
        "fullModel": "../mirage-city-voxcity.glb",
        "sectors": manifest_sectors,
    }
    (chunks / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    print(f"Created Babylon-ready GLB: {full_path}")
    print(f"Created {len(manifest_sectors)} streaming sectors in: {chunks}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
