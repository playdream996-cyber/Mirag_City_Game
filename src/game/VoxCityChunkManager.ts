import "@babylonjs/loaders/glTF";
import {
  AssetContainer,
  Color3,
  Mesh,
  PBRMaterial,
  Scene,
  SceneLoader,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";

type SectorDefinition = {
  id: string;
  file: string;
  center: [number, number, number];
  bounds: [number, number, number, number];
  loadDistance: number;
  unloadDistance: number;
};

type SectorManifest = {
  version: number;
  worldSize: number;
  coordinateSystem: string;
  fullModel: string;
  sectors: SectorDefinition[];
};

function assetBase(): string {
  const root = import.meta.env.BASE_URL || "/";
  return `${root}assets/city/`;
}

export class VoxCityChunkManager {
  private manifest: SectorManifest | null = null;
  private readonly loaded = new Map<string, AssetContainer>();
  private readonly loading = new Set<string>();
  private lastUpdateAt = -Infinity;
  private disposed = false;

  constructor(private readonly scene: Scene) {}

  async initialize(initialPosition: Vector3): Promise<void> {
    const response = await fetch(`${assetBase()}chunks/manifest.json`, { cache: "no-cache" });
    if (!response.ok) throw new Error(`VoxCity chunk manifest failed: ${response.status}`);
    this.manifest = (await response.json()) as SectorManifest;
    this.update(initialPosition, true);
  }

  update(position: Vector3, force = false): void {
    if (!this.manifest || this.disposed) return;
    const now = performance.now();
    if (!force && now - this.lastUpdateAt < 350) return;
    this.lastUpdateAt = now;

    for (const sector of this.manifest.sectors) {
      const dx = position.x - sector.center[0];
      const dz = position.z - sector.center[2];
      const distance = Math.hypot(dx, dz);

      if (distance <= sector.loadDistance) {
        if (!this.loaded.has(sector.id) && !this.loading.has(sector.id)) void this.loadSector(sector);
      } else if (distance > sector.unloadDistance && this.loaded.has(sector.id)) {
        this.unloadSector(sector.id);
      }
    }
  }

  getHudText(): string {
    const total = this.manifest?.sectors.length ?? 0;
    return `VoxCity 4km shell: ${this.loaded.size}/${total} sectors loaded • ${this.loading.size} loading`;
  }

  private async loadSector(sector: SectorDefinition): Promise<void> {
    this.loading.add(sector.id);
    try {
      const container = await SceneLoader.LoadAssetContainerAsync(
        `${assetBase()}chunks/`,
        sector.file,
        this.scene,
      );

      if (this.disposed) {
        container.dispose();
        return;
      }

      for (const material of container.materials) {
        if (material instanceof PBRMaterial) {
          material.emissiveColor = Color3.Black();
          material.metallic = 0;
          material.roughness = 0.95;
          material.freeze();
        } else if (material instanceof StandardMaterial) {
          material.emissiveColor = Color3.Black();
          material.specularColor = new Color3(0.04, 0.04, 0.04);
          material.freeze();
        }
      }

      container.addAllToScene();
      for (const mesh of container.meshes) {
        if (!(mesh instanceof Mesh)) continue;
        mesh.isPickable = false;
        mesh.checkCollisions = false;
        mesh.receiveShadows = true;
        mesh.freezeWorldMatrix();
      }

      this.loaded.set(sector.id, container);
    } catch (error) {
      console.warn(`Failed to load VoxCity sector ${sector.id}:`, error);
    } finally {
      this.loading.delete(sector.id);
    }
  }

  private unloadSector(id: string): void {
    const container = this.loaded.get(id);
    if (!container) return;
    container.removeAllFromScene();
    container.dispose();
    this.loaded.delete(id);
  }

  dispose(): void {
    this.disposed = true;
    for (const container of this.loaded.values()) {
      container.removeAllFromScene();
      container.dispose();
    }
    this.loaded.clear();
    this.loading.clear();
  }
}
