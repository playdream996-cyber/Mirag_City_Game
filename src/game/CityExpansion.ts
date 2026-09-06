import "@babylonjs/loaders/glTF";
import {
  Color3,
  GlowLayer,
  Mesh,
  MeshBuilder,
  Scene,
  SceneLoader,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import { PhysicsManager } from "./PhysicsManager";

type CityTemplate = {
  mesh: Mesh;
  width: number;
  depth: number;
  minY: number;
};

const CITY_BUILDINGS = ["Building_Large_2", "Building_Medium_2_001", "Building_Small_1"] as const;
const NEON_MODELS = ["controlpanel", "crate", "stairs", "stairslight", "ramp", "pillar1a", "pillar2a"] as const;

function getBasePath(folder: string): string {
  const repoBase = window.location.pathname.startsWith("/Mirag_City_Game/") ? "/Mirag_City_Game/" : "/";
  return `${repoBase}assets/${folder}/`;
}

async function loadCityTemplate(scene: Scene, root: string, name: string): Promise<CityTemplate> {
  const result = await SceneLoader.ImportMeshAsync(null, root, `${name}.gltf`, scene);
  const mesh = result.meshes.find((node): node is Mesh => node instanceof Mesh && node.getTotalVertices() > 0);
  if (!mesh) throw new Error(`No render mesh in ${name}.gltf`);

  mesh.computeWorldMatrix(true);
  const bounds = mesh.getBoundingInfo().boundingBox;
  const width = Math.max(0.01, bounds.maximumWorld.x - bounds.minimumWorld.x);
  const depth = Math.max(0.01, bounds.maximumWorld.z - bounds.minimumWorld.z);
  const minY = bounds.minimumWorld.y;

  mesh.isPickable = false;
  mesh.receiveShadows = true;
  mesh.position.y -= 2000; // keep source mesh alive for instances but out of sight
  return { mesh, width, depth, minY };
}

function makeMaterial(scene: Scene, name: string, color: Color3): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  material.specularColor = new Color3(0.06, 0.06, 0.06);
  return material;
}

function makeNeonMaterial(scene: Scene, name: string, color: Color3): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color.scale(0.18);
  material.emissiveColor = color;
  material.specularColor = new Color3(0.15, 0.15, 0.15);
  return material;
}

async function addNeonProps(scene: Scene, root: string, center: Vector3): Promise<number> {
  let count = 0;
  for (let i = 0; i < NEON_MODELS.length; i++) {
    const name = NEON_MODELS[i];
    try {
      const result = await SceneLoader.ImportMeshAsync(null, root, `${name}.glb`, scene);
      const parentX = center.x + 10 + (i % 4) * 12;
      const parentZ = center.z + 8 + Math.floor(i / 4) * 18;
      for (const node of result.meshes) {
        node.position.x += parentX;
        node.position.z += parentZ;
        node.scaling.scaleInPlace(name.includes("pillar") ? 2.4 : 2.0);
        if (node instanceof Mesh) {
          node.isPickable = false;
          node.receiveShadows = true;
        }
      }
      count++;
    } catch (error) {
      console.warn(`Neon model ${name} could not load`, error);
    }
  }
  return count;
}

function buildVisibleNeonQuarter(scene: Scene): void {
  const glow = new GlowLayer("neon-quarter-glow", scene);
  glow.intensity = 0.9;
  glow.blurKernelSize = 32;

  const cyan = makeNeonMaterial(scene, "neon-cyan", new Color3(0.0, 0.95, 1.0));
  const magenta = makeNeonMaterial(scene, "neon-magenta", new Color3(1.0, 0.05, 0.75));
  const violet = makeNeonMaterial(scene, "neon-violet", new Color3(0.48, 0.15, 1.0));
  const dark = makeMaterial(scene, "neon-dark", new Color3(0.035, 0.045, 0.075));

  const center = new Vector3(245, 0, -215);
  const plaza = MeshBuilder.CreateBox("neon-quarter-plaza", { width: 92, height: 0.25, depth: 70 }, scene);
  plaza.position = center.add(new Vector3(0, 0.12, 0));
  plaza.material = dark;

  for (let i = 0; i < 10; i++) {
    const strip = MeshBuilder.CreateBox(`neon-strip-${i}`, { width: 2.2, height: 0.08, depth: 62 }, scene);
    strip.position = center.add(new Vector3(-40 + i * 9, 0.31, 0));
    strip.material = i % 2 === 0 ? cyan : magenta;
    glow.addIncludedOnlyMesh(strip);
  }

  for (let i = 0; i < 14; i++) {
    const pillar = MeshBuilder.CreateBox(`neon-pillar-${i}`, { width: 1.2, height: 12 + (i % 3) * 3, depth: 1.2 }, scene);
    const side = i < 7 ? -1 : 1;
    pillar.position = center.add(new Vector3(side * 42, pillar.scaling.y + 6, -28 + (i % 7) * 9.5));
    pillar.material = i % 3 === 0 ? magenta : i % 3 === 1 ? cyan : violet;
    glow.addIncludedOnlyMesh(pillar);
  }

  for (let i = 0; i < 6; i++) {
    const sign = MeshBuilder.CreateBox(`neon-sign-${i}`, { width: 13, height: 4.5, depth: 0.35 }, scene);
    sign.position = center.add(new Vector3(-31 + i * 12.5, 8 + (i % 2) * 5, -34));
    sign.material = i % 2 === 0 ? magenta : cyan;
    glow.addIncludedOnlyMesh(sign);
  }
}

export async function buildCityExpansion(scene: Scene, physics: PhysicsManager): Promise<number> {
  for (const boundaryName of ["north-boundary", "south-boundary", "east-boundary", "west-boundary"]) {
    const boundary = scene.getTransformNodeByName(boundaryName) ?? scene.getMeshByName(boundaryName);
    if (boundary) {
      physics.removeStaticBox(boundary);
      boundary.dispose();
    }
  }

  const groundMat = makeMaterial(scene, "outer-city-ground", new Color3(0.16, 0.22, 0.18));
  const roadMat = makeMaterial(scene, "outer-city-road", new Color3(0.035, 0.04, 0.055));
  const fallbackMats = [
    makeMaterial(scene, "outer-city-building-a", new Color3(0.28, 0.32, 0.37)),
    makeMaterial(scene, "outer-city-building-b", new Color3(0.42, 0.37, 0.32)),
    makeMaterial(scene, "outer-city-building-c", new Color3(0.24, 0.27, 0.32)),
  ];

  const ground = MeshBuilder.CreateBox("outer-city-ground", { width: 1500, height: 0.35, depth: 1500 }, scene);
  ground.position.y = -0.18;
  ground.material = groundMat;
  ground.receiveShadows = true;
  physics.addStaticBox(ground);

  const roadPositions = [-660, -540, -420, 420, 540, 660];
  for (const z of roadPositions) {
    const road = MeshBuilder.CreateBox(`outer-road-x-${z}`, { width: 1450, height: 0.1, depth: 20 }, scene);
    road.position = new Vector3(0, 0.055, z);
    road.material = roadMat;
  }
  for (const x of roadPositions) {
    const road = MeshBuilder.CreateBox(`outer-road-z-${x}`, { width: 20, height: 0.1, depth: 1450 }, scene);
    road.position = new Vector3(x, 0.055, 0);
    road.material = roadMat;
  }

  const cityRoot = getBasePath("city-kit");
  const templates: CityTemplate[] = [];
  for (const name of CITY_BUILDINGS) {
    try {
      templates.push(await loadCityTemplate(scene, cityRoot, name));
    } catch (error) {
      console.warn(`Could not load city kit model ${name}; keeping fallback.`, error);
    }
  }

  let index = 0;
  let kitBuildingCount = 0;
  for (let x = -690; x <= 690; x += 90) {
    for (let z = -690; z <= 690; z += 90) {
      if (Math.abs(x) < 390 && Math.abs(z) < 390) continue;
      if (roadPositions.some((road) => Math.abs(x - road) < 35 || Math.abs(z - road) < 35)) continue;
      if (x > 160 && x < 340 && z > -320 && z < -110) continue; // neon district

      const width = 58;
      const depth = 58;
      const fallbackHeight = 22 + ((index * 17) % 48);
      const collision = MeshBuilder.CreateBox(`outer-building-collision-${index}`, { width, height: fallbackHeight, depth }, scene);
      collision.position = new Vector3(x, fallbackHeight / 2, z);
      collision.isVisible = templates.length === 0;
      collision.material = fallbackMats[index % fallbackMats.length];
      physics.addStaticBox(collision);

      if (templates.length > 0) {
        const template = templates[index % templates.length];
        const instance = template.mesh.createInstance(`city-kit-building-${index}`);
        const scale = 0.88 * Math.min(width / template.width, depth / template.depth) * (0.9 + (index % 5) * 0.04);
        instance.scaling = new Vector3(scale, scale, scale);
        instance.rotation.y = (index % 4) * (Math.PI / 2);
        instance.position = new Vector3(x, -template.minY * scale, z);
        instance.receiveShadows = true;
        collision.isVisible = false;
        kitBuildingCount++;
      }
      index++;
    }
  }

  buildVisibleNeonQuarter(scene);
  void addNeonProps(scene, getBasePath("neon-tech"), new Vector3(205, 0, -245));

  return kitBuildingCount;
}
