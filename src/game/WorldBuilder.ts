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

export type DistrictName =
  | "Downtown"
  | "Old Town"
  | "Neon Quarter"
  | "Industrial Port"
  | "Beachfront"
  | "Hills";

export type WorldContext = {
  shadows: ShadowGenerator;
  getDistrictAt(position: Vector3): DistrictName;
  getNearestLandmark(position: Vector3): string;
};

const CITY_SIZE = 760;
const HALF_CITY = CITY_SIZE / 2;
const ROAD_WIDTH = 20;
const ROAD_POSITIONS = [-300, -225, -150, -75, 0, 75, 150, 225, 300];
const BLOCK_CENTERS = [-337.5, -262.5, -187.5, -112.5, -37.5, 37.5, 112.5, 187.5, 262.5, 337.5];

function districtAt(x: number, z: number): DistrictName {
  if (z < -205) return "Beachfront";
  if (x > 160 && z > 70) return "Industrial Port";
  if (x < -185 && z > 105) return "Hills";
  if (x < -105) return "Old Town";
  if (x > 95 && z < 95) return "Neon Quarter";
  return "Downtown";
}

function hash01(x: number, z: number, salt: number): number {
  const value = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

export function buildWorld(scene: Scene, physics: PhysicsManager): WorldContext {
  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.68;
  hemi.groundColor = new Color3(0.13, 0.15, 0.18);

  const sun = new DirectionalLight("sun", new Vector3(-0.42, -1, -0.28), scene);
  sun.position = new Vector3(180, 260, 140);
  sun.intensity = 1.7;

  const shadows = new ShadowGenerator(2048, sun);
  shadows.usePercentageCloserFiltering = true;

  const makeMaterial = (name: string, color: Color3, specular = 0.08, emissive?: Color3) => {
    const material = new StandardMaterial(name, scene);
    material.diffuseColor = color;
    material.specularColor = new Color3(specular, specular, specular);
    if (emissive) material.emissiveColor = emissive;
    return material;
  };

  const materials = {
    terrain: makeMaterial("terrain", new Color3(0.21, 0.32, 0.22)),
    road: makeMaterial("road", new Color3(0.055, 0.06, 0.072)),
    highway: makeMaterial("highway", new Color3(0.065, 0.07, 0.082)),
    lane: makeMaterial("lane", new Color3(0.95, 0.78, 0.16)),
    laneWhite: makeMaterial("laneWhite", new Color3(0.88, 0.9, 0.92)),
    sidewalk: makeMaterial("sidewalk", new Color3(0.38, 0.40, 0.42)),
    plaza: makeMaterial("plaza", new Color3(0.49, 0.5, 0.48)),
    curb: makeMaterial("curb", new Color3(0.69, 0.7, 0.68)),
    glass: makeMaterial("glass", new Color3(0.12, 0.22, 0.32), 0.28),
    darkGlass: makeMaterial("darkGlass", new Color3(0.07, 0.13, 0.2), 0.3),
    neonPurple: makeMaterial("neonPurple", new Color3(0.31, 0.12, 0.42), 0.18, new Color3(0.18, 0.02, 0.3)),
    neonBlue: makeMaterial("neonBlue", new Color3(0.08, 0.26, 0.42), 0.2, new Color3(0.02, 0.18, 0.34)),
    neonPink: makeMaterial("neonPink", new Color3(0.44, 0.12, 0.28), 0.2, new Color3(0.31, 0.02, 0.18)),
    industrial: makeMaterial("industrial", new Color3(0.33, 0.36, 0.37)),
    rust: makeMaterial("rust", new Color3(0.48, 0.29, 0.18)),
    oldTown: makeMaterial("oldTown", new Color3(0.52, 0.36, 0.28)),
    stucco: makeMaterial("stucco", new Color3(0.65, 0.55, 0.45)),
    beach: makeMaterial("beach", new Color3(0.78, 0.7, 0.52)),
    hills: makeMaterial("hills", new Color3(0.58, 0.62, 0.54)),
    landmark: makeMaterial("landmark", new Color3(0.68, 0.53, 0.17), 0.18),
    water: makeMaterial("water", new Color3(0.045, 0.28, 0.48), 0.3),
    park: makeMaterial("park", new Color3(0.18, 0.44, 0.22)),
    palm: makeMaterial("palm", new Color3(0.18, 0.42, 0.18)),
    trunk: makeMaterial("trunk", new Color3(0.34, 0.21, 0.11)),
    lamp: makeMaterial("lamp", new Color3(0.12, 0.14, 0.17)),
    light: makeMaterial("lightGlow", new Color3(0.95, 0.78, 0.36), 0.05, new Color3(0.95, 0.64, 0.16)),
    concrete: makeMaterial("concrete", new Color3(0.48, 0.49, 0.5)),
    parking: makeMaterial("parking", new Color3(0.11, 0.12, 0.13)),
    red: makeMaterial("redAccent", new Color3(0.52, 0.08, 0.07), 0.1),
    blue: makeMaterial("blueAccent", new Color3(0.08, 0.2, 0.52), 0.12),
  };

  const ground = MeshBuilder.CreateBox("ground", { width: CITY_SIZE, height: 0.4, depth: CITY_SIZE }, scene);
  ground.position.y = -0.2;
  ground.material = materials.terrain;
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

  const createCylinder = (
    name: string,
    position: Vector3,
    diameter: number,
    height: number,
    material: StandardMaterial,
    solid = false,
  ) => {
    const mesh = MeshBuilder.CreateCylinder(name, { diameter, height, tessellation: 12 }, scene);
    mesh.position = position;
    mesh.material = material;
    mesh.receiveShadows = true;
    if (solid) physics.addStaticBox(mesh);
    return mesh;
  };

  const addLaneMarksX = (z: number, minX = -HALF_CITY + 10, maxX = HALF_CITY - 10) => {
    for (let x = minX; x <= maxX; x += 18) {
      createBox(`laneX-${z}-${x}`, new Vector3(x, 0.13, z), new Vector3(7, 0.025, 0.3), materials.laneWhite);
    }
  };

  const addLaneMarksZ = (x: number, minZ = -HALF_CITY + 10, maxZ = HALF_CITY - 10) => {
    for (let z = minZ; z <= maxZ; z += 18) {
      createBox(`laneZ-${x}-${z}`, new Vector3(x, 0.13, z), new Vector3(0.3, 0.025, 7), materials.laneWhite);
    }
  };

  const roadX = (z: number) => {
    createBox(`roadX-${z}`, new Vector3(0, 0.055, z), new Vector3(CITY_SIZE, 0.11, ROAD_WIDTH), materials.road);
    addLaneMarksX(z);
  };

  const roadZ = (x: number) => {
    createBox(`roadZ-${x}`, new Vector3(x, 0.06, 0), new Vector3(ROAD_WIDTH, 0.12, CITY_SIZE), materials.road);
    addLaneMarksZ(x);
  };

  ROAD_POSITIONS.forEach(roadX);
  ROAD_POSITIONS.forEach(roadZ);

  // Wide signature boulevard through downtown.
  createBox("mirage-boulevard", new Vector3(0, 0.07, 38), new Vector3(CITY_SIZE, 0.14, 28), materials.road);
  for (let x = -360; x <= 360; x += 20) {
    createBox(`boulevard-line-${x}`, new Vector3(x, 0.15, 38), new Vector3(9, 0.025, 0.34), materials.lane);
  }

  // Outer loop highway and two elevated flyovers.
  for (const z of [-340, 340]) {
    createBox(`ring-highway-x-${z}`, new Vector3(0, 0.08, z), new Vector3(720, 0.16, 24), materials.highway);
    addLaneMarksX(z, -350, 350);
  }
  for (const x of [-340, 340]) {
    createBox(`ring-highway-z-${x}`, new Vector3(x, 0.08, 0), new Vector3(24, 0.16, 720), materials.highway);
    addLaneMarksZ(x, -350, 350);
  }

  const createFlyover = (name: string, alongX: boolean, center: Vector3) => {
    const length = 230;
    const deckSize = alongX ? new Vector3(length, 0.7, 14) : new Vector3(14, 0.7, length);
    createBox(`${name}-deck`, new Vector3(center.x, 7, center.z), deckSize, materials.highway, false, true);
    for (let i = -90; i <= 90; i += 45) {
      const p = alongX ? new Vector3(center.x + i, 3.4, center.z) : new Vector3(center.x, 3.4, center.z + i);
      createBox(`${name}-pillar-${i}`, p, new Vector3(2.2, 6.8, 2.2), materials.concrete, false);
    }
  };
  createFlyover("downtown-flyover", true, new Vector3(35, 0, 75));
  createFlyover("port-flyover", false, new Vector3(225, 0, 170));

  const facadePalette: Record<DistrictName, Color3[]> = {
    Downtown: [new Color3(0.37, 0.44, 0.52), new Color3(0.5, 0.55, 0.6), new Color3(0.27, 0.34, 0.42)],
    "Old Town": [new Color3(0.58, 0.42, 0.33), new Color3(0.64, 0.53, 0.4), new Color3(0.45, 0.36, 0.3)],
    "Neon Quarter": [new Color3(0.31, 0.25, 0.42), new Color3(0.22, 0.31, 0.44), new Color3(0.42, 0.2, 0.35)],
    "Industrial Port": [new Color3(0.4, 0.42, 0.43), new Color3(0.31, 0.35, 0.37), new Color3(0.48, 0.44, 0.37)],
    Beachfront: [new Color3(0.72, 0.69, 0.61), new Color3(0.56, 0.64, 0.67), new Color3(0.75, 0.57, 0.44)],
    Hills: [new Color3(0.72, 0.7, 0.63), new Color3(0.58, 0.64, 0.58), new Color3(0.67, 0.58, 0.52)],
  };

  const heightRange = (district: DistrictName, r: number) => {
    switch (district) {
      case "Downtown": return 36 + r * 104;
      case "Neon Quarter": return 24 + r * 58;
      case "Industrial Port": return 12 + r * 24;
      case "Beachfront": return 18 + r * 46;
      case "Hills": return 9 + r * 20;
      default: return 12 + r * 34;
    }
  };

  const landmarks = new Map<string, { name: string; height: number; material: StandardMaterial; size?: Vector3 }>([
    ["-37.5,37.5", { name: "Central Bank", height: 42, material: materials.landmark, size: new Vector3(38, 42, 34) }],
    ["37.5,37.5", { name: "Police HQ", height: 38, material: materials.glass, size: new Vector3(42, 38, 34) }],
    ["-37.5,112.5", { name: "Mirage Tower", height: 156, material: materials.darkGlass, size: new Vector3(34, 156, 34) }],
    ["112.5,37.5", { name: "Grand Hotel", height: 72, material: materials.neonPurple, size: new Vector3(42, 72, 34) }],
    ["262.5,187.5", { name: "Port Authority", height: 30, material: materials.industrial, size: new Vector3(46, 30, 38) }],
    ["187.5,-262.5", { name: "Ocean Casino", height: 58, material: materials.neonBlue, size: new Vector3(46, 58, 38) }],
    ["-262.5,262.5", { name: "Hill Mansion", height: 18, material: materials.hills, size: new Vector3(46, 18, 36) }],
    ["-112.5,-37.5", { name: "Old Market", height: 24, material: materials.oldTown, size: new Vector3(46, 24, 38) }],
    ["37.5,-37.5", { name: "City Hospital", height: 44, material: materials.stucco, size: new Vector3(42, 44, 36) }],
    ["112.5,112.5", { name: "Mirage Mall", height: 36, material: materials.glass, size: new Vector3(52, 36, 42) }],
    ["-187.5,-112.5", { name: "Gang Garage", height: 18, material: materials.rust, size: new Vector3(46, 18, 38) }],
  ]);

  const landmarkPositions: { name: string; position: Vector3 }[] = [];

  const addFacadeWindows = (cx: number, cz: number, width: number, depth: number, height: number, district: DistrictName) => {
    const floorCount = Math.min(12, Math.max(2, Math.floor(height / 8)));
    const windowMat = district === "Neon Quarter" ? materials.neonBlue : materials.light;
    for (let floor = 1; floor <= floorCount; floor++) {
      if ((floor + Math.round(cx + cz)) % 3 === 0) continue;
      const y = Math.min(height - 2, 4 + floor * (height / (floorCount + 1)));
      createBox(`window-front-${cx}-${cz}-${floor}`, new Vector3(cx, y, cz + depth / 2 + 0.05), new Vector3(Math.max(4, width * 0.46), 0.45, 0.08), windowMat);
    }
  };

  for (const cx of BLOCK_CENTERS) {
    for (const cz of BLOCK_CENTERS) {
      const district = districtAt(cx, cz);
      createBox(`sidewalk-${cx}-${cz}`, new Vector3(cx, 0.16, cz), new Vector3(52, 0.32, 52), materials.sidewalk);

      const landmark = landmarks.get(`${cx},${cz}`);
      if (landmark) {
        const size = landmark.size ?? new Vector3(34, landmark.height, 34);
        createBox(
          landmark.name,
          new Vector3(cx, landmark.height / 2 + 0.32, cz),
          size,
          landmark.material,
          true,
          true,
        );
        addFacadeWindows(cx, cz, size.x, size.z, landmark.height, district);
        landmarkPositions.push({ name: landmark.name, position: new Vector3(cx, 0, cz) });
        continue;
      }

      // A few open blocks become plazas, parks, parking and alleys so the city breathes.
      const blockRoll = hash01(cx, cz, 90);
      if (district === "Downtown" && blockRoll > 0.88) {
        createBox(`plaza-${cx}-${cz}`, new Vector3(cx, 0.35, cz), new Vector3(44, 0.35, 44), materials.plaza);
        createCylinder(`plaza-fountain-${cx}-${cz}`, new Vector3(cx, 1.1, cz), 8, 1.5, materials.water);
        continue;
      }
      if ((district === "Old Town" || district === "Hills") && blockRoll > 0.86) {
        createBox(`park-${cx}-${cz}`, new Vector3(cx, 0.31, cz), new Vector3(46, 0.28, 46), materials.park);
        for (let i = 0; i < 7; i++) {
          const px = cx - 18 + (i % 4) * 12;
          const pz = cz - 14 + Math.floor(i / 4) * 22;
          createCylinder(`park-tree-trunk-${cx}-${cz}-${i}`, new Vector3(px, 2, pz), 0.55, 4, materials.trunk);
          const crown = MeshBuilder.CreateSphere(`park-tree-${cx}-${cz}-${i}`, { diameter: 4.8 }, scene);
          crown.position = new Vector3(px, 4.7, pz);
          crown.material = materials.park;
        }
        continue;
      }
      if ((district === "Neon Quarter" || district === "Industrial Port") && blockRoll > 0.84) {
        createBox(`parking-${cx}-${cz}`, new Vector3(cx, 0.17, cz), new Vector3(48, 0.16, 48), materials.parking);
        for (let i = -18; i <= 18; i += 9) {
          createBox(`parking-line-${cx}-${cz}-${i}`, new Vector3(cx + i, 0.27, cz), new Vector3(0.18, 0.02, 38), materials.laneWhite);
        }
        continue;
      }

      const count = district === "Hills" ? 2 : district === "Industrial Port" ? 3 : 4;
      for (let i = 0; i < count; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const px = cx + (col === 0 ? -13 : 13) + (hash01(cx, cz, i + 2) - 0.5) * 3;
        const pz = cz + (row === 0 ? -13 : 13) + (hash01(cx, cz, i + 7) - 0.5) * 3;
        const width = 18 + hash01(cx, cz, i + 11) * 8;
        const depth = 18 + hash01(cx, cz, i + 17) * 8;
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
          height > 22,
        );
        addFacadeWindows(px, pz, width, depth, height, district);
      }
    }
  }

  // Old Town alley network and market stalls.
  for (let z = -165; z <= 135; z += 75) {
    createBox(`old-alley-${z}`, new Vector3(-150, 0.19, z + 18), new Vector3(150, 0.13, 7), materials.parking);
  }
  for (let i = 0; i < 10; i++) {
    const x = -132 + (i % 5) * 10;
    const z = -58 + Math.floor(i / 5) * 16;
    createBox(`market-stall-${i}`, new Vector3(x, 1.5, z), new Vector3(7, 3, 5), i % 2 ? materials.red : materials.blue, false);
  }

  // Neon strip signs.
  const neonMats = [materials.neonPurple, materials.neonBlue, materials.neonPink];
  for (let i = 0; i < 12; i++) {
    const x = 105 + (i % 4) * 48;
    const z = -120 + Math.floor(i / 4) * 70;
    createBox(`neon-sign-${i}`, new Vector3(x, 8 + (i % 3) * 3, z), new Vector3(10, 3, 0.6), neonMats[i % neonMats.length], false);
  }

  // Port container yards and cranes.
  const containerMats = [materials.red, materials.blue, materials.rust, materials.industrial];
  for (let i = 0; i < 24; i++) {
    const x = 190 + (i % 6) * 22;
    const z = 120 + Math.floor(i / 6) * 16;
    createBox(`container-${i}`, new Vector3(x, 1.55, z), new Vector3(12, 3, 5), containerMats[i % containerMats.length], true);
  }
  for (let i = 0; i < 3; i++) {
    const x = 225 + i * 50;
    const z = 305;
    createBox(`crane-leg-a-${i}`, new Vector3(x - 8, 10, z), new Vector3(2, 20, 2), materials.rust);
    createBox(`crane-leg-b-${i}`, new Vector3(x + 8, 10, z), new Vector3(2, 20, 2), materials.rust);
    createBox(`crane-top-${i}`, new Vector3(x, 20, z), new Vector3(28, 2, 2), materials.rust);
    createBox(`crane-boom-${i}`, new Vector3(x - 10, 22, z - 18), new Vector3(2, 2, 36), materials.rust);
  }

  // Beach, marina and promenade.
  createBox("ocean", new Vector3(0, -0.06, -373), new Vector3(730, 0.12, 28), materials.water);
  createBox("beach-sand", new Vector3(0, 0.12, -348), new Vector3(730, 0.24, 26), materials.beach);
  for (let x = -330; x <= 330; x += 32) {
    createCylinder(`palm-trunk-${x}`, new Vector3(x, 2.3, -330), 0.6, 4.6, materials.trunk);
    const crown = MeshBuilder.CreateSphere(`palm-crown-${x}`, { diameter: 4.2 }, scene);
    crown.position = new Vector3(x, 5, -330);
    crown.scaling.y = 0.6;
    crown.material = materials.palm;
  }
  for (let x = -300; x <= 300; x += 60) {
    createBox(`pier-${x}`, new Vector3(x, 0.22, -362), new Vector3(8, 0.35, 26), materials.concrete);
  }

  // Hills district mansion driveways and retaining walls.
  for (let i = 0; i < 5; i++) {
    const x = -320 + i * 28;
    createBox(`hill-wall-${i}`, new Vector3(x, 2, 245 + i * 12), new Vector3(30, 4, 2.5), materials.concrete);
  }

  // Street lights around major roads.
  let lampId = 0;
  for (const z of ROAD_POSITIONS) {
    for (let x = -330; x <= 330; x += 55) {
      const post = new Vector3(x, 2.6, z + ROAD_WIDTH / 2 + 3);
      createBox(`lamp-post-${lampId}`, post, new Vector3(0.22, 5.2, 0.22), materials.lamp);
      createBox(`lamp-glow-${lampId}`, new Vector3(post.x, 5.2, post.z), new Vector3(0.9, 0.24, 0.9), materials.light);
      lampId++;
    }
  }

  // Gas stations and service locations.
  const servicePoints = [
    new Vector3(-225, 0, -225),
    new Vector3(225, 0, -75),
    new Vector3(300, 0, 75),
  ];
  servicePoints.forEach((p, i) => {
    createBox(`gas-canopy-${i}`, new Vector3(p.x, 4, p.z), new Vector3(24, 1, 16), materials.red);
    for (const dx of [-7, 7]) {
      createBox(`gas-pump-${i}-${dx}`, new Vector3(p.x + dx, 1.2, p.z), new Vector3(1.2, 2.4, 1.2), materials.concrete);
    }
    landmarkPositions.push({ name: `Gas Station ${i + 1}`, position: p.clone() });
  });

  // Mission-friendly open spaces.
  const missionSpaces = [
    { name: "Bank Heist Plaza", p: new Vector3(-37.5, 0, 5) },
    { name: "Police Pursuit Start", p: new Vector3(37.5, 0, 5) },
    { name: "Gang Territory", p: new Vector3(-185, 0, -120) },
    { name: "Street Race Start", p: new Vector3(145, 0, -205) },
    { name: "Port Smuggling Zone", p: new Vector3(275, 0, 245) },
    { name: "Mansion Job", p: new Vector3(-270, 0, 285) },
  ];
  missionSpaces.forEach(({ name, p }, i) => {
    const ring = MeshBuilder.CreateTorus(`mission-zone-${i}`, { diameter: 8, thickness: 0.35, tessellation: 24 }, scene);
    ring.position = new Vector3(p.x, 0.35, p.z);
    ring.rotation.x = Math.PI / 2;
    ring.material = i % 2 ? materials.neonBlue : materials.landmark;
    landmarkPositions.push({ name, position: p });
  });

  // City perimeter walls keep the player inside authored space.
  createBox("north-boundary", new Vector3(0, 2, HALF_CITY - 1), new Vector3(CITY_SIZE, 4, 2), materials.curb, true);
  createBox("south-boundary", new Vector3(0, 2, -HALF_CITY + 1), new Vector3(CITY_SIZE, 4, 2), materials.curb, true);
  createBox("east-boundary", new Vector3(HALF_CITY - 1, 2, 0), new Vector3(2, 4, CITY_SIZE), materials.curb, true);
  createBox("west-boundary", new Vector3(-HALF_CITY + 1, 2, 0), new Vector3(2, 4, CITY_SIZE), materials.curb, true);

  return {
    shadows,
    getDistrictAt: (position: Vector3) => districtAt(position.x, position.z),
    getNearestLandmark: (position: Vector3) => {
      let bestName = "City Streets";
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const landmark of landmarkPositions) {
        const dx = landmark.position.x - position.x;
        const dz = landmark.position.z - position.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < bestDistance) {
          bestDistance = d2;
          bestName = landmark.name;
        }
      }
      return bestName;
    },
  };
}
