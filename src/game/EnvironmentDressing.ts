import {
  Color3,
  Mesh,
  MeshBuilder,
  PointLight,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import { DISTRICT_RULES, getDistrictRule, getMapDistrict } from "./DistrictRules";
import { PhysicsManager } from "./PhysicsManager";

function mat(scene: Scene, name: string, diffuse: Color3, emissive?: Color3): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = diffuse;
  material.specularColor = new Color3(0.08, 0.08, 0.08);
  if (emissive) material.emissiveColor = emissive;
  return material;
}

function solidBox(
  scene: Scene,
  physics: PhysicsManager,
  name: string,
  position: Vector3,
  size: Vector3,
  material: StandardMaterial,
): Mesh {
  const mesh = MeshBuilder.CreateBox(name, { width: size.x, height: size.y, depth: size.z }, scene);
  mesh.position = position;
  mesh.material = material;
  mesh.receiveShadows = true;
  physics.addStaticBox(mesh);
  return mesh;
}

function visualBox(
  scene: Scene,
  name: string,
  position: Vector3,
  size: Vector3,
  material: StandardMaterial,
): Mesh {
  const mesh = MeshBuilder.CreateBox(name, { width: size.x, height: size.y, depth: size.z }, scene);
  mesh.position = position;
  mesh.material = material;
  mesh.receiveShadows = true;
  return mesh;
}

function addStreetLights(scene: Scene, positions: Vector3[], prefix: string, color: Color3): number {
  const poleMat = mat(scene, `${prefix}-pole-mat`, new Color3(0.08, 0.09, 0.11));
  const glowMat = mat(scene, `${prefix}-glow-mat`, color.scale(0.18), color);
  let count = 0;

  positions.forEach((position, index) => {
    const pole = MeshBuilder.CreateCylinder(`${prefix}-pole-${index}`, { diameter: 0.18, height: 5.4, tessellation: 8 }, scene);
    pole.position = position.add(new Vector3(0, 2.7, 0));
    pole.material = poleMat;

    const lamp = MeshBuilder.CreateBox(`${prefix}-lamp-${index}`, { width: 0.8, height: 0.18, depth: 0.5 }, scene);
    lamp.position = position.add(new Vector3(0, 5.35, 0));
    lamp.material = glowMat;
    count += 2;
  });

  return count;
}

function dressOldMarket(scene: Scene, physics: PhysicsManager): number {
  const wood = mat(scene, "market-wood", new Color3(0.38, 0.22, 0.12));
  const red = mat(scene, "market-red", new Color3(0.72, 0.12, 0.08));
  const gold = mat(scene, "market-gold", new Color3(0.95, 0.55, 0.12), new Color3(0.25, 0.1, 0.02));
  let count = 0;

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 6; col++) {
      const x = -292 + col * 18;
      const z = 95 + row * 24;
      solidBox(scene, physics, `market-stall-${row}-${col}`, new Vector3(x, 1.3, z), new Vector3(12, 2.6, 7), wood);
      visualBox(scene, `market-awning-${row}-${col}`, new Vector3(x, 2.9, z + 2.6), new Vector3(13, 0.35, 2.2), (row + col) % 2 ? red : gold);
      count += 2;
    }
  }

  count += addStreetLights(
    scene,
    [-310, -274, -238, -202, -166].map((x) => new Vector3(x, 0, 72)),
    "market-light",
    new Color3(1.0, 0.55, 0.18),
  );
  return count;
}

function dressCanalTown(scene: Scene, physics: PhysicsManager): number {
  const water = mat(scene, "canal-water", new Color3(0.03, 0.22, 0.32));
  water.alpha = 0.9;
  const concrete = mat(scene, "canal-concrete", new Color3(0.42, 0.43, 0.44));
  const bridgeMat = mat(scene, "canal-bridge", new Color3(0.26, 0.29, 0.31));
  let count = 0;

  for (const x of [-300, -250, -200, -150]) {
    visualBox(scene, `canal-water-${x}`, new Vector3(x, 0.06, -145), new Vector3(15, 0.08, 155), water);
    visualBox(scene, `canal-bank-l-${x}`, new Vector3(x - 9, 0.55, -145), new Vector3(3, 1.1, 155), concrete);
    visualBox(scene, `canal-bank-r-${x}`, new Vector3(x + 9, 0.55, -145), new Vector3(3, 1.1, 155), concrete);
    count += 3;

    for (const z of [-200, -145, -90]) {
      solidBox(scene, physics, `canal-bridge-${x}-${z}`, new Vector3(x, 0.8, z), new Vector3(24, 1.1, 8), bridgeMat);
      count++;
    }
  }

  return count;
}

function dressRiverside(scene: Scene): number {
  const water = mat(scene, "river-water", new Color3(0.025, 0.24, 0.39));
  water.alpha = 0.92;
  const promenade = mat(scene, "river-promenade", new Color3(0.54, 0.48, 0.39));
  const warm = new Color3(1.0, 0.62, 0.24);
  let count = 0;

  visualBox(scene, "river-spine", new Vector3(0, 0.05, -150), new Vector3(86, 0.09, 205), water);
  visualBox(scene, "river-promenade-west", new Vector3(-50, 0.18, -150), new Vector3(13, 0.28, 205), promenade);
  visualBox(scene, "river-promenade-east", new Vector3(50, 0.18, -150), new Vector3(13, 0.28, 205), promenade);
  count += 3;

  const lightPositions: Vector3[] = [];
  for (let z = -235; z <= -70; z += 28) {
    lightPositions.push(new Vector3(-44, 0, z), new Vector3(44, 0, z));
  }
  count += addStreetLights(scene, lightPositions, "riverside-light", warm);
  return count;
}

function dressIndustrialDocks(scene: Scene, physics: PhysicsManager): number {
  const concrete = mat(scene, "dock-concrete", new Color3(0.22, 0.24, 0.26));
  const rust = mat(scene, "dock-rust", new Color3(0.52, 0.24, 0.10));
  const blue = mat(scene, "dock-blue", new Color3(0.08, 0.28, 0.52));
  const red = mat(scene, "dock-red", new Color3(0.62, 0.12, 0.08));
  let count = 0;

  visualBox(scene, "dock-yard", new Vector3(245, 0.1, -155), new Vector3(190, 0.18, 175), concrete);
  count++;

  for (let i = 0; i < 28; i++) {
    const col = i % 7;
    const row = Math.floor(i / 7);
    const x = 180 + col * 21;
    const z = -220 + row * 24;
    const y = i % 5 === 0 ? 4.6 : 1.6;
    solidBox(scene, physics, `dock-container-${i}`, new Vector3(x, y, z), new Vector3(14, 3.2, 6), i % 3 === 0 ? rust : i % 3 === 1 ? blue : red);
    count++;
  }

  for (let i = 0; i < 3; i++) {
    const x = 205 + i * 58;
    visualBox(scene, `dock-crane-leg-a-${i}`, new Vector3(x - 9, 11, -80), new Vector3(2.2, 22, 2.2), rust);
    visualBox(scene, `dock-crane-leg-b-${i}`, new Vector3(x + 9, 11, -80), new Vector3(2.2, 22, 2.2), rust);
    visualBox(scene, `dock-crane-top-${i}`, new Vector3(x, 22, -80), new Vector3(34, 2.4, 2.4), rust);
    visualBox(scene, `dock-crane-boom-${i}`, new Vector3(x - 13, 25, -100), new Vector3(2.2, 2.2, 40), rust);
    count += 4;
  }

  return count;
}

function dressBeachMarina(scene: Scene, physics: PhysicsManager): number {
  const sand = mat(scene, "beach-sand-dressing", new Color3(0.76, 0.66, 0.45));
  const water = mat(scene, "marina-water", new Color3(0.02, 0.30, 0.48));
  const pier = mat(scene, "marina-pier", new Color3(0.46, 0.44, 0.39));
  const trunk = mat(scene, "palm-trunk-dressing", new Color3(0.32, 0.19, 0.08));
  const leaf = mat(scene, "palm-leaf-dressing", new Color3(0.10, 0.42, 0.16));
  let count = 0;

  visualBox(scene, "beach-strip-dressing", new Vector3(0, 0.08, -300), new Vector3(560, 0.16, 72), sand);
  visualBox(scene, "marina-bay", new Vector3(110, 0.04, -345), new Vector3(240, 0.08, 70), water);
  count += 2;

  for (let x = -250; x <= 250; x += 35) {
    const trunkMesh = MeshBuilder.CreateCylinder(`beach-palm-trunk-${x}`, { diameter: 0.65, height: 5.2, tessellation: 8 }, scene);
    trunkMesh.position = new Vector3(x, 2.6, -276);
    trunkMesh.material = trunk;
    const crown = MeshBuilder.CreateSphere(`beach-palm-crown-${x}`, { diameter: 4.6, segments: 8 }, scene);
    crown.position = new Vector3(x, 5.3, -276);
    crown.scaling.y = 0.45;
    crown.material = leaf;
    count += 2;
  }

  for (let x = 25; x <= 205; x += 45) {
    solidBox(scene, physics, `marina-pier-${x}`, new Vector3(x, 0.45, -338), new Vector3(9, 0.7, 62), pier);
    count++;
  }
  return count;
}

function dressHills(scene: Scene, physics: PhysicsManager): number {
  const terrace = mat(scene, "hill-terrace", new Color3(0.28, 0.35, 0.24));
  const wall = mat(scene, "hill-wall", new Color3(0.48, 0.45, 0.40));
  const luxury = mat(scene, "hill-luxury", new Color3(0.68, 0.66, 0.58));
  let count = 0;

  for (let i = 0; i < 5; i++) {
    const z = 230 + i * 26;
    visualBox(scene, `hill-terrace-${i}`, new Vector3(-40 + i * 20, 0.4 + i * 0.45, z), new Vector3(250 - i * 24, 0.8, 20), terrace);
    count++;
  }

  for (let i = 0; i < 6; i++) {
    const x = -130 + i * 52;
    solidBox(scene, physics, `vip-compound-${i}`, new Vector3(x, 4.2, 286 + (i % 2) * 22), new Vector3(34, 8, 24), luxury);
    visualBox(scene, `vip-wall-${i}`, new Vector3(x, 1.4, 270 + (i % 2) * 22), new Vector3(38, 2.8, 2.3), wall);
    count += 2;
  }
  return count;
}

function dressTechPort(scene: Scene): number {
  const cyan = new Color3(0.0, 0.86, 1.0);
  const coolMat = mat(scene, "tech-cool", new Color3(0.10, 0.18, 0.25));
  const glowMat = mat(scene, "tech-glow", cyan.scale(0.16), cyan);
  let count = 0;

  for (let i = 0; i < 8; i++) {
    const x = 165 + (i % 4) * 38;
    const z = 95 + Math.floor(i / 4) * 68;
    visualBox(scene, `tech-plinth-${i}`, new Vector3(x, 0.45, z), new Vector3(26, 0.9, 26), coolMat);
    visualBox(scene, `tech-beacon-${i}`, new Vector3(x, 7.5, z), new Vector3(1.0, 15, 1.0), glowMat);
    count += 2;
  }
  return count;
}

function dressNeonQuarter(scene: Scene): number {
  const rule = DISTRICT_RULES["Neon Quarter"];
  const colors = [
    new Color3(0.0, 0.95, 1.0),
    new Color3(1.0, 0.04, 0.72),
    new Color3(0.55, 0.12, 1.0),
  ];
  let count = 0;

  for (let i = 0; i < 10; i++) {
    const color = colors[i % colors.length];
    const signMat = mat(scene, `neon-sign-dress-${i}`, color.scale(0.12), color.scale(rule.neonStrength));
    const x = 95 + (i % 5) * 34;
    const z = -30 - Math.floor(i / 5) * 76;
    visualBox(scene, `neon-billboard-${i}`, new Vector3(x, 9 + (i % 3) * 3.5, z), new Vector3(18, 5, 0.45), signMat);
    count++;
  }

  for (let i = 0; i < 4; i++) {
    const light = new PointLight(`neon-point-${i}`, new Vector3(115 + i * 46, 7, -75), scene);
    light.diffuse = colors[i % colors.length];
    light.intensity = 0.55;
    light.range = 28;
    count++;
  }
  return count;
}

function addDistrictWayfinding(scene: Scene): number {
  const positions: Array<[string, Vector3, Color3]> = [
    ["central", new Vector3(0, 0.2, 55), new Color3(0.85, 0.9, 1.0)],
    ["old-market", new Vector3(-235, 0.2, 90), new Color3(1.0, 0.55, 0.2)],
    ["tech-port", new Vector3(230, 0.2, 115), new Color3(0.0, 0.86, 1.0)],
    ["neon", new Vector3(165, 0.2, -65), new Color3(1.0, 0.04, 0.72)],
    ["canal", new Vector3(-235, 0.2, -150), new Color3(0.18, 0.65, 0.76)],
    ["river", new Vector3(0, 0.2, -165), new Color3(0.22, 0.72, 0.82)],
    ["docks", new Vector3(245, 0.2, -165), new Color3(0.8, 0.34, 0.12)],
    ["beach", new Vector3(0, 0.2, -300), new Color3(0.96, 0.72, 0.32)],
    ["hills", new Vector3(0, 0.2, 280), new Color3(0.38, 0.72, 0.38)],
  ];
  let count = 0;

  for (const [name, position, color] of positions) {
    const rule = getDistrictRule(position);
    const markerMat = mat(scene, `district-marker-mat-${name}`, color.scale(0.16), color.scale(Math.max(0.2, rule.neonStrength)));
    const marker = MeshBuilder.CreateCylinder(`district-marker-${name}`, { diameter: 5.5, height: 0.18, tessellation: 24 }, scene);
    marker.position = position;
    marker.material = markerMat;
    count++;
  }
  return count;
}

export function buildEnvironmentDressing(scene: Scene, physics: PhysicsManager): number {
  let count = 0;
  count += dressOldMarket(scene, physics);
  count += dressCanalTown(scene, physics);
  count += dressRiverside(scene);
  count += dressIndustrialDocks(scene, physics);
  count += dressBeachMarina(scene, physics);
  count += dressHills(scene, physics);
  count += dressTechPort(scene);
  count += dressNeonQuarter(scene);
  count += addDistrictWayfinding(scene);

  console.info(`Environment dressing complete: ${count} district objects.`);
  return count;
}
