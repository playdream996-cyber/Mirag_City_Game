import { Mesh, MeshBuilder, Scene, Vector3 } from "@babylonjs/core";
import { PhysicsManager } from "./PhysicsManager";

type BuildingProperties = {
  id: string;
  height: number;
  local_x_m: number;
  local_z_m: number;
  width_m: number;
  depth_m: number;
  base_elevation_m: number;
};

type BuildingFeature = {
  type: "Feature";
  properties: BuildingProperties;
};

type BuildingCollection = {
  type: "FeatureCollection";
  features: BuildingFeature[];
};

function assetBase(): string {
  const root = window.location.pathname.startsWith("/Mirag_City_Game/") ? "/Mirag_City_Game/" : "/";
  return `${root}assets/city/`;
}

export class VoxCityCollision {
  private readonly colliders: Mesh[] = [];

  constructor(
    private readonly scene: Scene,
    private readonly physics: PhysicsManager,
  ) {}

  async initialize(): Promise<number> {
    const ground = MeshBuilder.CreateBox(
      "voxcity-ground-collider",
      { width: 4000, height: 0.5, depth: 4000 },
      this.scene,
    );
    ground.position = new Vector3(0, -0.25, 0);
    ground.isVisible = false;
    ground.isPickable = false;
    this.physics.addStaticBox(ground);
    this.colliders.push(ground);

    const response = await fetch(`${assetBase()}mirage-buildings.geojson`, { cache: "no-cache" });
    if (!response.ok) throw new Error(`VoxCity building collision data failed: ${response.status}`);
    const collection = (await response.json()) as BuildingCollection;

    for (const feature of collection.features) {
      const p = feature.properties;
      if (!Number.isFinite(p.width_m) || !Number.isFinite(p.depth_m) || !Number.isFinite(p.height)) continue;

      const collider = MeshBuilder.CreateBox(
        `voxcity-building-collider-${p.id}`,
        {
          width: Math.max(1, p.width_m),
          height: Math.max(1, p.height),
          depth: Math.max(1, p.depth_m),
        },
        this.scene,
      );
      collider.position = new Vector3(
        p.local_x_m,
        p.base_elevation_m + p.height * 0.5,
        p.local_z_m,
      );
      collider.isVisible = false;
      collider.isPickable = false;
      this.physics.addStaticBox(collider);
      this.colliders.push(collider);
    }

    return this.colliders.length;
  }

  dispose(): void {
    for (const collider of this.colliders) {
      this.physics.removeStaticBox(collider);
      collider.dispose();
    }
    this.colliders.length = 0;
  }
}
