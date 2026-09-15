import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import { PhysicsManager } from "./PhysicsManager";

function makeMaterial(scene: Scene, name: string, diffuse: Color3, emissive?: Color3): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = diffuse;
  material.specularColor = new Color3(0.06, 0.06, 0.06);
  if (emissive) material.emissiveColor = emissive;
  return material;
}

export function buildMirageCityDensePass(scene: Scene, physics: PhysicsManager): number {
  let count = 0;

  const mats = {
    asphalt: makeMaterial(scene, "dense-asphalt", new Color3(0.032, 0.036, 0.045)),
    lane: makeMaterial(scene, "dense-lane", new Color3(0.91, 0.91, 0.86)),
    concrete: makeMaterial(scene, "dense-concrete", new Color3(0.48, 0.49, 0.50)),
    concreteDark: makeMaterial(scene, "dense-concrete-dark", new Color3(0.22, 0.24, 0.26)),
    wall: makeMaterial(scene, "dense-wall", new Color3(0.67, 0.66, 0.62)),
    glass: makeMaterial(scene, "dense-glass", new Color3(0.09, 0.22, 0.31)),
    medical: makeMaterial(scene, "dense-medical", new Color3(0.76, 0.80, 0.78)),
    police: makeMaterial(scene, "dense-police", new Color3(0.22, 0.34, 0.48)),
    red: makeMaterial(scene, "dense-red", new Color3(0.66, 0.08, 0.06)),
    blue: makeMaterial(scene, "dense-blue", new Color3(0.06, 0.18, 0.48)),
    green: makeMaterial(scene, "dense-green", new Color3(0.10, 0.34, 0.16)),
    sand: makeMaterial(scene, "dense-sand", new Color3(0.76, 0.66, 0.44)),
    metal: makeMaterial(scene, "dense-metal", new Color3(0.18, 0.20, 0.22)),
    fuel: makeMaterial(scene, "dense-fuel", new Color3(0.95, 0.68, 0.08), new Color3(0.08, 0.04, 0.0)),
    cyan: makeMaterial(scene, "dense-cyan", new Color3(0.02, 0.12, 0.18), new Color3(0.00, 0.72, 0.95)),
    pink: makeMaterial(scene, "dense-pink", new Color3(0.20, 0.02, 0.12), new Color3(0.92, 0.02, 0.52)),
    whiteGlow: makeMaterial(scene, "dense-white-glow", new Color3(0.58, 0.60, 0.62), new Color3(0.42, 0.42, 0.36)),
  };

  const box = (
    name: string,
    position: Vector3,
    size: Vector3,
    material: StandardMaterial,
    solid = false,
    rotationY = 0,
  ): Mesh => {
    const mesh = MeshBuilder.CreateBox(name, { width: size.x, height: size.y, depth: size.z }, scene);
    mesh.position.copyFrom(position);
    mesh.rotation.y = rotationY;
    mesh.material = material;
    mesh.receiveShadows = true;
    if (solid) physics.addStaticBox(mesh);
    count++;
    return mesh;
  };

  const cylinder = (
    name: string,
    position: Vector3,
    diameter: number,
    height: number,
    material: StandardMaterial,
    tessellation = 16,
  ): Mesh => {
    const mesh = MeshBuilder.CreateCylinder(name, { diameter, height, tessellation }, scene);
    mesh.position.copyFrom(position);
    mesh.material = material;
    mesh.receiveShadows = true;
    count++;
    return mesh;
  };

  const roadSegment = (name: string, a: Vector3, b: Vector3, width: number, y = 0.17): void => {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    const yaw = Math.atan2(-dz, dx);
    const center = new Vector3((a.x + b.x) * 0.5, y, (a.z + b.z) * 0.5);
    box(name, center, new Vector3(length, 0.20, width), mats.asphalt, false, yaw);
    for (let offset = -length * 0.42; offset <= length * 0.42; offset += 20) {
      const localX = Math.cos(yaw) * offset;
      const localZ = -Math.sin(yaw) * offset;
      box(`${name}-mark-${Math.round(offset)}`, new Vector3(center.x + localX, y + 0.115, center.z + localZ), new Vector3(8, 0.018, 0.28), mats.lane, false, yaw);
    }
  };

  const arcRoad = (
    name: string,
    centerX: number,
    centerZ: number,
    radius: number,
    start: number,
    end: number,
    segments: number,
    width: number,
    y = 0.19,
  ): void => {
    let previous = new Vector3(centerX + Math.cos(start) * radius, 0, centerZ + Math.sin(start) * radius);
    for (let i = 1; i <= segments; i++) {
      const t = start + ((end - start) * i) / segments;
      const next = new Vector3(centerX + Math.cos(t) * radius, 0, centerZ + Math.sin(t) * radius);
      roadSegment(`${name}-${i}`, previous, next, width, y);
      previous = next;
    }
  };

  const parkingLot = (name: string, x: number, z: number, width: number, depth: number, rotationY = 0): void => {
    box(`${name}-surface`, new Vector3(x, 0.15, z), new Vector3(width, 0.16, depth), mats.asphalt, false, rotationY);
    const spaces = Math.max(3, Math.floor(width / 8));
    for (let i = 0; i <= spaces; i++) {
      const offset = -width * 0.42 + (i * width * 0.84) / spaces;
      const ox = Math.cos(rotationY) * offset;
      const oz = -Math.sin(rotationY) * offset;
      box(`${name}-space-${i}`, new Vector3(x + ox, 0.245, z + oz), new Vector3(0.18, 0.016, depth * 0.72), mats.lane, false, rotationY);
    }
  };

  const streetLamp = (name: string, x: number, z: number): void => {
    cylinder(`${name}-pole`, new Vector3(x, 2.8, z), 0.18, 5.6, mats.metal, 8);
    box(`${name}-lamp`, new Vector3(x, 5.55, z), new Vector3(0.65, 0.22, 0.42), mats.whiteGlow);
  };

  const shopRow = (name: string, x: number, z: number, countShops: number, alongX: boolean): void => {
    for (let i = 0; i < countShops; i++) {
      const px = x + (alongX ? i * 19 : 0);
      const pz = z + (alongX ? 0 : i * 19);
      const material = i % 3 === 0 ? mats.wall : i % 3 === 1 ? mats.medical : mats.concrete;
      box(`${name}-shop-${i}`, new Vector3(px, 5.0, pz), new Vector3(16, 10, 16), material, true);
      const sign = i % 2 === 0 ? mats.cyan : mats.pink;
      box(`${name}-sign-${i}`, new Vector3(px, 5.8, pz - 8.15), new Vector3(8, 1.1, 0.28), sign);
    }
  };

  const gasStation = (name: string, x: number, z: number, rotationY = 0): void => {
    box(`${name}-forecourt`, new Vector3(x, 0.18, z), new Vector3(70, 0.18, 48), mats.asphalt, false, rotationY);
    box(`${name}-store`, new Vector3(x + 21, 4.6, z + 8), new Vector3(24, 9.2, 20), mats.wall, true, rotationY);
    box(`${name}-canopy`, new Vector3(x - 8, 6.5, z), new Vector3(40, 0.8, 22), mats.red, false, rotationY);
    for (let i = 0; i < 4; i++) {
      const dx = -20 + i * 9;
      box(`${name}-pump-${i}`, new Vector3(x + dx, 1.35, z), new Vector3(1.4, 2.7, 1.2), mats.fuel, false, rotationY);
    }
    box(`${name}-sign`, new Vector3(x + 30, 7.5, z - 17), new Vector3(2.4, 15, 2.4), mats.metal);
    box(`${name}-sign-top`, new Vector3(x + 30, 14.3, z - 17), new Vector3(8.5, 4, 1.1), mats.red);
  };

  const civicBuilding = (
    name: string,
    x: number,
    z: number,
    width: number,
    depth: number,
    height: number,
    material: StandardMaterial,
    accent: StandardMaterial,
  ): void => {
    box(name, new Vector3(x, height * 0.5, z), new Vector3(width, height, depth), material, true);
    box(`${name}-glass`, new Vector3(x, height * 0.55, z - depth * 0.51), new Vector3(width * 0.58, height * 0.48, 0.9), mats.glass);
    box(`${name}-entry`, new Vector3(x, 3.6, z - depth * 0.56), new Vector3(width * 0.36, 7.2, 4.2), accent);
    box(`${name}-roof`, new Vector3(x, height + 1.2, z), new Vector3(width * 0.78, 2.4, depth * 0.78), mats.concreteDark);
  };

  // Curved ring-road junctions / ramps to break the original grid silhouette.
  arcRoad("dense-nw-ring", -455, 420, 170, Math.PI * 0.15, Math.PI * 0.92, 10, 19);
  arcRoad("dense-ne-ring", 455, 420, 170, Math.PI * 0.08, Math.PI * 0.82, 10, 19);
  arcRoad("dense-sw-coast", -430, -430, 190, -Math.PI * 0.95, -Math.PI * 0.12, 11, 20);
  arcRoad("dense-se-port", 455, -390, 180, -Math.PI * 0.88, -Math.PI * 0.08, 10, 20);
  arcRoad("dense-central-loop", 0, 165, 120, 0, Math.PI * 2, 18, 14, 0.21);

  // Long connectors into districts.
  roadSegment("dense-tech-connector", new Vector3(170, 0, 235), new Vector3(500, 0, 290), 18);
  roadSegment("dense-market-connector", new Vector3(-165, 0, 235), new Vector3(-500, 0, 300), 18);
  roadSegment("dense-coastal-link", new Vector3(-310, 0, -470), new Vector3(310, 0, -470), 18);

  // Police HQ and hospital.
  civicBuilding("dense-police-hq", 145, 75, 64, 46, 32, mats.police, mats.blue);
  parkingLot("dense-police-parking", 145, 112, 68, 28);
  civicBuilding("dense-city-hospital", -150, -250, 78, 54, 36, mats.medical, mats.red);
  box("dense-hospital-emergency", new Vector3(-150, 4.0, -281), new Vector3(34, 8, 10), mats.red);
  parkingLot("dense-hospital-parking", -150, -206, 82, 34);

  // Two petrol stations at useful traversal points.
  gasStation("dense-gas-west", -300, 55, 0);
  gasStation("dense-gas-east", 305, -25, Math.PI);

  // Old Market shop density and service alleys.
  shopRow("dense-market-shops-north", -525, 325, 7, true);
  shopRow("dense-market-shops-west", -545, 50, 10, false);
  roadSegment("dense-market-alley-a", new Vector3(-510, 0, 75), new Vector3(-510, 0, 300), 9, 0.16);
  roadSegment("dense-market-alley-b", new Vector3(-330, 0, 75), new Vector3(-330, 0, 310), 9, 0.16);

  // Neon district service lane, parking and storefronts.
  shopRow("dense-neon-shops", -125, -210, 14, true);
  parkingLot("dense-casino-parking", 145, -130, 125, 60);
  roadSegment("dense-neon-backstreet", new Vector3(-155, 0, -235), new Vector3(160, 0, -235), 10, 0.17);
  for (let i = 0; i < 8; i++) streetLamp(`dense-neon-lamp-${i}`, -140 + i * 40, -225);

  // Downtown secondary towers and pocket plazas.
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 * i) / 8;
    const radius = 185 + (i % 2) * 22;
    const x = Math.cos(angle) * radius;
    const z = 165 + Math.sin(angle) * radius;
    const height = 44 + (i % 4) * 18;
    box(`dense-downtown-midrise-${i}`, new Vector3(x, height * 0.5, z), new Vector3(28, height, 30), i % 2 === 0 ? mats.glass : mats.concrete, true);
  }
  box("dense-downtown-pocket-park", new Vector3(-110, 0.14, 42), new Vector3(72, 0.20, 48), mats.green);

  // Tech campus parking, low labs and access alleys.
  parkingLot("dense-tech-parking-a", 455, 85, 115, 60);
  parkingLot("dense-tech-parking-b", 280, 285, 95, 54);
  for (let i = 0; i < 5; i++) {
    box(`dense-tech-lab-${i}`, new Vector3(285 + i * 47, 8, 335), new Vector3(38, 16, 28), mats.wall, true);
    box(`dense-tech-lab-strip-${i}`, new Vector3(285 + i * 47, 9.5, 320.8), new Vector3(22, 2.0, 0.5), mats.cyan);
  }

  // Riverside food strip / promenade details.
  shopRow("dense-riverside-food", -235, -420, 12, true);
  for (let i = 0; i < 11; i++) streetLamp(`dense-river-lamp-${i}`, -240 + i * 48, -365);

  // Port: truck lanes, extra warehouses and parking aprons.
  for (let i = 0; i < 4; i++) {
    roadSegment(`dense-port-truck-lane-${i}`, new Vector3(275, 0, -310 + i * 55), new Vector3(545, 0, -310 + i * 55), 11, 0.17);
  }
  for (let i = 0; i < 3; i++) {
    box(`dense-port-warehouse-extra-${i}`, new Vector3(325 + i * 82, 8, -335), new Vector3(68, 16, 42), mats.concreteDark, true);
  }
  parkingLot("dense-port-yard-parking", 490, -55, 120, 46);

  // Beach: promenade, beach club, parking and boardwalk.
  box("dense-beach-boardwalk", new Vector3(0, 0.24, -488), new Vector3(630, 0.22, 18), mats.concrete);
  parkingLot("dense-hotel-parking", -190, -530, 150, 58);
  box("dense-beach-club", new Vector3(-275, 7, -610), new Vector3(70, 14, 38), mats.wall, true);
  box("dense-beach-club-canopy", new Vector3(-275, 15.0, -610), new Vector3(82, 1.2, 46), mats.sand);
  for (let i = 0; i < 15; i++) streetLamp(`dense-beach-lamp-${i}`, -330 + i * 46, -485);

  // Small functional landmarks scattered across the city.
  box("dense-fire-station", new Vector3(-245, 9, 40), new Vector3(58, 18, 42), mats.red, true);
  box("dense-bank-annex", new Vector3(88, 13, 330), new Vector3(42, 26, 40), mats.wall, true);
  box("dense-public-garage", new Vector3(-70, 9, -35), new Vector3(58, 18, 54), mats.concreteDark, true);
  for (let floor = 0; floor < 3; floor++) {
    box(`dense-garage-gap-${floor}`, new Vector3(-70, 4.5 + floor * 5.2, -62.2), new Vector3(45, 2.4, 0.6), mats.asphalt);
  }

  // Extra lamps on main corridors to give the city a much denser night read.
  for (let x = -500; x <= 500; x += 62) {
    streetLamp(`dense-north-lamp-${x}`, x, 365);
    streetLamp(`dense-south-lamp-${x}`, x, -455);
  }

  return count;
}
