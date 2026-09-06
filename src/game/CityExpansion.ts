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
import { DISTRICT_RULES, getDistrictRule, getMapDistrict, MapDistrict } from "./DistrictRules";
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
  "floorplain", "floorx", "floorsquare", "lightplain", "lightx", "lightsquare", "lighthalf", "floorhalf",
  "pillar1a", "pillar1b", "pillar1c", "pillar2a", "pillar2b", "pillar2c",
  "stairs", "stairslight", "ramp", "controlpanel", "crate",
] as const;

const CORE_BLOCKS = [-337.5, -262.5, -187.5, -112.5, -37.5, 37.5, 112.5, 187.5, 262.5, 337.5] as const;
const OUTER_ROADS = [-660, -540, -420, 420, 540, 660] as const;
const LANDMARK_CELLS = new Set([
  "-37.5,37.5", "37.5,37.5", "-37.5,112.5", "112.5,37.5", "262.5,187.5",
  "187.5,-262.5", "-262.5,262.5", "-112.5,-37.5", "37.5,-37.5", "112.5,112.5", "-187.5,-112.5",
]);

const DISTRICT_LOT_SCALE: Record<MapDistrict, number> = {
  "Hills / VIP District": 0.76,
  "Old Market": 0.82,
  "Central Downtown": 1.0,
  "Tech / Port": 0.94,
  "Neon Quarter": 0.86,
  "Canal Town": 0.74,
  Riverside: 0.88,
  "Industrial Docks": 0.98,
  "Beach / Marina": 0.84,
};

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
    hemi.intensity = 0.86;
    hemi.diffuse = new Color3(0.70, 0.82, 1.0);
    hemi.groundColor = new Color3(0.14, 0.11, 0.17);
  }

  const sun = scene.getLightByName("sun");
  if (sun) {
    sun.intensity = 2.3;
    sun.diffuse = new Color3(1.0, 0.70, 0.44);
    sun.specular = new Color3(1.0, 0.76, 0.54);
  }

  scene.clearColor = new Color4(0.20, 0.29, 0.47, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.00082;
  scene.fogColor = new Color3(0.37, 0.42, 0.57);
  scene.ambientColor = new Color3(0.18, 0.20, 0.28);
  scene.imageProcessingConfiguration.exposure = 1.16;
  scene.imageProcessingConfiguration.contrast = 1.24;
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.vignetteEnabled = true;
  scene.imageProcessingConfiguration.vignetteWeight = 1.05;
  scene.imageProcessingConfiguration.vignetteStretch = 0.32;

  const glow = new GlowLayer("mirage-city-glow", scene);
  glow.intensity = 0.72;
  glow.blurKernelSize = 32;
  return glow;
}

function hideProceduralCore(scene: Scene): void {
  for (const mesh of scene.meshes) {
    if (mesh.name.startsWith("building-") || mesh.name.startsWith("window-front-") || mesh.name.startsWith("neon-sign-")) {
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
  targetHeight: number,
  rotationY = 0,
): InstancedMesh {
  const instance = template.mesh.createInstance(name);
  const horizontalScale = Math.min(targetWidth / template.width, targetDepth / template.depth);
  const verticalScale = Math.max(0.15, targetHeight / template.height);
  instance.scaling = new Vector3(horizontalScale, verticalScale, horizontalScale);
  instance.rotation.y = rotationY;
  instance.position = new Vector3(position.x, -template.minY * verticalScale + position.y, position.z);
  instance.receiveShadows = true;
  return instance;
}

function targetHeightForDistrict(position: Vector3, roll: number): number {
  const rule = getDistrictRule(position);
  return rule.minHeight + (rule.maxHeight - rule.minHeight) * roll;
}

function buildingCountForDistrict(position: Vector3, roll: number): number {
  const district = getMapDistrict(position);
  const density = getDistrictRule(position).buildingDensity;
  if (roll > density) return 0;
  if (district === "Central Downtown") return roll < density * 0.58 ? 3 : 2;
  if (district === "Neon Quarter" || district === "Old Market" || district === "Canal Town") return roll < density * 0.52 ? 2 : 1;
  if (district === "Hills / VIP District" || district === "Industrial Docks" || district === "Beach / Marina") return 1;
  return roll < density * 0.42 ? 2 : 1;
}

function placeCoreCity(scene: Scene, templates: CityTemplate[]): number {
  if (templates.length === 0) return 0;
  let count = 0;

  for (const cx of CORE_BLOCKS) {
    for (const cz of CORE_BLOCKS) {
      if (LANDMARK_CELLS.has(`${cx},${cz}`)) continue;

      const center = new Vector3(cx, 0.28, cz);
      const district = getMapDistrict(center);
      const rule = DISTRICT_RULES[district];
      const blockRoll = hash01(cx, cz, 90);
      const buildingCount = buildingCountForDistrict(center, blockRoll);
      if (buildingCount === 0) continue;

      const lotScale = DISTRICT_LOT_SCALE[district];
      const baseLot = 46 * lotScale;
      const splitLot = 24 * lotScale;

      for (let i = 0; i < buildingCount; i++) {
        const template = templates[(count + i + Math.floor(hash01(cx, cz, 12) * templates.length)) % templates.length];
        const spread = buildingCount === 1 ? 0 : 13.5 * lotScale;
        const offsetX = buildingCount === 1 ? 0 : i % 2 === 0 ? -spread : spread;
        const offsetZ = buildingCount < 3 ? 0 : i === 2 ? 13 * lotScale : -8 * lotScale;
        const targetWidth = buildingCount === 1 ? baseLot : splitLot;
        const targetDepth = buildingCount === 1 ? baseLot * 0.96 : splitLot;
        const targetHeight = targetHeightForDistrict(center, hash01(cx, cz, 30 + i));

        createInstance(
          template,
          `district-${district.replaceAll(" ", "-")}-building-${count}`,
          new Vector3(cx + offsetX, 0.28, cz + offsetZ),
          targetWidth,
          targetDepth,
          targetHeight,
          ((count + i) % 4) * Math.PI * 0.5,
        );
        count++;
      }

      // Prop anchors make dense districts feel lived-in without randomizing the map itself.
      const propAnchors = Math.floor(rule.propDensity * 3);
      for (let i = 0; i < propAnchors; i++) {
        const marker = MeshBuilder.CreateBox(`district-prop-anchor-${cx}-${cz}-${i}`, { width: 0.14, height: 0.14, depth: 0.14 }, scene);
        marker.position = new Vector3(cx - 18 + i * 12, 0.18, cz + 19);
        marker.isVisible = false;
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

      const position = new Vector3(x, 0.25, z);
      const rule = getDistrictRule(position);
      if (hash01(x, z, 42) > Math.max(0.32, rule.buildingDensity * 0.82)) continue;

      const targetHeight = targetHeightForDistrict(position, hash01(x, z, 5));
      const collision = MeshBuilder.CreateBox(`outer-building-collision-${index}`, { width: 58, height: targetHeight, depth: 58 }, scene);
      collision.position = new Vector3(x, targetHeight / 2, z);
      collision.isVisible = templates.length === 0;
      collision.material = fallbackMat;
      physics.addStaticBox(collision);

      if (templates.length > 0) {
        createInstance(
          templates[index % templates.length],
          `district-outer-building-${index}`,
          position,
          56,
          56,
          targetHeight,
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

function placeRoadKit(roadTemplates: Map<string, CityTemplate>, sidewalkTemplates: Map<string, CityTemplate>): number {
  let count = 0;
  const intersection = roadTemplates.get("Street_4WayIntersection");
  const lane = roadTemplates.get("Street_4Lane");
  const sidewalk = sidewalkTemplates.get("Sidewalk_Straight_3m");
  const corner = sidewalkTemplates.get("Sidewalk_Corner_Round_3m");

  if (intersection) {
    for (const x of [-225, -75, 75, 225]) {
      for (const z of [-225, -75, 75, 225]) {
        createInstance(intersection, `kit-intersection-${x}-${z}`, new Vector3(x, 0.18, z), 21, 21, 1.2);
        count++;
      }
    }
  }

  if (lane) {
    for (const z of [-300, -150, 0, 150, 300]) {
      for (let x = -250; x <= 250; x += 100) {
        createInstance(lane, `kit-lane-x-${z}-${x}`, new Vector3(x, 0.17, z), 96, 20, 1.0, Math.PI * 0.5);
        count++;
      }
    }
  }

  if (sidewalk) {
    for (let i = 0; i < CORE_BLOCKS.length; i += 2) {
      const x = CORE_BLOCKS[i];
      createInstance(sidewalk, `kit-sidewalk-a-${i}`, new Vector3(x, 0.22, -337.5), 48, 4.5, 0.45);
      createInstance(sidewalk, `kit-sidewalk-b-${i}`, new Vector3(x, 0.22, 337.5), 48, 4.5, 0.45, Math.PI);
      count += 2;
    }
  }

  if (corner) {
    for (const [x, z, r] of [
      [-337.5, -337.5, 0], [337.5, -337.5, Math.PI * 0.5],
      [337.5, 337.5, Math.PI], [-337.5, 337.5, Math.PI * 1.5],
    ] as const) {
      createInstance(corner, `kit-sidewalk-corner-${x}-${z}`, new Vector3(x, 0.22, z), 7, 7, 0.45, r);
      count++;
    }
  }
  return count;
}

function tintNeonMesh(mesh: InstancedMesh, scene: Scene, index: number, strength: number): void {
  const colors = [new Color3(0.0, 0.95, 1.0), new Color3(1.0, 0.04, 0.72), new Color3(0.55, 0.12, 1.0)];
  const color = colors[index % colors.length];
  mesh.material = makeMaterial(scene, `neon-tech-mat-${index}`, color.scale(0.16), color.scale(Math.max(0.35, strength)));
}

function placeNeonQuarter(scene: Scene, neonTemplates: Map<string, CityTemplate>, propTemplates: Map<string, CityTemplate>): number {
  let count = 0;
  const center = new Vector3(210, 0.22, -155);
  const rule = DISTRICT_RULES["Neon Quarter"];
  const floorNames = ["floorplain", "floorx", "floorsquare", "floorhalf"];
  const lightNames = ["lightplain", "lightx", "lightsquare", "lighthalf"];
  const pillarNames = ["pillar1a", "pillar1b", "pillar1c", "pillar2a", "pillar2b", "pillar2c"];

  for (let x = 0; x < 5; x++) {
    for (let z = 0; z < 5; z++) {
      const template = neonTemplates.get(floorNames[(x + z) % floorNames.length]);
      if (!template) continue;
      const piece = createInstance(template, `neon-floor-${x}-${z}`, center.add(new Vector3((x - 2) * 11, 0, (z - 2) * 11)), 10.5, 10.5, 0.5, ((x + z) % 4) * Math.PI * 0.5);
      if ((x + z) % 3 === 0) tintNeonMesh(piece, scene, count, rule.neonStrength);
      count++;
    }
  }

  const pillarTargetCount = Math.round(12 + rule.propDensity * 6);
  for (let i = 0; i < pillarTargetCount; i++) {
    const template = neonTemplates.get(pillarNames[i % pillarNames.length]);
    if (!template) continue;
    const side = i < Math.ceil(pillarTargetCount / 2) ? -1 : 1;
    const row = i % Math.ceil(pillarTargetCount / 2);
    const piece = createInstance(template, `neon-pillar-${i}`, center.add(new Vector3(side * 31, 0, -34 + row * 8.5)), 3.2, 3.2, 8 + (i % 3) * 2.5);
    tintNeonMesh(piece, scene, i, rule.neonStrength);
    count++;
  }

  for (let i = 0; i < 10; i++) {
    const template = neonTemplates.get(lightNames[i % lightNames.length]);
    if (!template) continue;
    const piece = createInstance(template, `neon-light-${i}`, center.add(new Vector3(-22 + (i % 5) * 11, 0.45, -34 + Math.floor(i / 5) * 68)), 9, 5, 1.0, i % 2 ? Math.PI * 0.5 : 0);
    tintNeonMesh(piece, scene, i + 20, rule.neonStrength);
    count++;
  }

  for (const [name, offset, width, depth, height, rot] of [
    ["stairs", new Vector3(-18, 0, 32), 8, 8, 5, 0],
    ["stairslight", new Vector3(17, 0, 32), 8, 8, 5, Math.PI],
    ["ramp", new Vector3(30, 0, 0), 9, 9, 4, Math.PI * 0.5],
    ["controlpanel", new Vector3(-8, 0, -20), 5, 5, 3, 0],
    ["crate", new Vector3(16, 0, -18), 5, 5, 3, Math.PI * 0.5],
  ] as const) {
    const template = neonTemplates.get(name);
    if (!template) continue;
    createInstance(template, `neon-feature-${name}`, center.add(offset), width, depth, height, rot);
    count++;
  }

  const planter = propTemplates.get("Prop_Planter_Single");
  if (planter) {
    const planterCount = Math.round(5 + rule.propDensity * 4);
    for (let i = 0; i < planterCount; i++) {
      createInstance(planter, `neon-planter-${i}`, center.add(new Vector3(-28 + i * 8, 0, 40)), 5, 5, 2.2, i % 2 ? Math.PI * 0.5 : 0);
      count++;
    }
  }

  return count;
}

function placeDistrictAccents(scene: Scene): void {
  const water = makeMaterial(scene, "district-canal-water", new Color3(0.035, 0.24, 0.36));
  water.alpha = 0.96;
  const sand = makeMaterial(scene, "district-marina-sand", new Color3(0.72, 0.62, 0.44));
  const dock = makeMaterial(scene, "district-dock-ground", new Color3(0.19, 0.20, 0.22));
  const hill = makeMaterial(scene, "district-hills-green", new Color3(0.17, 0.29, 0.18));

  // Canal Town: fixed waterways matching the approved west-side water district.
  for (const z of [-175, -120]) {
    const canal = MeshBuilder.CreateBox(`canal-town-water-${z}`, { width: 150, height: 0.08, depth: 11 }, scene);
    canal.position = new Vector3(-220, 0.08, z);
    canal.material = water;
  }

  // Riverside: central south water spine toward the marina.
  const river = MeshBuilder.CreateBox("riverside-water-spine", { width: 28, height: 0.09, depth: 175 }, scene);
  river.position = new Vector3(0, 0.07, -165);
  river.material = water;

  // Industrial docks: visible hardened ground near the eastern waterfront.
  const docks = MeshBuilder.CreateBox("industrial-docks-apron", { width: 150, height: 0.12, depth: 120 }, scene);
  docks.position = new Vector3(245, 0.08, -170);
  docks.material = dock;

  // Beach/Marina: broad open sand so the southern edge does not read as another building grid.
  const beach = MeshBuilder.CreateBox("district-beach-marina", { width: 320, height: 0.12, depth: 58 }, scene);
  beach.position = new Vector3(0, 0.07, -330);
  beach.material = sand;

  // Hills/VIP: a raised green terrace behind downtown, preserving road access while changing silhouette.
  for (let i = 0; i < 4; i++) {
    const terrace = MeshBuilder.CreateBox(`vip-hill-terrace-${i}`, { width: 250 - i * 34, height: 1.4, depth: 34 }, scene);
    terrace.position = new Vector3(-35, 0.7 + i * 0.9, 245 + i * 31);
    terrace.material = hill;
  }
}

export async function buildCityExpansion(scene: Scene, physics: PhysicsManager): Promise<number> {
  hideProceduralCore(scene);
  applyMirageLighting(scene);
  placeDistrictAccents(scene);

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
  placeRoadKit(roadTemplates, sidewalkTemplates);
  placeNeonQuarter(scene, neonTemplates, propTemplates);

  return coreCount + outerCount;
}
