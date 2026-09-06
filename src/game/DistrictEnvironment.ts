import "@babylonjs/loaders/glTF";
import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  SceneLoader,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import { PhysicsManager } from "./PhysicsManager";

type Template = {
  mesh: Mesh;
  width: number;
  height: number;
  depth: number;
  minY: number;
};

type Lot = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  rot?: number;
  template?: number;
};

const BUILDINGS = ["Building_Small_1.gltf", "Building_Medium_2_001.gltf", "Building_Large_2.gltf"] as const;
const NEON = ["pillar1a.glb", "pillar2b.glb", "stairs.glb", "stairslight.glb", "ramp.glb", "controlpanel.glb", "crate.glb", "lightplain.glb", "lightsquare.glb"] as const;

function repoAssetRoot(folder: string): string {
  const base = window.location.pathname.startsWith("/Mirag_City_Game/") ? "/Mirag_City_Game/" : "/";
  return `${base}assets/${folder}/`;
}

async function loadTexturelessGltf(scene: Scene, root: string, file: string): Promise<Template> {
  const response = await fetch(`${root}${file}`);
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
  const doc = await response.json() as Record<string, any>;

  if (Array.isArray(doc.buffers)) {
    for (const buffer of doc.buffers) {
      if (typeof buffer.uri === "string" && !buffer.uri.startsWith("data:") && !buffer.uri.startsWith("http")) {
        buffer.uri = `${root}${buffer.uri}`;
      }
    }
  }

  if (Array.isArray(doc.materials)) {
    doc.materials = doc.materials.map((material: Record<string, any>, index: number) => ({
      name: material.name ?? `material-${index}`,
      doubleSided: true,
      pbrMetallicRoughness: {
        baseColorFactor: index % 3 === 0 ? [0.55, 0.58, 0.62, 1] : index % 3 === 1 ? [0.38, 0.42, 0.47, 1] : [0.66, 0.61, 0.53, 1],
        metallicFactor: 0.05,
        roughnessFactor: 0.8,
      },
    }));
  }
  doc.images = [];
  doc.textures = [];

  const result = await SceneLoader.ImportMeshAsync(null, root, `data:${JSON.stringify(doc)}`, scene, undefined, ".gltf");
  const mesh = result.meshes.find((node): node is Mesh => node instanceof Mesh && node.getTotalVertices() > 0);
  if (!mesh) throw new Error(`${file}: no render mesh`);

  mesh.computeWorldMatrix(true);
  const bounds = mesh.getBoundingInfo().boundingBox;
  const min = bounds.minimumWorld.clone();
  const max = bounds.maximumWorld.clone();
  mesh.setEnabled(false);
  mesh.isPickable = false;
  mesh.receiveShadows = true;

  return {
    mesh,
    width: Math.max(0.01, max.x - min.x),
    height: Math.max(0.01, max.y - min.y),
    depth: Math.max(0.01, max.z - min.z),
    minY: min.y,
  };
}

async function loadGlbTemplate(scene: Scene, root: string, file: string): Promise<Template> {
  const result = await SceneLoader.ImportMeshAsync(null, root, file, scene);
  const mesh = result.meshes.find((node): node is Mesh => node instanceof Mesh && node.getTotalVertices() > 0);
  if (!mesh) throw new Error(`${file}: no render mesh`);
  mesh.computeWorldMatrix(true);
  const bounds = mesh.getBoundingInfo().boundingBox;
  const min = bounds.minimumWorld.clone();
  const max = bounds.maximumWorld.clone();
  mesh.setEnabled(false);
  return {
    mesh,
    width: Math.max(0.01, max.x - min.x),
    height: Math.max(0.01, max.y - min.y),
    depth: Math.max(0.01, max.z - min.z),
    minY: min.y,
  };
}

function placeTemplate(template: Template, name: string, lot: Lot): Mesh | null {
  const mesh = template.mesh.clone(name);
  if (!mesh) return null;
  const sx = lot.w / template.width;
  const sy = lot.h / template.height;
  const sz = lot.d / template.depth;
  mesh.scaling = new Vector3(sx, sy, sz);
  mesh.rotation.y = lot.rot ?? 0;
  mesh.position = new Vector3(lot.x, -template.minY * sy, lot.z);
  mesh.setEnabled(true);
  mesh.receiveShadows = true;
  return mesh;
}

function addCollision(scene: Scene, physics: PhysicsManager, name: string, lot: Lot): void {
  const collider = MeshBuilder.CreateBox(`${name}-collision`, { width: lot.w * 0.88, height: lot.h, depth: lot.d * 0.88 }, scene);
  collider.position = new Vector3(lot.x, lot.h * 0.5, lot.z);
  collider.isVisible = false;
  physics.addStaticBox(collider);
}

function placeLots(scene: Scene, physics: PhysicsManager, templates: Template[], prefix: string, lots: Lot[]): number {
  let count = 0;
  lots.forEach((lot, index) => {
    if (!templates.length) return;
    const template = templates[lot.template ?? index % templates.length];
    const mesh = placeTemplate(template, `${prefix}-${index}`, lot);
    if (!mesh) return;
    addCollision(scene, physics, `${prefix}-${index}`, lot);
    count++;
  });
  return count;
}

function makeMaterial(scene: Scene, name: string, diffuse: Color3, emissive?: Color3): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = diffuse;
  material.specularColor = new Color3(0.05, 0.05, 0.05);
  if (emissive) material.emissiveColor = emissive;
  return material;
}

function addDistrictDetails(scene: Scene): number {
  let count = 0;
  const warm = makeMaterial(scene, "market-warm", new Color3(0.34, 0.15, 0.07), new Color3(0.36, 0.12, 0.02));
  const cyan = makeMaterial(scene, "neon-cyan", new Color3(0.02, 0.12, 0.16), new Color3(0.0, 0.85, 1.0));
  const magenta = makeMaterial(scene, "neon-magenta", new Color3(0.14, 0.02, 0.09), new Color3(1.0, 0.05, 0.65));
  const dock = makeMaterial(scene, "dock-container", new Color3(0.33, 0.16, 0.08));
  const green = makeMaterial(scene, "vip-green", new Color3(0.12, 0.28, 0.14));

  for (let i = 0; i < 12; i++) {
    const awning = MeshBuilder.CreateBox(`market-awning-${i}`, { width: 10, height: 0.25, depth: 3.5 }, scene);
    awning.position = new Vector3(-470 + (i % 6) * 28, 3.6, 205 + Math.floor(i / 6) * 70);
    awning.material = warm;
    count++;
  }

  for (let i = 0; i < 14; i++) {
    const sign = MeshBuilder.CreateBox(`neon-sign-${i}`, { width: 12, height: 4, depth: 0.35 }, scene);
    sign.position = new Vector3(35 + (i % 7) * 24, 9 + (i % 3) * 3, 65 - Math.floor(i / 7) * 72);
    sign.material = i % 2 ? cyan : magenta;
    count++;
  }

  for (let i = 0; i < 24; i++) {
    const box = MeshBuilder.CreateBox(`dock-cargo-${i}`, { width: 14, height: 3.2, depth: 6 }, scene);
    box.position = new Vector3(280 + (i % 6) * 23, 1.6 + (i % 7 === 0 ? 3.2 : 0), -330 + Math.floor(i / 6) * 24);
    box.material = dock;
    count++;
  }

  for (let i = 0; i < 20; i++) {
    const shrub = MeshBuilder.CreateSphere(`vip-shrub-${i}`, { diameter: 4.2, segments: 8 }, scene);
    shrub.position = new Vector3(-230 + (i % 10) * 48, 2.0, 435 + Math.floor(i / 10) * 90);
    shrub.scaling.y = 0.65;
    shrub.material = green;
    count++;
  }
  return count;
}

function createDistrictLots(): Record<string, Lot[]> {
  return {
    downtown: [
      { x: -140, z: 225, w: 58, d: 52, h: 92, template: 2 }, { x: -70, z: 230, w: 54, d: 48, h: 74, template: 1 },
      { x: 80, z: 225, w: 56, d: 50, h: 88, template: 2 }, { x: 145, z: 225, w: 48, d: 44, h: 66, template: 1 },
      { x: -130, z: 105, w: 52, d: 46, h: 62, template: 1 }, { x: -70, z: 100, w: 44, d: 40, h: 48, template: 0 },
      { x: 85, z: 105, w: 50, d: 44, h: 70, template: 1 }, { x: 145, z: 100, w: 48, d: 42, h: 56, template: 0 },
      { x: -125, z: 330, w: 54, d: 48, h: 82, template: 2 }, { x: 110, z: 330, w: 56, d: 50, h: 96, template: 2 },
    ],
    oldMarket: [
      { x: -470, z: 270, w: 34, d: 30, h: 22, template: 0 }, { x: -425, z: 270, w: 34, d: 30, h: 26, template: 0 },
      { x: -380, z: 270, w: 36, d: 32, h: 24, template: 0 }, { x: -335, z: 270, w: 34, d: 30, h: 28, template: 0 },
      { x: -470, z: 205, w: 36, d: 32, h: 20, template: 0 }, { x: -425, z: 205, w: 34, d: 30, h: 24, template: 0 },
      { x: -335, z: 205, w: 36, d: 32, h: 22, template: 0 }, { x: -290, z: 205, w: 36, d: 32, h: 26, template: 0 },
    ],
    tech: [
      { x: 280, z: 320, w: 62, d: 56, h: 72, template: 1 }, { x: 360, z: 320, w: 68, d: 60, h: 96, template: 2 },
      { x: 450, z: 320, w: 58, d: 54, h: 78, template: 1 }, { x: 285, z: 235, w: 58, d: 52, h: 58, template: 1 },
      { x: 425, z: 225, w: 66, d: 56, h: 84, template: 2 },
    ],
    neon: [
      { x: 55, z: 70, w: 38, d: 34, h: 38, template: 0 }, { x: 110, z: 70, w: 42, d: 36, h: 46, template: 1 },
      { x: 165, z: 70, w: 38, d: 34, h: 42, template: 0 }, { x: 55, z: -20, w: 40, d: 34, h: 36, template: 0 },
      { x: 110, z: -20, w: 44, d: 38, h: 52, template: 1 }, { x: 165, z: -20, w: 40, d: 34, h: 44, template: 0 },
    ],
    canal: [
      { x: -500, z: -70, w: 34, d: 30, h: 18, template: 0 }, { x: -445, z: -70, w: 34, d: 30, h: 22, template: 0 },
      { x: -315, z: -70, w: 34, d: 30, h: 20, template: 0 }, { x: -260, z: -70, w: 34, d: 30, h: 24, template: 0 },
      { x: -500, z: -265, w: 34, d: 30, h: 20, template: 0 }, { x: -445, z: -265, w: 34, d: 30, h: 22, template: 0 },
      { x: -315, z: -265, w: 34, d: 30, h: 18, template: 0 }, { x: -260, z: -265, w: 34, d: 30, h: 24, template: 0 },
    ],
    riverside: [
      { x: -120, z: -95, w: 46, d: 40, h: 40, template: 1 }, { x: 120, z: -95, w: 48, d: 42, h: 48, template: 1 },
      { x: -120, z: -265, w: 50, d: 44, h: 52, template: 1 }, { x: 120, z: -265, w: 52, d: 46, h: 58, template: 1 },
      { x: -155, z: -365, w: 46, d: 40, h: 42, template: 0 }, { x: 150, z: -365, w: 50, d: 44, h: 50, template: 1 },
    ],
    docks: [
      { x: 285, z: -85, w: 72, d: 52, h: 20, template: 0 }, { x: 385, z: -85, w: 78, d: 56, h: 22, template: 0 },
      { x: 480, z: -85, w: 72, d: 52, h: 18, template: 0 }, { x: 285, z: -280, w: 76, d: 58, h: 20, template: 0 },
      { x: 460, z: -275, w: 80, d: 60, h: 24, template: 0 },
    ],
    beach: [
      { x: -330, z: -500, w: 52, d: 44, h: 34, template: 1 }, { x: -245, z: -500, w: 56, d: 46, h: 42, template: 1 },
      { x: -155, z: -500, w: 48, d: 42, h: 32, template: 0 }, { x: 65, z: -500, w: 58, d: 48, h: 48, template: 1 },
      { x: 155, z: -500, w: 52, d: 44, h: 38, template: 1 },
    ],
    hills: [
      { x: -210, z: 465, w: 42, d: 36, h: 16, template: 0 }, { x: -120, z: 505, w: 44, d: 38, h: 18, template: 0 },
      { x: -20, z: 545, w: 48, d: 42, h: 22, template: 1 }, { x: 100, z: 505, w: 44, d: 38, h: 18, template: 0 },
      { x: 205, z: 465, w: 42, d: 36, h: 16, template: 0 },
    ],
  };
}

export async function buildDistrictEnvironment(scene: Scene, physics: PhysicsManager): Promise<number> {
  const cityRoot = repoAssetRoot("city-kit");
  const neonRoot = repoAssetRoot("neon-tech");
  const templates: Template[] = [];

  for (const file of BUILDINGS) {
    try {
      templates.push(await loadTexturelessGltf(scene, cityRoot, file));
    } catch (error) {
      console.error(`District building failed: ${file}`, error);
    }
  }

  if (!templates.length) {
    console.error("District environment aborted: no Quaternius building geometry loaded.");
    return 0;
  }

  const lots = createDistrictLots();
  let count = 0;
  count += placeLots(scene, physics, templates, "downtown", lots.downtown);
  count += placeLots(scene, physics, templates, "old-market", lots.oldMarket);
  count += placeLots(scene, physics, templates, "tech-port", lots.tech);
  count += placeLots(scene, physics, templates, "neon-quarter", lots.neon);
  count += placeLots(scene, physics, templates, "canal-town", lots.canal);
  count += placeLots(scene, physics, templates, "riverside", lots.riverside);
  count += placeLots(scene, physics, templates, "industrial-docks", lots.docks);
  count += placeLots(scene, physics, templates, "beach-marina", lots.beach);
  count += placeLots(scene, physics, templates, "vip-hills", lots.hills);

  const neonTemplates: Template[] = [];
  for (const file of NEON) {
    try {
      neonTemplates.push(await loadGlbTemplate(scene, neonRoot, file));
    } catch (error) {
      console.warn(`Neon asset skipped: ${file}`, error);
    }
  }

  if (neonTemplates.length) {
    const neonLots: Lot[] = [
      { x: 35, z: 25, w: 4, d: 4, h: 9 }, { x: 75, z: 25, w: 5, d: 5, h: 10 },
      { x: 115, z: 25, w: 8, d: 8, h: 5 }, { x: 155, z: 25, w: 8, d: 8, h: 5 },
      { x: 55, z: -70, w: 10, d: 12, h: 5 }, { x: 105, z: -70, w: 6, d: 6, h: 4 },
      { x: 155, z: -70, w: 6, d: 6, h: 4 }, { x: 80, z: -5, w: 12, d: 3, h: 4 },
      { x: 145, z: -5, w: 12, d: 3, h: 4 },
    ];
    neonLots.forEach((lot, i) => {
      const template = neonTemplates[i % neonTemplates.length];
      const mesh = placeTemplate(template, `neon-tech-${i}`, lot);
      if (mesh) count++;
    });
  }

  count += addDistrictDetails(scene);
  return count;
}
