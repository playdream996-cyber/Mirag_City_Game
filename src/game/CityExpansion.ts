import "@babylonjs/loaders/glTF";
import {
  Color3,
  Color4,
  GlowLayer,
  HemisphericLight,
  InstancedMesh,
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
  height: number;
  depth: number;
  minY: number;
};

const CITY_BUILDINGS = ["Building_Large_2", "Building_Medium_2_001", "Building_Small_1"] as const;
const ROAD_MODELS = ["Street_4Lane", "Street_4WayIntersection", "Street_TIntersection"] as const;
const SIDEWALK_MODELS = ["Sidewalk_Straight_3m", "Sidewalk_Corner_Round_3m"] as const;
const PROP_MODELS = ["Prop_Bollard", "Prop_ManholeCover", "Prop_Planter_Single"] as const;
const NEON_MODELS = [
  "floorplain",
  "floorx",
  "floorsquare",
  "lightplain",
  "lightx",
  "lightsquare",
  "lighthalf",
  "floorhalf",
  "pillar1a",
  "pillar1b",
  "pillar1c",
  "pillar2a",
  "pillar2b",
  "pillar2c",
  "stairs",
  "stairslight",
  "ramp",
  "controlpanel",
  "crate",
] as const;

const CORE_BLOCKS = [-337.5, -262.5, -187.5, -112.5, -37.5, 37.5, 112.5, 187.5, 262.5, 337.5] as const;
const OUTER_ROADS = [-660, -540, -420, 420, 540, 660] as const;

const LANDMARK_CELLS = new Set([
  "-37.5,37.5",
  "37.5,37.5",
  "-37.5,112.5",
  "112.5,37.5",
  "262.5,187.5",
  "187.5,-262.5",
  "-262.5,262.5",
  "-112.5,-37.5",
  "37.5,-37.5",
  "112.5,112.5",
  "-187.5,-112.5",
]);

function getBasePath(folder: string): string {
  const repoBase = window.location.pathname.startsWith("/Mirag_City_Game/") ? "/Mirag_City_Game/" : "/";
  return `${repoBase}assets/${folder}/`;
}

function hash01(x: number, z: number, salt: number): number {
  const value = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

async function loadTemplate(scene: Scene, root: string, file: string): Promise<CityTemplate> {
  const result = await SceneLoader.ImportMeshAsync(null, root, file, scene);
  const mesh = result.meshes.find((node): node is Mesh => node instanceof Mesh && node.getTotalVertices() > 0);
  if (!mesh) throw new Error(`No render mesh in ${file}`);

  mesh.computeWorldMatrix(true);
  const bounds = mesh.getBoundingInfo().boundingBox;
  const min = bounds.minimumWorld;
  const max = bounds.maximumWorld;
  mesh.isPickable = false;
  mesh.receiveShadows = true;
  mesh.position.y -= 5000;

  return {
    mesh,
    width: Math.max(0.01, max.x - min.x),
    height: Math.max(0.01, max.y - min.y),
    depth: Math.max(0.01, max.z - min.z),
    minY: min.y,
  };
}

function makeMaterial(scene: Scene, name: string, color: Color3, emissive?: Color3): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  material.specularColor = new Color3(0.08, 0.08, 0.08);
  if (emissive) material.emissiveColor = emissive;
  return material;
}

function applyMirageLighting(scene: Scene): GlowLayer {
  const hemi = scene.getLightByName("hemi");
  if (hemi instanceof HemisphericLight) {
    hemi.intensity = 0.82;
    hemi.diffuse = new Color3(0.72, 0.82, 1.0);
    hemi.groundColor = new Color3(0.16, 0.12, 0.18);
  }

  const sun = scene.getLightByName("sun");
  if (sun) {
    sun.intensity = 2.25;
    sun.diffuse = new Color3(1.0, 0.72, 0.48);
    sun.specular = new Color3(1.0, 0.78, 0.56);
  }

  scene.clearColor = new Color4(0.22, 0.31, 0.50, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.0009;
  scene.fogColor = new Color3(0.38, 0.43, 0.58);
  scene.ambientColor = new Color3(0.18, 0.20, 0.28);

  scene.imageProcessingConfiguration.exposure = 1.15;
  scene.imageProcessingConfiguration.contrast = 1.22;
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.vignetteEnabled = true;
  scene.imageProcessingConfiguration.vignetteWeight = 1.15;
  scene.imageProcessingConfiguration.vignetteStretch = 0.35;

  const glow = new GlowLayer("mirage-city-glow", scene);
  glow.intensity = 0.78;
  glow.blurKernelSize = 32;
  return glow;
}

function hideProceduralCore(scene: Scene): void {
  for (const mesh of scene.meshes) {
    const name = mesh.name;
    if (
      name.startsWith("building-") ||
      name.startsWith("window-front-") ||
      name.startsWith("neon-sign-")
    ) {
      mesh.isVisible = false;
    }
  }
}

function createInstance(
  template: CityTemplate,
  name: string,
  position: Vector3,
  targetWidth: number,
  targetDepth: number,
  heightMultiplier = 1,
  rotationY = 0,
): InstancedMesh {
  const instance = template.mesh.createInstance(name);
  const horizontalScale = Math.min(targetWidth / template.width, targetDepth / template.depth);
  instance.scaling = new Vector3(horizontalScale, horizontalScale * heightMultiplier, horizontalScale);
  instance.rotation.y = rotationY;
  instance.position = new Vector3(position.x, -template.minY * instance.scaling.y + position.y, position.z);
  instance.receiveShadows = true;
  return instance;
}

function districtHeightMultiplier(x: number, z: number, roll: number): number {
  if (x > 95 && z < 95) return 0.9 + roll * 0.7;
  if (Math.abs(x) < 120 && Math.abs(z) < 170) return 1.25 + roll * 1.35;
  if (x < -105) return 0.72 + roll * 0.45;
  if (x > 160 && z > 70) return 0.62 + roll * 0.35;
  if (z < -205) return 0.78 + roll * 0.55;
  return 0.8 + roll * 0.65;
}

function placeCoreCity(scene: Scene, templates: CityTemplate[]): number {
  if (templates.length === 0) return 0;
  let count = 0;

  for (const cx of CORE_BLOCKS) {
    for (const cz of CORE_BLOCKS) {
      if (LANDMARK_CELLS.has(`${cx},${cz}`)) continue;
      if (hash01(cx, cz, 90) > 0.88) continue;

      const neonQuarter = cx > 95 && cz < 95;
      const buildingCount = neonQuarter ? 3 : hash01(cx, cz, 3) > 0.52 ? 2 : 1;

      for (let i = 0; i < buildingCount; i++) {
        const template = templates[(count + i + Math.floor(hash01(cx, cz, 12) * templates.length)) % templates.length];
        const spread = buildingCount === 1 ? 0 : 13.5;
        const offsetX = buildingCount === 1 ? 0 : i % 2 === 0 ? -spread : spread;
        const offsetZ = buildingCount < 3 ? 0 : i === 2 ? 14 : -8;
        const lotWidth = buildingCount === 1 ? 45 : 23;
        const lotDepth = buildingCount === 1 ? 44 : 24;
        const h = districtHeightMultiplier(cx, cz, hash01(cx, cz, 30 + i));
        createInstance(
          template,
          `modular-core-building-${count}`,
          new Vector3(cx + offsetX, 0.28, cz + offsetZ),
          lotWidth,
          lotDepth,
          h,
          ((count + i) % 4) * Math.PI * 0.5,
        );
        count++;
      }
    }
  }

  return count;
}

function placeOuterCity(scene: Scene, physics: PhysicsManager, templates: CityTemplate[]): number {
  let count = 0;
  let index = 0;
  const fallbackMat = makeMaterial(scene, "outer-fallback", new Color3(0.18, 0.20, 0.25));

  for (let x = -690; x <= 690; x += 90) {
    for (let z = -690; z <= 690; z += 90) {
      if (Math.abs(x) < 390 && Math.abs(z) < 390) continue;
      if (OUTER_ROADS.some((road) => Math.abs(x - road) < 35 || Math.abs(z - road) < 35)) continue;

      const collision = MeshBuilder.CreateBox(`outer-building-collision-${index}`, { width: 58, height: 42, depth: 58 }, scene);
      collision.position = new Vector3(x, 21, z);
      collision.isVisible = templates.length === 0;
      collision.material = fallbackMat;
      physics.addStaticBox(collision);

      if (templates.length > 0) {
        const template = templates[index % templates.length];
        createInstance(
          template,
          `modular-outer-building-${index}`,
          new Vector3(x, 0.25, z),
          56,
          56,
          0.85 + hash01(x, z, 5) * 0.9,
          (index % 4) * Math.PI * 0.5,
        );
        collision.isVisible = false;
        count++;
      }
      index++;
    }
  }
  return count;
}

function placeRoadKit(scene: Scene, roadTemplates: Map<string, CityTemplate>, sidewalkTemplates: Map<string, CityTemplate>): number {
  let count = 0;
  const intersection = roadTemplates.get("Street_4WayIntersection");
  const lane = roadTemplates.get("Street_4Lane");
  const sidewalk = sidewalkTemplates.get("Sidewalk_Straight_3m");
  const corner = sidewalkTemplates.get("Sidewalk_Corner_Round_3m");

  if (intersection) {
    for (const x of [-225, -75, 75, 225]) {
      for (const z of [-225, -75, 75, 225]) {
        createInstance(intersection, `kit-intersection-${x}-${z}`, new Vector3(x, 0.18, z), 21, 21, 1, 0);
        count++;
      }
    }
  }

  if (lane) {
    for (const z of [-300, -150, 0, 150, 300]) {
      for (let x = -250; x <= 250; x += 100) {
        createInstance(lane, `kit-lane-x-${z}-${x}`, new Vector3(x, 0.17, z), 96, 20, 1, Math.PI * 0.5);
        count++;
      }
    }
  }

  if (sidewalk) {
    for (let i = 0; i < CORE_BLOCKS.length; i += 2) {
      const x = CORE_BLOCKS[i];
      createInstance(sidewalk, `kit-sidewalk-a-${i}`, new Vector3(x, 0.22, -337.5), 48, 4.5, 1, 0);
      createInstance(sidewalk, `kit-sidewalk-b-${i}`, new Vector3(x, 0.22, 337.5), 48, 4.5, 1, Math.PI);
      count += 2;
    }
  }

  if (corner) {
    for (const [x, z, r] of [
      [-337.5, -337.5, 0],
      [337.5, -337.5, Math.PI * 0.5],
      [337.5, 337.5, Math.PI],
      [-337.5, 337.5, Math.PI * 1.5],
    ] as const) {
      createInstance(corner, `kit-sidewalk-corner-${x}-${z}`, new Vector3(x, 0.22, z), 7, 7, 1, r);
      count++;
    }
  }

  return count;
}

function tintNeonMesh(mesh: InstancedMesh, scene: Scene, glow: GlowLayer, index: number): void {
  const colors = [
    new Color3(0.0, 0.95, 1.0),
    new Color3(1.0, 0.04, 0.72),
    new Color3(0.55, 0.12, 1.0),
  ];
  const color = colors[index % colors.length];
  const mat = makeMaterial(scene, `neon-tech-mat-${index}`, color.scale(0.18), color);
  mesh.material = mat;
  glow.addIncludedOnlyMesh(mesh);
}

function placeNeonQuarter(
  scene: Scene,
  glow: GlowLayer,
  neonTemplates: Map<string, CityTemplate>,
  propTemplates: Map<string, CityTemplate>,
): number {
  let count = 0;
  const center = new Vector3(210, 0.22, -155);
  const floorNames = ["floorplain", "floorx", "floorsquare", "floorhalf"];
  const lightNames = ["lightplain", "lightx", "lightsquare", "lighthalf"];
  const pillarNames = ["pillar1a", "pillar1b", "pillar1c", "pillar2a", "pillar2b", "pillar2c"];

  for (let x = 0; x < 5; x++) {
    for (let z = 0; z < 5; z++) {
      const template = neonTemplates.get(floorNames[(x + z) % floorNames.length]);
      if (!template) continue;
      const piece = createInstance(template, `neon-floor-${x}-${z}`, center.add(new Vector3((x - 2) * 11, 0, (z - 2) * 11)), 10.5, 10.5, 1, ((x + z) % 4) * Math.PI * 0.5);
      if ((x + z) % 3 === 0) tintNeonMesh(piece, scene, glow, count);
      count++;
    }
  }

  for (let i = 0; i < 18; i++) {
    const template = neonTemplates.get(pillarNames[i % pillarNames.length]);
    if (!template) continue;
    const side = i < 9 ? -1 : 1;
    const row = i % 9;
    const piece = createInstance(template, `neon-pillar-${i}`, center.add(new Vector3(side * 31, 0, -34 + row * 8.5)), 3.2, 3.2, 1.4 + (i % 3) * 0.2, 0);
    tintNeonMesh(piece, scene, glow, i);
    count++;
  }

  for (let i = 0; i < 10; i++) {
    const template = neonTemplates.get(lightNames[i % lightNames.length]);
    if (!template) continue;
    const piece = createInstance(template, `neon-light-${i}`, center.add(new Vector3(-22 + (i % 5) * 11, 0.45, -34 + Math.floor(i / 5) * 68)), 9, 5, 1, i % 2 ? Math.PI * 0.5 : 0);
    tintNeonMesh(piece, scene, glow, i + 20);
    count++;
  }

  for (const [name, offset, size, rot] of [
    ["stairs", new Vector3(-18, 0, 32), 8, 0],
    ["stairslight", new Vector3(17, 0, 32), 8, Math.PI],
    ["ramp", new Vector3(30, 0, 0), 9, Math.PI * 0.5],
    ["controlpanel", new Vector3(-8, 0, -20), 5, 0],
    ["crate", new Vector3(16, 0, -18), 5, Math.PI * 0.5],
  ] as const) {
    const template = neonTemplates.get(name);
    if (!template) continue;
    createInstance(template, `neon-feature-${name}`, center.add(offset), size, size, 1, rot);
    count++;
  }

  const planter = propTemplates.get("Prop_Planter_Single");
  if (planter) {
    for (let i = 0; i < 8; i++) {
      createInstance(planter, `neon-planter-${i}`, center.add(new Vector3(-28 + i * 8, 0, 40)), 5, 5, 1, i % 2 ? Math.PI * 0.5 : 0);
      count++;
    }
  }

  return count;
}

export async function buildCityExpansion(scene: Scene, physics: PhysicsManager): Promise<number> {
  hideProceduralCore(scene);
  const glow = applyMirageLighting(scene);

  for (const boundaryName of ["north-boundary", "south-boundary", "east-boundary", "west-boundary"]) {
    const boundary = scene.getTransformNodeByName(boundaryName) ?? scene.getMeshByName(boundaryName);
    if (boundary) {
      physics.removeStaticBox(boundary);
      boundary.dispose();
    }
  }

  const groundMat = makeMaterial(scene, "outer-city-ground", new Color3(0.13, 0.16, 0.17));
  const roadMat = makeMaterial(scene, "outer-city-road", new Color3(0.025, 0.03, 0.045));
  const ground = MeshBuilder.CreateBox("outer-city-ground", { width: 1500, height: 0.35, depth: 1500 }, scene);
  ground.position.y = -0.18;
  ground.material = groundMat;
  ground.receiveShadows = true;
  physics.addStaticBox(ground);

  for (const z of OUTER_ROADS) {
    const road = MeshBuilder.CreateBox(`outer-road-x-${z}`, { width: 1450, height: 0.1, depth: 20 }, scene);
    road.position = new Vector3(0, 0.055, z);
    road.material = roadMat;
  }
  for (const x of OUTER_ROADS) {
    const road = MeshBuilder.CreateBox(`outer-road-z-${x}`, { width: 20, height: 0.1, depth: 1450 }, scene);
    road.position = new Vector3(x, 0.055, 0);
    road.material = roadMat;
  }

  const cityRoot = getBasePath("city-kit");
  const neonRoot = getBasePath("neon-tech");

  const buildingTemplates: CityTemplate[] = [];
  for (const name of CITY_BUILDINGS) {
    try {
      buildingTemplates.push(await loadTemplate(scene, cityRoot, `${name}.gltf`));
    } catch (error) {
      console.warn(`Could not load modular building ${name}`, error);
    }
  }

  const roadTemplates = new Map<string, CityTemplate>();
  for (const name of ROAD_MODELS) {
    try {
      roadTemplates.set(name, await loadTemplate(scene, cityRoot, `${name}.gltf`));
    } catch (error) {
      console.warn(`Could not load road module ${name}`, error);
    }
  }

  const sidewalkTemplates = new Map<string, CityTemplate>();
  for (const name of SIDEWALK_MODELS) {
    try {
      sidewalkTemplates.set(name, await loadTemplate(scene, cityRoot, `${name}.gltf`));
    } catch (error) {
      console.warn(`Could not load sidewalk module ${name}`, error);
    }
  }

  const propTemplates = new Map<string, CityTemplate>();
  for (const name of PROP_MODELS) {
    try {
      propTemplates.set(name, await loadTemplate(scene, cityRoot, `${name}.gltf`));
    } catch (error) {
      console.warn(`Could not load prop ${name}`, error);
    }
  }

  const neonTemplates = new Map<string, CityTemplate>();
  for (const name of NEON_MODELS) {
    try {
      neonTemplates.set(name, await loadTemplate(scene, neonRoot, `${name}.glb`));
    } catch (error) {
      console.warn(`Could not load neon module ${name}`, error);
    }
  }

  const coreCount = placeCoreCity(scene, buildingTemplates);
  const outerCount = placeOuterCity(scene, physics, buildingTemplates);
  placeRoadKit(scene, roadTemplates, sidewalkTemplates);
  placeNeonQuarter(scene, glow, neonTemplates, propTemplates);

  return coreCount + outerCount;
}
