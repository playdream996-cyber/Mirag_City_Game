import {
  Color3,
  DirectionalLight,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import { PhysicsManager } from "./PhysicsManager";

export type TokyoBangkokDistrict =
  | "Hills / VIP District"
  | "Old Market"
  | "Central Downtown"
  | "Tech / Port"
  | "Neon Quarter"
  | "Canal Town"
  | "Riverside"
  | "Industrial Docks"
  | "Beach / Marina";

export type TokyoBangkokWorldContext = {
  shadows: ShadowGenerator;
  getDistrictAt(position: Vector3): TokyoBangkokDistrict;
  getNearestLandmark(position: Vector3): string;
};

type Landmark = { name: string; position: Vector3 };

const CITY_SIZE = 1500;
const ROAD_Y = 0.07;
const WATER_Y = 0.03;

const landmarkPositions: Landmark[] = [
  { name: "Hill Mansion", position: new Vector3(-60, 0, 520) },
  { name: "Market Plaza", position: new Vector3(-360, 0, 230) },
  { name: "Central Bank", position: new Vector3(-55, 0, 170) },
  { name: "Police HQ", position: new Vector3(70, 0, 155) },
  { name: "Tech Tower", position: new Vector3(330, 0, 220) },
  { name: "Casino", position: new Vector3(115, 0, -40) },
  { name: "Player Garage", position: new Vector3(30, 0, -30) },
  { name: "Riverside Promenade", position: new Vector3(0, 0, -245) },
  { name: "Port Warehouse", position: new Vector3(360, 0, -260) },
  { name: "Grand Hotel", position: new Vector3(-20, 0, -500) },
];

function districtAt(position: Vector3): TokyoBangkokDistrict {
  const { x, z } = position;

  if (z <= -410) return "Beach / Marina";
  if (x >= 220 && z < 20) return "Industrial Docks";
  if (x <= -220 && z < 20) return "Canal Town";
  if (z < 20) return "Riverside";

  if (z >= 400) return "Hills / VIP District";
  if (x <= -220) return "Old Market";
  if (x >= 220) return "Tech / Port";
  if (z < 115 && x > 20) return "Neon Quarter";
  return "Central Downtown";
}

function makeMaterial(scene: Scene, name: string, color: Color3, specular = 0.05): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  material.specularColor = new Color3(specular, specular, specular);
  return material;
}

function createBox(
  scene: Scene,
  physics: PhysicsManager,
  name: string,
  position: Vector3,
  size: Vector3,
  material: StandardMaterial,
  solid = false,
): Mesh {
  const mesh = MeshBuilder.CreateBox(name, { width: size.x, height: size.y, depth: size.z }, scene);
  mesh.position = position;
  mesh.material = material;
  mesh.receiveShadows = true;
  if (solid) physics.addStaticBox(mesh);
  return mesh;
}

function addRoadX(
  scene: Scene,
  physics: PhysicsManager,
  material: StandardMaterial,
  laneMaterial: StandardMaterial,
  z: number,
  xCenter: number,
  length: number,
  width: number,
): void {
  createBox(scene, physics, `road-x-${z}-${xCenter}`, new Vector3(xCenter, ROAD_Y, z), new Vector3(length, 0.14, width), material);
  const start = xCenter - length / 2 + 12;
  const end = xCenter + length / 2 - 12;
  for (let x = start; x <= end; x += 24) {
    createBox(scene, physics, `lane-x-${z}-${x}`, new Vector3(x, ROAD_Y + 0.09, z), new Vector3(8, 0.02, 0.28), laneMaterial);
  }
}

function addRoadZ(
  scene: Scene,
  physics: PhysicsManager,
  material: StandardMaterial,
  laneMaterial: StandardMaterial,
  x: number,
  zCenter: number,
  length: number,
  width: number,
): void {
  createBox(scene, physics, `road-z-${x}-${zCenter}`, new Vector3(x, ROAD_Y, zCenter), new Vector3(width, 0.14, length), material);
  const start = zCenter - length / 2 + 12;
  const end = zCenter + length / 2 - 12;
  for (let z = start; z <= end; z += 24) {
    createBox(scene, physics, `lane-z-${x}-${z}`, new Vector3(x, ROAD_Y + 0.09, z), new Vector3(0.28, 0.02, 8), laneMaterial);
  }
}

function addBridge(
  scene: Scene,
  physics: PhysicsManager,
  name: string,
  position: Vector3,
  size: Vector3,
  roadMaterial: StandardMaterial,
  concreteMaterial: StandardMaterial,
): void {
  createBox(scene, physics, `${name}-deck`, position, size, roadMaterial, true);
  const alongX = size.x > size.z;
  for (const offset of [-0.34, 0.34]) {
    const support = alongX
      ? new Vector3(position.x + size.x * offset, 1.7, position.z)
      : new Vector3(position.x, 1.7, position.z + size.z * offset);
    createBox(scene, physics, `${name}-support-${offset}`, support, new Vector3(2.2, 3.4, 2.2), concreteMaterial);
  }
}

function createLandmarkPad(
  scene: Scene,
  physics: PhysicsManager,
  name: string,
  position: Vector3,
  size: Vector3,
  material: StandardMaterial,
): void {
  createBox(scene, physics, `landmark-pad-${name}`, new Vector3(position.x, 0.12, position.z), new Vector3(size.x, 0.22, size.z), material);
}

export function buildTokyoBangkokMap(scene: Scene, physics: PhysicsManager): TokyoBangkokWorldContext {
  const hemi = new HemisphericLight("map-hemi", new Vector3(0.15, 1, 0.1), scene);
  hemi.intensity = 0.78;
  hemi.diffuse = new Color3(0.78, 0.86, 1.0);
  hemi.groundColor = new Color3(0.16, 0.16, 0.18);

  const sun = new DirectionalLight("map-sun", new Vector3(-0.35, -1, 0.22), scene);
  sun.position = new Vector3(220, 300, -160);
  sun.intensity = 1.65;
  sun.diffuse = new Color3(1.0, 0.86, 0.68);

  const shadows = new ShadowGenerator(1024, sun);
  shadows.usePercentageCloserFiltering = true;

  const groundMat = makeMaterial(scene, "map-ground", new Color3(0.19, 0.24, 0.20));
  const roadMat = makeMaterial(scene, "map-road", new Color3(0.045, 0.05, 0.06));
  const expressMat = makeMaterial(scene, "map-expressway", new Color3(0.06, 0.065, 0.075));
  const laneMat = makeMaterial(scene, "map-lane", new Color3(0.90, 0.90, 0.88));
  const concreteMat = makeMaterial(scene, "map-concrete", new Color3(0.42, 0.44, 0.46));
  const waterMat = makeMaterial(scene, "map-water", new Color3(0.025, 0.24, 0.38), 0.20);
  waterMat.alpha = 0.92;
  const sandMat = makeMaterial(scene, "map-sand", new Color3(0.70, 0.61, 0.43));
  const hillMat = makeMaterial(scene, "map-hills", new Color3(0.20, 0.31, 0.21));
  const plazaMat = makeMaterial(scene, "map-plaza", new Color3(0.44, 0.45, 0.44));

  const ground = createBox(scene, physics, "tokyo-bangkok-ground", new Vector3(0, -0.2, 0), new Vector3(CITY_SIZE, 0.4, CITY_SIZE), groundMat, true);
  ground.receiveShadows = true;

  createBox(scene, physics, "south-sea", new Vector3(0, WATER_Y, -650), new Vector3(CITY_SIZE, 0.08, 220), waterMat);
  createBox(scene, physics, "beachfront-strip", new Vector3(-90, 0.05, -520), new Vector3(850, 0.12, 95), sandMat);
  createBox(scene, physics, "marina-basin", new Vector3(315, WATER_Y, -515), new Vector3(310, 0.08, 125), waterMat);

  createBox(scene, physics, "river-south", new Vector3(0, WATER_Y, -260), new Vector3(92, 0.08, 330), waterMat);
  createBox(scene, physics, "river-north", new Vector3(-20, WATER_Y, -30), new Vector3(60, 0.08, 150), waterMat);

  for (const z of [-225, -165, -105]) {
    createBox(scene, physics, `canal-west-${z}`, new Vector3(-300, WATER_Y, z), new Vector3(360, 0.08, 22), waterMat);
  }

  addRoadX(scene, physics, roadMat, laneMat, 165, 0, 1180, 34);
  addRoadZ(scene, physics, roadMat, laneMat, 0, 170, 780, 34);
  addRoadZ(scene, physics, roadMat, laneMat, -185, 150, 760, 24);
  addRoadZ(scene, physics, roadMat, laneMat, 190, 140, 800, 24);

  for (const z of [315, 245, 95, 35]) {
    addRoadX(scene, physics, roadMat, laneMat, z, 0, 1100, 22);
  }
  for (const z of [-55, -125, -195, -335]) {
    addRoadX(scene, physics, roadMat, laneMat, z, 260, 580, 22);
    addRoadX(scene, physics, roadMat, laneMat, z, -300, 500, 22);
  }

  addRoadX(scene, physics, roadMat, laneMat, -455, -70, 980, 28);

  addRoadX(scene, physics, expressMat, laneMat, 395, 0, 1200, 28);
  addRoadZ(scene, physics, expressMat, laneMat, -520, 35, 720, 28);
  addRoadZ(scene, physics, expressMat, laneMat, 520, 20, 750, 28);

  createBox(scene, physics, "elevated-east-west", new Vector3(150, 8.0, 285), new Vector3(680, 0.8, 16), expressMat, true);
  for (let x = -140; x <= 440; x += 72) {
    createBox(scene, physics, `elevated-pillar-${x}`, new Vector3(x, 3.8, 285), new Vector3(2.6, 7.6, 2.6), concreteMat);
  }

  for (const z of [-225, -165, -105]) {
    addBridge(scene, physics, `canal-bridge-a-${z}`, new Vector3(-365, 0.68, z), new Vector3(24, 1.0, 36), roadMat, concreteMat);
    addBridge(scene, physics, `canal-bridge-b-${z}`, new Vector3(-235, 0.68, z), new Vector3(24, 1.0, 36), roadMat, concreteMat);
  }
  addBridge(scene, physics, "river-bridge-central", new Vector3(0, 0.74, -55), new Vector3(130, 1.1, 28), roadMat, concreteMat);
  addBridge(scene, physics, "river-bridge-riverside", new Vector3(0, 0.74, -195), new Vector3(132, 1.1, 28), roadMat, concreteMat);
  addBridge(scene, physics, "river-bridge-coastal", new Vector3(0, 0.74, -455), new Vector3(136, 1.1, 30), roadMat, concreteMat);

  for (let i = 0; i < 5; i++) {
    createBox(
      scene,
      physics,
      `vip-hill-step-${i}`,
      new Vector3(-40 + i * 14, 0.5 + i * 0.8, 455 + i * 44),
      new Vector3(470 - i * 52, 1.0 + i * 0.25, 52),
      hillMat,
      true,
    );
  }

  createLandmarkPad(scene, physics, "hill-mansion", landmarkPositions[0].position, new Vector3(90, 0, 70), plazaMat);
  createLandmarkPad(scene, physics, "market-plaza", landmarkPositions[1].position, new Vector3(95, 0, 75), plazaMat);
  createLandmarkPad(scene, physics, "central-bank", landmarkPositions[2].position, new Vector3(70, 0, 60), plazaMat);
  createLandmarkPad(scene, physics, "police-hq", landmarkPositions[3].position, new Vector3(78, 0, 64), plazaMat);
  createLandmarkPad(scene, physics, "tech-tower", landmarkPositions[4].position, new Vector3(86, 0, 72), plazaMat);
  createLandmarkPad(scene, physics, "casino", landmarkPositions[5].position, new Vector3(78, 0, 64), plazaMat);
  createLandmarkPad(scene, physics, "player-garage", landmarkPositions[6].position, new Vector3(54, 0, 48), plazaMat);
  createLandmarkPad(scene, physics, "port-warehouse", landmarkPositions[8].position, new Vector3(120, 0, 90), plazaMat);
  createLandmarkPad(scene, physics, "grand-hotel", landmarkPositions[9].position, new Vector3(110, 0, 80), plazaMat);

  for (const x of [245, 295, 345, 395]) {
    createBox(scene, physics, `marina-pier-${x}`, new Vector3(x, 0.35, -540), new Vector3(8, 0.6, 95), concreteMat, true);
  }

  const getNearestLandmark = (position: Vector3): string => {
    let best: Landmark = landmarkPositions[0];
    let bestDistance = Vector3.DistanceSquared(position, best.position);
    for (const landmark of landmarkPositions.slice(1)) {
      const distance = Vector3.DistanceSquared(position, landmark.position);
      if (distance < bestDistance) {
        best = landmark;
        bestDistance = distance;
      }
    }
    return best.name;
  };

  return {
    shadows,
    getDistrictAt: districtAt,
    getNearestLandmark,
  };
}
