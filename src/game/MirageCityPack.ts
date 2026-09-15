import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import { PhysicsManager } from "./PhysicsManager";

export type MirageDistrictName =
  | "Hills / VIP District"
  | "Old Market"
  | "Central Downtown"
  | "Tech / Port"
  | "Canal Town"
  | "Neon Quarter"
  | "Riverside"
  | "Industrial Docks"
  | "Beach / Marina";

export type MirageCityPackContext = {
  featureCount: number;
  getDistrictAt(position: Vector3): MirageDistrictName;
  getNearestLandmark(position: Vector3): string;
};

type Landmark = {
  name: string;
  position: Vector3;
};

type DistrictAnchor = {
  name: MirageDistrictName;
  center: Vector3;
};

const DISTRICTS: readonly DistrictAnchor[] = [
  { name: "Hills / VIP District", center: new Vector3(0, 0, 520) },
  { name: "Old Market", center: new Vector3(-390, 0, 210) },
  { name: "Central Downtown", center: new Vector3(0, 0, 170) },
  { name: "Tech / Port", center: new Vector3(360, 0, 180) },
  { name: "Canal Town", center: new Vector3(-390, 0, -150) },
  { name: "Neon Quarter", center: new Vector3(0, 0, -120) },
  { name: "Riverside", center: new Vector3(0, 0, -320) },
  { name: "Industrial Docks", center: new Vector3(390, 0, -190) },
  { name: "Beach / Marina", center: new Vector3(0, 0, -560) },
] as const;

function distanceXZ(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

function districtAt(position: Vector3): MirageDistrictName {
  const { x, z } = position;
  if (z < -460) return "Beach / Marina";
  if (x > 260 && z < -40) return "Industrial Docks";
  if (x < -260 && z < -20) return "Canal Town";
  if (Math.abs(x) < 260 && z < -245) return "Riverside";
  if (z > 390) return "Hills / VIP District";
  if (x < -260) return "Old Market";
  if (x > 260) return "Tech / Port";
  if (Math.abs(x) < 235 && z < -45) return "Neon Quarter";
  return "Central Downtown";
}

function shouldClearOuterBuilding(x: number, z: number): boolean {
  if (z < -455) return true;
  if (x > 275 && z > -345 && z < -35) return true;
  if (x < -265 && z > -300 && z < -15) return true;
  if (Math.abs(x) < 285 && z > -435 && z < -245) return true;
  if (x < -285 && z > 55 && z < 345) return true;
  if (x > 275 && z > 55 && z < 345) return true;
  if (Math.abs(x) < 285 && z > 390) return true;
  return false;
}

function makeMaterial(
  scene: Scene,
  name: string,
  diffuse: Color3,
  emissive?: Color3,
  alpha = 1,
): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = diffuse;
  material.specularColor = new Color3(0.07, 0.07, 0.07);
  if (emissive) material.emissiveColor = emissive;
  material.alpha = alpha;
  return material;
}

export function buildMirageCityPack(scene: Scene, physics: PhysicsManager): MirageCityPackContext {
  let featureCount = 0;
  const landmarks: Landmark[] = [];

  for (const mesh of [...scene.meshes]) {
    if (!mesh.name.startsWith("modular-outer-building-")) continue;
    if (!shouldClearOuterBuilding(mesh.position.x, mesh.position.z)) continue;
    const index = mesh.name.slice("modular-outer-building-".length);
    const collision = scene.getMeshByName(`outer-building-collision-${index}`);
    if (collision) {
      physics.removeStaticBox(collision);
      collision.dispose();
    }
    mesh.dispose();
  }

  const materials = {
    asphalt: makeMaterial(scene, "mcp-asphalt", new Color3(0.035, 0.04, 0.052)),
    asphaltLight: makeMaterial(scene, "mcp-asphalt-light", new Color3(0.065, 0.07, 0.082)),
    lane: makeMaterial(scene, "mcp-lane", new Color3(0.92, 0.92, 0.86)),
    laneGold: makeMaterial(scene, "mcp-lane-gold", new Color3(0.95, 0.70, 0.16)),
    concrete: makeMaterial(scene, "mcp-concrete", new Color3(0.46, 0.48, 0.50)),
    concreteDark: makeMaterial(scene, "mcp-concrete-dark", new Color3(0.24, 0.27, 0.30)),
    glass: makeMaterial(scene, "mcp-glass", new Color3(0.09, 0.22, 0.32)),
    glassBlue: makeMaterial(scene, "mcp-glass-blue", new Color3(0.08, 0.30, 0.46)),
    glassCyan: makeMaterial(scene, "mcp-glass-cyan", new Color3(0.05, 0.34, 0.44)),
    white: makeMaterial(scene, "mcp-white", new Color3(0.78, 0.79, 0.77)),
    warmWall: makeMaterial(scene, "mcp-warm-wall", new Color3(0.62, 0.40, 0.29)),
    warmWall2: makeMaterial(scene, "mcp-warm-wall-2", new Color3(0.72, 0.56, 0.39)),
    roof: makeMaterial(scene, "mcp-roof", new Color3(0.35, 0.15, 0.10)),
    industrial: makeMaterial(scene, "mcp-industrial", new Color3(0.34, 0.37, 0.38)),
    industrialDark: makeMaterial(scene, "mcp-industrial-dark", new Color3(0.18, 0.21, 0.23)),
    rust: makeMaterial(scene, "mcp-rust", new Color3(0.50, 0.24, 0.12)),
    containerBlue: makeMaterial(scene, "mcp-container-blue", new Color3(0.06, 0.25, 0.46)),
    containerRed: makeMaterial(scene, "mcp-container-red", new Color3(0.53, 0.12, 0.10)),
    containerGold: makeMaterial(scene, "mcp-container-gold", new Color3(0.72, 0.45, 0.10)),
    grass: makeMaterial(scene, "mcp-grass", new Color3(0.15, 0.36, 0.16)),
    hillGrass: makeMaterial(scene, "mcp-hill-grass", new Color3(0.18, 0.42, 0.20)),
    sand: makeMaterial(scene, "mcp-sand", new Color3(0.80, 0.70, 0.48)),
    water: makeMaterial(scene, "mcp-water", new Color3(0.03, 0.28, 0.48), new Color3(0.00, 0.035, 0.06), 0.92),
    waterBright: makeMaterial(scene, "mcp-water-bright", new Color3(0.02, 0.36, 0.58), new Color3(0.00, 0.045, 0.08), 0.90),
    palmTrunk: makeMaterial(scene, "mcp-palm-trunk", new Color3(0.34, 0.22, 0.10)),
    palmLeaf: makeMaterial(scene, "mcp-palm-leaf", new Color3(0.08, 0.35, 0.14)),
    neonCyan: makeMaterial(scene, "mcp-neon-cyan", new Color3(0.02, 0.18, 0.24), new Color3(0.00, 0.88, 1.00)),
    neonPink: makeMaterial(scene, "mcp-neon-pink", new Color3(0.25, 0.03, 0.15), new Color3(1.00, 0.04, 0.62)),
    neonViolet: makeMaterial(scene, "mcp-neon-violet", new Color3(0.16, 0.05, 0.28), new Color3(0.56, 0.10, 1.00)),
    gold: makeMaterial(scene, "mcp-gold", new Color3(0.72, 0.50, 0.12), new Color3(0.12, 0.06, 0.01)),
  };

  const createBox = (
    name: string,
    position: Vector3,
    size: Vector3,
    material: StandardMaterial,
    solid = false,
    rotationY = 0,
  ): Mesh => {
    const mesh = MeshBuilder.CreateBox(name, { width: size.x, height: size.y, depth: size.z }, scene);
    mesh.position = position;
    mesh.rotation.y = rotationY;
    mesh.material = material;
    mesh.receiveShadows = true;
    if (solid) physics.addStaticBox(mesh);
    featureCount++;
    return mesh;
  };

  const createCylinder = (
    name: string,
    position: Vector3,
    diameter: number,
    height: number,
    material: StandardMaterial,
    tessellation = 16,
    solid = false,
  ): Mesh => {
    const mesh = MeshBuilder.CreateCylinder(name, { diameter, height, tessellation }, scene);
    mesh.position = position;
    mesh.material = material;
    mesh.receiveShadows = true;
    if (solid) physics.addStaticBox(mesh);
    featureCount++;
    return mesh;
  };

  const addLandmark = (name: string, position: Vector3): void => {
    landmarks.push({ name, position });
  };

  const createRoad = (
    name: string,
    position: Vector3,
    length: number,
    width: number,
    rotationY = 0,
    elevatedY = 0.12,
  ): void => {
    createBox(name, new Vector3(position.x, elevatedY, position.z), new Vector3(length, 0.20, width), materials.asphalt, false, rotationY);
    const stripeSpacing = 24;
    for (let offset = -length * 0.44; offset <= length * 0.44; offset += stripeSpacing) {
      const localX = Math.cos(rotationY) * offset;
      const localZ = -Math.sin(rotationY) * offset;
      createBox(
        `${name}-lane-${Math.round(offset)}`,
        new Vector3(position.x + localX, elevatedY + 0.115, position.z + localZ),
        new Vector3(9, 0.018, 0.32),
        materials.lane,
        false,
        rotationY,
      );
    }
  };

  const createBridge = (
    name: string,
    position: Vector3,
    length: number,
    width: number,
    rotationY = 0,
    deckY = 2.8,
  ): void => {
    createBox(`${name}-deck`, new Vector3(position.x, deckY, position.z), new Vector3(length, 0.65, width), materials.asphaltLight, true, rotationY);
    const railOffset = width * 0.46;
    const nx = Math.sin(rotationY) * railOffset;
    const nz = Math.cos(rotationY) * railOffset;
    createBox(`${name}-rail-a`, new Vector3(position.x + nx, deckY + 0.75, position.z + nz), new Vector3(length, 0.65, 0.45), materials.concrete, false, rotationY);
    createBox(`${name}-rail-b`, new Vector3(position.x - nx, deckY + 0.75, position.z - nz), new Vector3(length, 0.65, 0.45), materials.concrete, false, rotationY);
    for (let i = -1; i <= 1; i++) {
      const along = i * length * 0.32;
      const px = position.x + Math.cos(rotationY) * along;
      const pz = position.z - Math.sin(rotationY) * along;
      createBox(`${name}-pier-${i}`, new Vector3(px, deckY * 0.5, pz), new Vector3(2.2, deckY, 2.2), materials.concreteDark, false);
    }
  };

  const createPalm = (name: string, x: number, z: number, scale = 1): void => {
    createCylinder(`${name}-trunk`, new Vector3(x, 3.1 * scale, z), 0.75 * scale, 6.2 * scale, materials.palmTrunk, 8);
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 * i) / 5;
      const leaf = createBox(
        `${name}-leaf-${i}`,
        new Vector3(x + Math.cos(angle) * 1.5 * scale, 6.35 * scale, z + Math.sin(angle) * 1.5 * scale),
        new Vector3(3.6 * scale, 0.18 * scale, 0.75 * scale),
        materials.palmLeaf,
      );
      leaf.rotation.y = -angle;
      leaf.rotation.z = 0.10;
    }
  };

  const createStreetLamp = (name: string, x: number, z: number, rotationY = 0): void => {
    createCylinder(`${name}-pole`, new Vector3(x, 2.6, z), 0.18, 5.2, materials.industrialDark, 8);
    const armX = Math.cos(rotationY) * 0.7;
    const armZ = -Math.sin(rotationY) * 0.7;
    createBox(`${name}-arm`, new Vector3(x + armX, 5.1, z + armZ), new Vector3(1.4, 0.14, 0.14), materials.industrialDark, false, rotationY);
    createBox(`${name}-light`, new Vector3(x + armX * 1.65, 5.0, z + armZ * 1.65), new Vector3(0.42, 0.18, 0.42), materials.gold);
  };

  const createTower = (
    name: string,
    x: number,
    z: number,
    width: number,
    depth: number,
    height: number,
    material: StandardMaterial,
  ): void => {
    createBox(name, new Vector3(x, height * 0.5, z), new Vector3(width, height, depth), material, true);
    createBox(`${name}-crown`, new Vector3(x, height + 2.5, z), new Vector3(width * 0.72, 5, depth * 0.72), materials.gold);
  };

  const createLowRise = (
    name: string,
    x: number,
    z: number,
    width: number,
    depth: number,
    height: number,
    wall: StandardMaterial,
  ): void => {
    createBox(name, new Vector3(x, height * 0.5, z), new Vector3(width, height, depth), wall, false);
    createBox(`${name}-roof`, new Vector3(x, height + 0.7, z), new Vector3(width * 1.02, 1.4, depth * 1.02), materials.roof, false);
  };

  const createContainer = (name: string, x: number, y: number, z: number, material: StandardMaterial, rotationY = 0): void => {
    createBox(name, new Vector3(x, y + 1.4, z), new Vector3(6.0, 2.8, 2.5), material, false, rotationY);
  };

  const createCrane = (name: string, x: number, z: number, rotationY = 0): void => {
    createBox(`${name}-base`, new Vector3(x, 8, z), new Vector3(3.0, 16, 3.0), materials.rust, false, rotationY);
    createBox(`${name}-boom`, new Vector3(x, 15.5, z), new Vector3(18, 1.0, 1.0), materials.rust, false, rotationY);
    const offsetX = Math.cos(rotationY) * 7.5;
    const offsetZ = -Math.sin(rotationY) * 7.5;
    createBox(`${name}-cable`, new Vector3(x + offsetX, 10.5, z + offsetZ), new Vector3(0.16, 9.0, 0.16), materials.industrialDark);
    createBox(`${name}-hook`, new Vector3(x + offsetX, 6.0, z + offsetZ), new Vector3(0.7, 0.7, 0.7), materials.gold);
  };

  createBox("mcp-ocean-south", new Vector3(0, -0.03, -850), new Vector3(1900, 0.12, 300), materials.waterBright);
  createBox("mcp-ocean-west", new Vector3(-850, -0.03, -80), new Vector3(300, 0.12, 1250), materials.water);
  createBox("mcp-ocean-east", new Vector3(850, -0.03, -80), new Vector3(300, 0.12, 1250), materials.water);

  createRoad("mcp-expressway-north", new Vector3(0, 0, 605), 1180, 25);
  createRoad("mcp-expressway-south", new Vector3(0, 0, -500), 1110, 25);
  createRoad("mcp-expressway-west", new Vector3(-585, 0, 55), 1080, 25, Math.PI * 0.5);
  createRoad("mcp-expressway-east", new Vector3(585, 0, 55), 1080, 25, Math.PI * 0.5);
  createRoad("mcp-diagonal-nw", new Vector3(-305, 0, 400), 470, 22, -0.62);
  createRoad("mcp-diagonal-ne", new Vector3(315, 0, 405), 470, 22, 0.62);
  createRoad("mcp-coastal-boulevard", new Vector3(0, 0, -430), 820, 22);

  createBox("mcp-hills-terrace-a", new Vector3(0, 2.2, 515), new Vector3(530, 4.4, 180), materials.hillGrass);
  createBox("mcp-hills-terrace-b", new Vector3(-60, 6.0, 555), new Vector3(370, 7.6, 115), materials.hillGrass);
  createBox("mcp-hills-terrace-c", new Vector3(20, 10.0, 595), new Vector3(250, 8.0, 78), materials.hillGrass);
  createRoad("mcp-hills-ridge-road", new Vector3(0, 0, 525), 390, 16, 0, 12.25);
  createRoad("mcp-hills-access-road", new Vector3(-185, 0, 455), 220, 15, -0.72, 5.8);
  createBox("mcp-vip-mansion-main", new Vector3(40, 18, 575), new Vector3(70, 18, 42), materials.white, true);
  createBox("mcp-vip-mansion-wing-a", new Vector3(0, 16, 575), new Vector3(28, 14, 36), materials.white, true);
  createBox("mcp-vip-mansion-wing-b", new Vector3(80, 16, 575), new Vector3(28, 14, 36), materials.white, true);
  createBox("mcp-vip-pool", new Vector3(40, 12.35, 535), new Vector3(48, 0.30, 18), materials.waterBright);
  addLandmark("VIP Mansion", new Vector3(40, 0, 575));
  for (let i = 0; i < 18; i++) {
    const angle = (Math.PI * 2 * i) / 18;
    const radius = i % 2 === 0 ? 150 : 205;
    createPalm(`mcp-hills-palm-${i}`, Math.cos(angle) * radius, 530 + Math.sin(angle) * 52, 0.82);
  }

  createBox("mcp-old-market-plaza", new Vector3(-390, 0.11, 210), new Vector3(150, 0.20, 92), materials.concrete);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 6; col++) {
      const x = -520 + col * 50;
      const z = 115 + row * 62;
      if (Math.abs(x + 390) < 85 && Math.abs(z - 210) < 56) continue;
      const wall = (row + col) % 2 === 0 ? materials.warmWall : materials.warmWall2;
      createLowRise(`mcp-old-market-building-${row}-${col}`, x, z, 34, 40, 12 + ((row * 5 + col * 3) % 11), wall);
    }
  }
  for (let i = 0; i < 8; i++) {
    createBox(`mcp-market-stall-${i}`, new Vector3(-440 + i * 15, 2.1, 205 + (i % 2) * 18), new Vector3(11, 4.2, 8), i % 2 === 0 ? materials.containerGold : materials.containerRed);
  }
  addLandmark("Market Plaza", new Vector3(-390, 0, 210));

  createBox("mcp-central-plaza", new Vector3(0, 0.115, 165), new Vector3(170, 0.22, 120), materials.concrete);
  createCylinder("mcp-central-fountain-basin", new Vector3(0, 0.65, 165), 32, 1.1, materials.waterBright, 32);
  createCylinder("mcp-central-fountain-core", new Vector3(0, 7.0, 165), 4.8, 13, materials.white, 16);
  const downtownTowers: readonly [number, number, number, number, number, StandardMaterial][] = [
    [-76, 116, 34, 34, 112, materials.glass],
    [-42, 224, 28, 34, 138, materials.glassBlue],
    [42, 224, 30, 32, 126, materials.glass],
    [78, 118, 38, 34, 96, materials.glassBlue],
    [-105, 175, 32, 28, 82, materials.glassCyan],
    [105, 175, 34, 28, 92, materials.glassCyan],
  ];
  for (let i = 0; i < downtownTowers.length; i++) {
    const [x, z, w, d, h, material] = downtownTowers[i];
    createTower(`mcp-downtown-tower-${i}`, x, z, w, d, h, material);
  }
  createTower("mcp-mirage-spire", 0, 285, 38, 38, 175, materials.glassBlue);
  createCylinder("mcp-mirage-spire-needle", new Vector3(0, 185, 285), 2.0, 25, materials.gold, 12);
  addLandmark("Mirage Spire", new Vector3(0, 0, 285));
  addLandmark("Central Civic Plaza", new Vector3(0, 0, 165));

  createBox("mcp-tech-campus", new Vector3(360, 0.12, 185), new Vector3(265, 0.22, 190), materials.concreteDark);
  createCylinder("mcp-tech-pavilion", new Vector3(330, 11, 185), 62, 22, materials.white, 32);
  createCylinder("mcp-tech-pavilion-glass", new Vector3(330, 17, 185), 42, 18, materials.glassCyan, 32);
  createTower("mcp-tech-tower", 420, 230, 36, 36, 118, materials.glassCyan);
  createCylinder("mcp-tech-antenna", new Vector3(420, 128, 230), 1.6, 20, materials.gold, 10);
  createBox("mcp-tech-lab-a", new Vector3(430, 16, 140), new Vector3(70, 32, 48), materials.white);
  createBox("mcp-tech-lab-b", new Vector3(300, 13, 120), new Vector3(64, 26, 42), materials.white);
  for (let i = 0; i < 12; i++) {
    const angle = (Math.PI * 2 * i) / 12;
    createStreetLamp(`mcp-tech-lamp-${i}`, 330 + Math.cos(angle) * 48, 185 + Math.sin(angle) * 48, angle);
  }
  addLandmark("Tech Tower", new Vector3(420, 0, 230));

  createBox("mcp-canal-water-main", new Vector3(-390, 0.09, -155), new Vector3(300, 0.18, 42), materials.waterBright);
  createBox("mcp-canal-water-branch", new Vector3(-455, 0.09, -150), new Vector3(42, 0.18, 285), materials.water);
  for (let i = 0; i < 16; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const index = Math.floor(i / 2);
    const x = -520 + index * 42;
    const z = -155 + side * 54;
    createLowRise(`mcp-canal-home-${i}`, x, z, 27, 32, 10 + (i % 3) * 3, i % 3 === 0 ? materials.white : materials.warmWall2);
  }
  createBridge("mcp-canal-bridge-west", new Vector3(-490, 0, -155), 62, 14, 0);
  createBridge("mcp-canal-bridge-center", new Vector3(-390, 0, -155), 62, 14, 0);
  createBridge("mcp-canal-bridge-east", new Vector3(-285, 0, -155), 62, 14, 0);
  createBridge("mcp-canal-bridge-branch", new Vector3(-455, 0, -60), 64, 14, Math.PI * 0.5);
  for (let i = 0; i < 10; i++) createPalm(`mcp-canal-palm-${i}`, -540 + i * 36, -245 + (i % 2) * 18, 0.78);
  addLandmark("Canal Promenade", new Vector3(-390, 0, -155));

  createBox("mcp-neon-plaza", new Vector3(0, 0.13, -115), new Vector3(255, 0.24, 150), materials.asphaltLight);
  createBox("mcp-neon-casino", new Vector3(42, 24, -105), new Vector3(72, 48, 52), materials.neonViolet, true);
  createBox("mcp-neon-club", new Vector3(-52, 19, -105), new Vector3(60, 38, 48), materials.neonPink, true);
  createBox("mcp-neon-arcade", new Vector3(0, 13, -170), new Vector3(95, 26, 34), materials.neonCyan, true);
  for (let i = 0; i < 12; i++) {
    const x = -110 + i * 20;
    const neonMaterial = i % 3 === 0 ? materials.neonCyan : i % 3 === 1 ? materials.neonPink : materials.neonViolet;
    createBox(`mcp-neon-light-column-${i}`, new Vector3(x, 5.5, -45), new Vector3(0.8, 11, 0.8), neonMaterial);
    createBox(`mcp-neon-light-column-b-${i}`, new Vector3(x, 5.5, -185), new Vector3(0.8, 11, 0.8), neonMaterial);
  }
  addLandmark("Mirage Casino", new Vector3(42, 0, -105));
  addLandmark("Neon Strip", new Vector3(0, 0, -115));

  createBox("mcp-river-channel", new Vector3(0, 0.085, -315), new Vector3(510, 0.17, 62), materials.waterBright);
  createBox("mcp-river-promenade-north", new Vector3(0, 0.13, -270), new Vector3(520, 0.24, 26), materials.concrete);
  createBox("mcp-river-promenade-south", new Vector3(0, 0.13, -360), new Vector3(520, 0.24, 26), materials.concrete);
  createBridge("mcp-river-bridge-west", new Vector3(-160, 0, -315), 96, 18, Math.PI * 0.5);
  createBridge("mcp-river-bridge-central", new Vector3(0, 0, -315), 96, 20, Math.PI * 0.5);
  createBridge("mcp-river-bridge-east", new Vector3(165, 0, -315), 96, 18, Math.PI * 0.5);
  createTower("mcp-riverside-hotel-a", -105, -250, 38, 34, 62, materials.white);
  createTower("mcp-riverside-hotel-b", 112, -250, 38, 34, 68, materials.glassBlue);
  createBox("mcp-riverside-park", new Vector3(0, 0.12, -395), new Vector3(260, 0.22, 52), materials.grass);
  for (let i = 0; i < 14; i++) {
    createPalm(`mcp-river-palm-${i}`, -225 + i * 35, -392 + (i % 2) * 9, 0.74);
  }
  addLandmark("Riverside Park", new Vector3(0, 0, -395));

  createBox("mcp-port-yard", new Vector3(420, 0.11, -170), new Vector3(310, 0.20, 270), materials.industrialDark);
  for (let row = 0; row < 3; row++) {
    createBox(`mcp-warehouse-${row}`, new Vector3(350 + row * 88, 10, -235), new Vector3(72, 20, 52), materials.industrial, true);
  }
  for (let stack = 0; stack < 36; stack++) {
    const col = stack % 9;
    const row = Math.floor(stack / 9);
    const x = 310 + col * 26;
    const z = -115 + row * 18;
    const material = stack % 3 === 0 ? materials.containerBlue : stack % 3 === 1 ? materials.containerRed : materials.containerGold;
    createContainer(`mcp-container-${stack}`, x, stack % 4 === 0 ? 2.8 : 0, z, material, stack % 2 ? Math.PI * 0.5 : 0);
  }
  createBox("mcp-port-water", new Vector3(590, 0.08, -160), new Vector3(150, 0.16, 330), materials.water);
  for (let i = 0; i < 4; i++) {
    const z = -260 + i * 72;
    createBox(`mcp-port-pier-${i}`, new Vector3(545, 0.45, z), new Vector3(120, 0.8, 18), materials.concrete, true);
    createCrane(`mcp-port-crane-${i}`, 520, z, Math.PI * 0.5);
  }
  addLandmark("Port Warehouse", new Vector3(430, 0, -235));
  addLandmark("Industrial Container Yard", new Vector3(410, 0, -120));

  createBox("mcp-beach-sand", new Vector3(0, 0.08, -555), new Vector3(720, 0.16, 190), materials.sand);
  createBox("mcp-marina-water", new Vector3(205, 0.075, -620), new Vector3(330, 0.15, 185), materials.waterBright);
  createBox("mcp-grand-hotel", new Vector3(-65, 31, -555), new Vector3(115, 62, 52), materials.white, true);
  createBox("mcp-grand-hotel-glass", new Vector3(-65, 35, -527), new Vector3(75, 42, 3.0), materials.glassBlue);
  for (let i = 0; i < 5; i++) {
    const x = 100 + i * 48;
    createBox(`mcp-marina-pier-${i}`, new Vector3(x, 0.42, -605), new Vector3(12, 0.70, 125), materials.concrete, true);
    for (let berth = 0; berth < 4; berth++) {
      const boatZ = -650 + berth * 28;
      createBox(`mcp-yacht-${i}-${berth}`, new Vector3(x + (berth % 2 ? 12 : -12), 0.65, boatZ), new Vector3(16, 1.2, 4.2), materials.white, false, berth % 2 ? 0.08 : -0.08);
    }
  }
  for (let i = 0; i < 22; i++) {
    createPalm(`mcp-beach-palm-${i}`, -330 + i * 31, -505 + (i % 3) * 13, 0.90);
  }
  createCylinder("mcp-marina-lighthouse", new Vector3(365, 10, -655), 7, 20, materials.white, 12);
  createBox("mcp-lighthouse-cap", new Vector3(365, 20.7, -655), new Vector3(8, 2.0, 8), materials.containerRed);
  addLandmark("Grand Hotel", new Vector3(-65, 0, -555));
  addLandmark("Mirage Marina", new Vector3(205, 0, -620));

  for (let z = -420; z <= 360; z += 65) {
    createStreetLamp(`mcp-central-lamp-west-${z}`, -17, z, 0);
    createStreetLamp(`mcp-central-lamp-east-${z}`, 17, z, Math.PI);
  }

  return {
    featureCount,
    getDistrictAt(position: Vector3): MirageDistrictName {
      return districtAt(position);
    },
    getNearestLandmark(position: Vector3): string {
      if (landmarks.length === 0) return "City Center";
      let nearest = landmarks[0];
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const landmark of landmarks) {
        const distance = distanceXZ(position, landmark.position);
        if (distance < nearestDistance) {
          nearest = landmark;
          nearestDistance = distance;
        }
      }
      return nearest.name;
    },
  };
}
