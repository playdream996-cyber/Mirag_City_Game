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
  detailFile?: string;
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
  detailModel?: string;
  detailVersion?: number;
  sectors: SectorDefinition[];
};

type LoadedSector = {
  shell: AssetContainer;
  detail?: AssetContainer;
};

function assetBase(): string {
  const root = window.location.pathname.startsWith("/Mirag_City_Game/") ? "/Mirag_City_Game/" : "/";
  return `${root}assets/city/`;
}

export class VoxCityChunkManager {
  private manifest: SectorManifest | null = null;
  private readonly loaded = new Map<string, LoadedSector>();
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
    const detailed = [...this.loaded.values()].filter((entry) => entry.detail).length;
    return `VoxCity 4km: ${this.loaded.size}/${total} sectors • detail ${detailed}/${this.loaded.size} • ${this.loading.size} loading`;
  }

  private prepareContainer(container: AssetContainer, isDetail: boolean): void {
    for (const material of container.materials) {
      if (material instanceof PBRMaterial) {
        if (!isDetail || !material.name.startsWith("neon_")) material.emissiveColor = Color3.Black();
        material.metallic = Math.min(material.metallic ?? 0, 0.08);
        material.roughness = Math.max(material.roughness ?? 0.8, isDetail ? 0.72 : 0.92);
        material.freeze();
      } else if (material instanceof StandardMaterial) {
        if (!isDetail || !material.name.startsWith("neon_")) material.emissiveColor = Color3.Black();
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
  }

  private async loadSector(sector: SectorDefinition): Promise<void> {
    this.loading.add(sector.id);
    let shell: AssetContainer | null = null;
    let detail: AssetContainer | undefined;

    try {
      shell = await SceneLoader.LoadAssetContainerAsync(
        `${assetBase()}chunks/`,
        sector.file,
        this.scene,
      );

      if (this.disposed) {
        shell.dispose();
        return;
      }

      this.prepareContainer(shell, false);

      if (sector.detailFile) {
        try {
          detail = await SceneLoader.LoadAssetContainerAsync(
            `${assetBase()}chunks/`,
            sector.detailFile,
            this.scene,
          );
          if (this.disposed) {
            detail.dispose();
            shell.dispose();
            return;
          }
          this.prepareContainer(detail, true);
        } catch (error) {
          console.warn(`VoxCity detail sector ${sector.id} unavailable:`, error);
        }
      }

      this.loaded.set(sector.id, { shell, detail });
    } catch (error) {
      shell?.dispose();
      detail?.dispose();
      console.warn(`Failed to load VoxCity sector ${sector.id}:`, error);
    } finally {
      this.loading.delete(sector.id);
    }
  }

  private unloadSector(id: string): void {
    const entry = this.loaded.get(id);
    if (!entry) return;

    entry.detail?.removeAllFromScene();
    entry.detail?.dispose();
    entry.shell.removeAllFromScene();
    entry.shell.dispose();
    this.loaded.delete(id);
  }

  dispose(): void {
    this.disposed = true;
    for (const entry of this.loaded.values()) {
      entry.detail?.removeAllFromScene();
      entry.detail?.dispose();
      entry.shell.removeAllFromScene();
      entry.shell.dispose();
    }
    this.loaded.clear();
    this.loading.clear();
  }
}
