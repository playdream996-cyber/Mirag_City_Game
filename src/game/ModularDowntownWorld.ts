import "@babylonjs/loaders/glTF";
import {
  AssetContainer,
  Mesh,
  PBRMaterial,
  Scene,
  SceneLoader,
  StandardMaterial,
} from "@babylonjs/core";

export type ModularDowntownManifest = {
  version: number;
  generator: string;
  district: "downtown";
  building_count: number;
  road_segment_count: number;
  hero_landmark: string;
  output: string;
};

function assetBase(): string {
  const root = window.location.pathname.startsWith("/Mirag_City_Game/") ? "/Mirag_City_Game/" : "/";
  return `${root}assets/city/districts/`;
}

export class ModularDowntownWorld {
  private container: AssetContainer | null = null;
  private manifest: ModularDowntownManifest | null = null;

  constructor(private readonly scene: Scene) {}

  async initialize(): Promise<ModularDowntownManifest> {
    if (this.container && this.manifest) return this.manifest;

    const manifestResponse = await fetch(`${assetBase()}downtown-manifest.json`, { cache: "no-cache" });
    if (!manifestResponse.ok) {
      throw new Error(`Modular Downtown manifest unavailable: ${manifestResponse.status}`);
    }
    this.manifest = (await manifestResponse.json()) as ModularDowntownManifest;

    this.container = await SceneLoader.LoadAssetContainerAsync(
      assetBase(),
      this.manifest.output || "downtown.glb",
      this.scene,
    );

    for (const material of this.container.materials) {
      if (material instanceof PBRMaterial) {
        material.metallic = Math.min(material.metallic ?? 0, 0.35);
        material.roughness = Math.max(material.roughness ?? 0.7, 0.48);
      } else if (material instanceof StandardMaterial) {
        material.specularPower = Math.min(material.specularPower, 48);
      }
    }

    this.container.addAllToScene();
    for (const mesh of this.container.meshes) {
      if (!(mesh instanceof Mesh)) continue;
      mesh.isPickable = false;
      mesh.checkCollisions = false;
      mesh.receiveShadows = true;
      mesh.freezeWorldMatrix();
    }

    return this.manifest;
  }

  getHudText(): string {
    if (!this.manifest) return "Modular Downtown: not loaded";
    return `Modular Downtown: ${this.manifest.building_count} buildings • ${this.manifest.road_segment_count} road groups • ${this.manifest.hero_landmark}`;
  }

  dispose(): void {
    if (!this.container) return;
    this.container.removeAllFromScene();
    this.container.dispose();
    this.container = null;
    this.manifest = null;
  }
}
