import {
  Color3,
  DirectionalLight,
  HemisphericLight,
  MeshBuilder,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import { PhysicsManager } from "./PhysicsManager";

export type DistrictName = "Downtown" | "Old Town" | "Neon Quarter" | "Industrial Port" | "Beachfront" | "Hills";

export type WorldContext = {
  shadows: ShadowGenerator;
  getDistrictAt(position: Vector3): DistrictName;
};

const CITY_SIZE = 560;
const ROAD_WIDTH = 18;
const ROAD_POSITIONS = [-210, -140, -70, 0, 70, 140, 210];
const BLOCK_CENTERS = [-245, -175, -105, -35, 35, 105, 175, 245];

function districtAt(x: number, z: number): DistrictName {
  if (z < -150) return "Beachfront";
  if (x > 120 && z > 35) return "Industrial Port";
  if (x < -125 && z > 80) return "Hills";
  if (x < -75) return "Old Town";
  if (x > 45 && z < 65) return "Neon Quarter";
  return "Downtown";
}

function hash01(x: number, z: number, salt: number): number {
  const value = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

export function buildWorld(scene: Scene, physics: PhysicsManager): WorldContext {
  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.72;
  hemi.groundColor = new Color3(0.18, 0.2, 0.25);

  const sun = new DirectionalLight("sun", new Vector3(-0.45, -1, -0.3), scene);
  sun.position = new Vector3(120, 180, 100);
  sun.intensity = 1.65;

  const shadows = new ShadowGenerator(2048, sun);
  shadows.usePercentageCloserFiltering = true;

  const makeMaterial = (name: string, color: Color3, specular = 0.08) => {
    const material = new StandardMaterial(name, scene);
    material.diffuseColor = color;
    material.specularColor = new Color3(specular, specular, specular);
    return material;
  };

  const materials = {
    ground: makeMaterial("cityGround", new Color3(0.24, 0.38, 0.25)),
    road: makeMaterial("road", new Color3(0.075, 0.082, 0.095)),
    lane: makeMaterial("lane", new Color3(0.92, 0.76, 0.18)),
    sidewalk: makeMaterial("sidewalk", new Color3(0.43, 0.45, 0.46)),
    curb: makeMaterial("curb", new Color3(0.7, 0.7, 0.68)),
    glass: makeMaterial("glass", new Color3(0.16, 0.29, 0.4), 0.22),
    neon: makeMaterial("neon", new Color3(0.58, 0.16, 0.72), 0.18),
    industrial: makeMaterial("industrial", new Color3(0.36, 0.39, 0.4)),
    oldTown: makeMaterial("oldTown", new Color3(0.55, 0.4, 0.31)),
    beach: makeMaterial("beach", new Color3(0.72, 0.66, 0.5)),
    hills: makeMaterial("hills", new Color3(0.62, 0.66, 0.58)),
    landmark: makeMaterial("landmark", new Color3(0.72, 0.58, 0.2), 0.16),
    water: makeMaterial("water", new Color3(0.08, 0.35, 0.56), 0.25),
    palm: makeMaterial("palm", new Color3(0.2, 0.46, 0.2)),
    trunk: makeMaterial("trunk", new Color3(0.36, 0.22, 0.12)),
    lamp: makeMaterial("lamp", new Color3(0.16, 0.18, 0.2)),
  };

  const ground = MeshBuilder.CreateBox("ground", { width: CITY_SIZE, height: 0.4, depth: CITY_SIZE }, scene);
  ground.position.y = -0.2;
  ground.material = materials.ground;
  ground.receiveShadows = true;
  physics.addStaticBox(ground);

  const createBox = (
    name: string,
    position: Vector3,
    size: Vector3,
    material: StandardMaterial,
    solid = false,
    castShadow = false,
  ) => {
    const box = MeshBuilder.CreateBox(name, { width: size.x, height: size.y, depth: size.z }, scene);
    box.position = position;
    box.material = material;
    box.receiveShadows = true;
    if (castShadow) shadows.addShadowCaster(box);
    if (solid) physics.addStaticBox(box);
    return box;
  };

  const roadX = (z: number) => {
    createBox(`roadX-${z}`, new Vector3(0, 0.055, z), new Vector3(CITY_SIZE, 0.11, ROAD_WIDTH), materials.road, false);
    for (let x = -270; x <= 270; x += 15) {
      createBox(`laneX-${z}-${x}`, new Vector3(x, 0.125, z), new Vector3(6, 0.025, 0.28), materials.lane);
    }
  };

  const roadZ = (x: number) => {
    createBox(`roadZ-${x}`, new Vector3(x, 0.06, 0), new Vector3(ROAD_WIDTH, 0.12, CITY_SIZE), materials.road, false);
    for (let z = -270; z <= 270; z += 15) {
      createBox(`laneZ-${x}-${z}`, new Vector3(x, 0.13, z), new Vector3(0.28, 0.025, 6), materials.lane);
    }
  };

  ROAD_POSITIONS.forEach(roadX);
  ROAD_POSITIONS.forEach(roadZ);

  const facadePalette: Record<DistrictName, Color3[]> = {
    Downtown: [new Color3(0.42, 0.5, 0.58), new Color3(0.56, 0.61, 0.66), new Color3(0.32, 0.39, 0.46)],
    "Old Town": [new Color3(0.58, 0.42, 0.33), new Color3(0.64, 0.53, 0.4), new Color3(0.45, 0.36, 0.3)],
    "Neon Quarter": [new Color3(0.34, 0.28, 0.46), new Color3(0.25, 0.34, 0.46), new Color3(0.42, 0.24, 0.37)],
    "Industrial Port": [new Color3(0.42, 0.44, 0.45), new Color3(0.34, 0.38, 0.4), new Color3(0.5, 0.46, 0.39)],
    Beachfront: [new Color3(0.7, 0.67, 0.58), new Color3(0.58, 0.65, 0.67), new Color3(0.75, 0.58, 0.45)],
    Hills: [new Color3(0.7, 0.69, 0.62), new Color3(0.58, 0.63, 0.58), new Color3(0.66, 0.58, 0.52)],
  };

  const heightRange = (district: DistrictName, r: number) => {
    switch (district) {
      case "Downtown": return 28 + r * 72;
      case "Neon Quarter": return 20 + r * 42;
      case "Industrial Port": return 10 + r * 18;
      case "Beachfront": return 12 + r * 32;
      case "Hills": return 8 + r * 18;
      default: return 10 + r * 30;
    }
  };

  const landmarkBlocks = new Map<string, { name: string; height: number; material: StandardMaterial }>([
    ["-35,35", { name: "Central Bank", height: 38, material: materials.landmark }],
    ["35,35", { name: "Police HQ", height: 34, material: materials.glass }],
    ["-35,105", { name: "Mirage Tower", height: 112, material: materials.glass }],
    ["105,35", { name: "Grand Hotel", height: 58, material: materials.neon }],
    ["175,105", { name: "Port Warehouse", height: 24, material: materials.industrial }],
    ["105,-175", { name: "Ocean Casino", height: 46, material: materials.neon }],
    ["-175,175", { name: "Hill Mansion", height: 16, material: materials.hills }],
    ["-105,-35", { name: "Old Market", height: 22, material: materials.oldTown }],
  ]);

  for (const cx of BLOCK_CENTERS) {
    for (const cz of BLOCK_CENTERS) {
      const district = districtAt(cx, cz);
      createBox(`sidewalk-${cx}-${cz}`, new Vector3(cx, 0.16, cz), new Vector3(50, 0.32, 50), materials.sidewalk, false);

      const landmark = landmarkBlocks.get(`${cx},${cz}`);
      if (landmark) {
        createBox(
          landmark.name,
          new Vector3(cx, landmark.height / 2 + 0.32, cz),
          new Vector3(30, landmark.height, 30),
          landmark.material,
          true,
          true,
        );
        continue;
      }

      const count = district === "Hills" ? 2 : district === "Industrial Port" ? 3 : 4;
      for (let i = 0; i < count; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const px = cx + (col === 0 ? -12.5 : 12.5) + (hash01(cx, cz, i + 2) - 0.5) * 3;
        const pz = cz + (row === 0 ? -12.5 : 12.5) + (hash01(cx, cz, i + 7) - 0.5) * 3;
        const width = 17 + hash01(cx, cz, i + 11) * 7;
        const depth = 17 + hash01(cx, cz, i + 17) * 7;
        const height = heightRange(district, hash01(cx, cz, i + 23));
        const palette = facadePalette[district];
        const color = palette[Math.floor(hash01(cx, cz, i + 31) * palette.length)];
        const material = makeMaterial(`facade-${cx}-${cz}-${i}`, color);
        createBox(
          `building-${district}-${cx}-${cz}-${i}`,
          new Vector3(px, height / 2 + 0.32, pz),
          new Vector3(width, height, depth),
          material,
          true,
          height > 18,
        );
      }
    }
  }

  // Coastal strip and marina water outside the beachfront road.
  createBox("marina-water", new Vector3(0, -0.05, -272), new Vector3(520, 0.12, 16), materials.water, false);
  for (let x = -240; x <= 240; x += 32) {
    createBox(`promenade-${x}`, new Vector3(x, 0.2, -248), new Vector3(12, 0.4, 8), materials.beach, false);
  }

  // Street props: sparse lamps along major boulevards and palms near the coast.
  for (let x = -245; x <= 245; x += 35) {
    for (const z of [-218, 218]) {
      createBox(`lamp-post-${x}-${z}`, new Vector3(x, 2.2, z), new Vector3(0.22, 4.4, 0.22), materials.lamp, false);
    }
  }

  for (let x = -245; x <= 245; x += 28) {
    const z = -238;
    createBox(`palm-trunk-${x}`, new Vector3(x, 2.1, z), new Vector3(0.45, 4.2, 0.45), materials.trunk, false);
    const crown = MeshBuilder.CreateSphere(`palm-crown-${x}`, { diameter: 3.6 }, scene);
    crown.position = new Vector3(x, 4.5, z);
    crown.scaling.y = 0.55;
    crown.material = materials.palm;
  }

  // Outer ring barriers keep prototype driving/player tests inside the authored city.
  createBox("north-boundary", new Vector3(0, 2, 279), new Vector3(CITY_SIZE, 4, 2), materials.curb, true);
  createBox("south-boundary", new Vector3(0, 2, -279), new Vector3(CITY_SIZE, 4, 2), materials.curb, true);
  createBox("east-boundary", new Vector3(279, 2, 0), new Vector3(2, 4, CITY_SIZE), materials.curb, true);
  createBox("west-boundary", new Vector3(-279, 2, 0), new Vector3(2, 4, CITY_SIZE), materials.curb, true);

  return {
    shadows,
    getDistrictAt: (position: Vector3) => districtAt(position.x, position.z),
  };
}
