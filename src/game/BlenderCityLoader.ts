import "@babylonjs/loaders/glTF";
import { AbstractMesh, Scene, SceneLoader } from "@babylonjs/core";
import { PhysicsManager } from "./PhysicsManager";

type BlenderDistrictEntry = {
  id: string;
  label: string;
  file: string;
  objects?: number;
};

type BlenderCityManifest = {
  generated: boolean;
  common?: { file: string; objects?: number };
  districts: BlenderDistrictEntry[];
};

function baseUrl(path: string): string {
  const meta = import.meta as ImportMeta & { env?: { BASE_URL?: string } };
  const root = meta.env?.BASE_URL ?? "/Mirag_City_Game/";
  return `${root}${path}`;
}

async function importGlb(scene: Scene, rootUrl: string, file: string): Promise<AbstractMesh[]> {
  const result = await SceneLoader.ImportMeshAsync(null, rootUrl, file, scene);
  return result.meshes;
}

export type BlenderCityLoadResult = {
  loaded: boolean;
  districtCount: number;
  meshCount: number;
};

export async function loadBlenderGeneratedCity(
  scene: Scene,
  physics: PhysicsManager,
): Promise<BlenderCityLoadResult> {
  const manifestUrl = baseUrl("assets/city-generated/manifest.json");

  let manifest: BlenderCityManifest;
  try {
    const response = await fetch(manifestUrl, { cache: "no-store" });
    if (!response.ok) return { loaded: false, districtCount: 0, meshCount: 0 };
    manifest = (await response.json()) as BlenderCityManifest;
  } catch {
    return { loaded: false, districtCount: 0, meshCount: 0 };
  }

  if (!manifest.generated) return { loaded: false, districtCount: 0, meshCount: 0 };

  const rootUrl = baseUrl("assets/city-generated/");
  let districtCount = 0;
  let meshCount = 0;

  const files: Array<{ id: string; file: string }> = [];
  if (manifest.common?.file) files.push({ id: "common", file: manifest.common.file });
  for (const district of manifest.districts ?? []) files.push({ id: district.id, file: district.file });

  for (const entry of files) {
    try {
      const meshes = await importGlb(scene, rootUrl, entry.file);
      for (const mesh of meshes) {
        mesh.receiveShadows = true;
        mesh.isPickable = true;
        if (mesh.name.toLowerCase().includes("collider")) {
          mesh.isVisible = false;
          physics.addStaticBox(mesh);
        }
      }
      meshCount += meshes.length;
      if (entry.id !== "common") districtCount++;
    } catch (error) {
      console.warn(`Could not load Blender city chunk ${entry.file}`, error);
    }
  }

  return {
    loaded: districtCount > 0,
    districtCount,
    meshCount,
  };
}
