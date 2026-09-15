import "@babylonjs/loaders/glTF";
import {
  Color3,
  InstancedMesh,
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
  depth: number;
  minY: number;
};

type DistrictSpec = {
  name: string;
  center: Vector3;
  radiusX: number;
  radiusZ: number;
  count: number;
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  templateOrder: string[];
  clearCentral?: boolean;
};

const BUILDING_FILES = ["Building_Large_2", "Building_Medium_2_001", "Building_Small_1"] as const;

function getBasePath(folder: string): string {
  const repoBase = window.location.pathname.startsWith("/Mirag_City_Game/") ? "/Mirag_City_Game/" : "/";
  return `${repoBase}assets/${folder}/`;
}

async function loadTemplate(scene: Scene, root: string, file: string): Promise<Template> {
  const result = await SceneLoader.ImportMeshAsync(null, root, file, scene);
  const mesh = result.meshes.find((node): node is Mesh => node instanceof Mesh && node.getTotalVertices() > 0);
  if (!mesh) throw new Error(`No render mesh found in ${file}`);
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
    depth: Math.max(0.01, max.z - min.z),
    minY: min.y,
  };
}

function createInstance(
  template: Template,
  name: string,
  position: Vector3,
  width: number,
  depth: number,
  heightMultiplier: number,
  rotationY: number,
): InstancedMesh {
  const instance = template.mesh.createInstance(name);
  const horizontalScale = Math.min(width / template.width, depth / template.depth);
  instance.scaling = new Vector3(horizontalScale, horizontalScale * heightMultiplier, horizontalScale);
  instance.rotation.y = rotationY;
  instance.position = new Vector3(position.x, -template.minY * instance.scaling.y + position.y, position.z);
  instance.receiveShadows = true;
  return instance;
}

function makeMaterial(scene: Scene, name: string, color: Color3, emissive?: Color3): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = color;
  mat.specularColor = new Color3(0.05, 0.05, 0.05);
  if (emissive) mat.emissiveColor = emissive;
  return mat;
}

function disposeLegacyGrid(scene: Scene, physics: PhysicsManager): void {
  const prefixes = [
    "modular-core-building-",
    "modular-outer-building-",
    "outer-building-collision-",
    "outer-road-x-",
    "outer-road-z-",
    "kit-intersection-",
    "kit-lane-",
    "kit-sidewalk-",
    "dense-downtown-midrise-",
    "dense-market-shops-",
    "dense-neon-shops-",
    "dense-riverside-food-",
    "dense-tech-lab-",
    "dense-market-alley-",
    "dense-neon-backstreet",
    "dense-tech-connector",
    "dense-market-connector",
    "dense-coastal-link",
    "dense-central-loop-",
    "dense-nw-ring-",
    "dense-ne-ring-",
    "dense-sw-coast-",
    "dense-se-port-",
    "mcp-old-market-building-",
    "mcp-canal-home-",
    "mcp-downtown-tower-",
    "mcp-riverside-hotel-",
    "mcp-tech-lab-",
    "mcp-expressway-",
    "mcp-diagonal-",
    "mcp-coastal-boulevard",
  ];

  for (const mesh of [...scene.meshes]) {
    if (!prefixes.some((prefix) => mesh.name.startsWith(prefix))) continue;
    physics.removeStaticBox(mesh);
    mesh.dispose();
  }
}

function hash01(a: number, b: number, salt: number): number {
  const v = Math.sin(a * 13.173 + b * 77.331 + salt * 19.719) * 43758.5453;
  return v - Math.floor(v);
}

export async function rebuildMirageCity(scene: Scene, physics: PhysicsManager): Promise<number> {
  disposeLegacyGrid(scene, physics);
  let count = 0;

  const roadMat = makeMaterial(scene, "v2-road", new Color3(0.028, 0.032, 0.040));
  const laneMat = makeMaterial(scene, "v2-lane", new Color3(0.94, 0.92, 0.78));
  const sidewalkMat = makeMaterial(scene, "v2-sidewalk", new Color3(0.42, 0.44, 0.45));
  const medianMat = makeMaterial(scene, "v2-median", new Color3(0.10, 0.30, 0.12));
  const concreteMat = makeMaterial(scene, "v2-concrete", new Color3(0.32, 0.34, 0.36));
  const lampMat = makeMaterial(scene, "v2-lamp", new Color3(0.20, 0.20, 0.20), new Color3(0.55, 0.48, 0.32));
  const neonBlue = makeMaterial(scene, "v2-neon-blue", new Color3(0.02, 0.10, 0.18), new Color3(0.00, 0.75, 1.00));
  const neonPink = makeMaterial(scene, "v2-neon-pink", new Color3(0.15, 0.02, 0.11), new Color3(0.95, 0.03, 0.54));
  const waterMat = makeMaterial(scene, "v2-water", new Color3(0.02, 0.28, 0.46));
  waterMat.alpha = 0.93;

  const box = (
    name: string,
    pos: Vector3,
    size: Vector3,
    mat: StandardMaterial,
    rotationY = 0,
    solid = false,
  ): Mesh => {
    const mesh = MeshBuilder.CreateBox(name, { width: size.x, height: size.y, depth: size.z }, scene);
    mesh.position.copyFrom(pos);
    mesh.rotation.y = rotationY;
    mesh.material = mat;
    mesh.receiveShadows = true;
    if (solid) physics.addStaticBox(mesh);
    count++;
    return mesh;
  };

  const roadSegment = (name: string, a: Vector3, b: Vector3, width: number, y = 0.19): void => {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    const yaw = Math.atan2(-dz, dx);
    const center = new Vector3((a.x + b.x) * 0.5, y, (a.z + b.z) * 0.5);
    box(name, center, new Vector3(length, 0.22, width), roadMat, yaw);
    for (let offset = -length * 0.45; offset <= length * 0.45; offset += 18) {
      const ox = Math.cos(yaw) * offset;
      const oz = -Math.sin(yaw) * offset;
      box(`${name}-dash-${Math.round(offset)}`, new Vector3(center.x + ox, y + 0.125, center.z + oz), new Vector3(7.5, 0.02, 0.26), laneMat, yaw);
    }
  };

  const arcRoad = (
    name: string,
    cx: number,
    cz: number,
    radius: number,
    start: number,
    end: number,
    segments: number,
    width: number,
    y = 0.21,
  ): void => {
    let prev = new Vector3(cx + Math.cos(start) * radius, 0, cz + Math.sin(start) * radius);
    for (let i = 1; i <= segments; i++) {
      const t = start + ((end - start) * i) / segments;
      const next = new Vector3(cx + Math.cos(t) * radius, 0, cz + Math.sin(t) * radius);
      roadSegment(`${name}-${i}`, prev, next, width, y);
      prev = next;
    }
  };

  const elevatedRoad = (name: string, points: Vector3[], width: number, deckY: number): void => {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      roadSegment(`${name}-deck-${i}`, new Vector3(a.x, 0, a.z), new Vector3(b.x, 0, b.z), width, deckY);
      const mid = new Vector3((a.x + b.x) * 0.5, deckY * 0.5, (a.z + b.z) * 0.5);
      box(`${name}-pier-${i}`, mid, new Vector3(2.8, deckY, 2.8), concreteMat);
    }
  };

  const placeLampLine = (prefix: string, a: Vector3, b: Vector3, spacing: number, sideOffset: number): void => {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    const nx = -dz / length;
    const nz = dx / length;
    const steps = Math.floor(length / spacing);
    for (let i = 0; i <= steps; i++) {
      const t = i / Math.max(1, steps);
      const x = a.x + dx * t + nx * sideOffset;
      const z = a.z + dz * t + nz * sideOffset;
      box(`${prefix}-${i}-pole`, new Vector3(x, 3.2, z), new Vector3(0.18, 6.4, 0.18), concreteMat);
      box(`${prefix}-${i}-light`, new Vector3(x, 6.35, z), new Vector3(0.55, 0.22, 0.42), lampMat);
    }
  };

  // New road hierarchy: grand boulevard + diagonals + waterfront + ring roads.
  roadSegment("v2-grand-boulevard", new Vector3(0, 0, -465), new Vector3(0, 0, 430), 34);
  roadSegment("v2-east-west-arterial", new Vector3(-560, 0, 125), new Vector3(560, 0, 125), 30);
  roadSegment("v2-neon-arterial", new Vector3(-300, 0, -135), new Vector3(300, 0, -135), 24);
  roadSegment("v2-waterfront-road", new Vector3(-450, 0, -475), new Vector3(450, 0, -475), 26);
  roadSegment("v2-market-diagonal", new Vector3(-545, 0, 330), new Vector3(-95, 0, 160), 22);
  roadSegment("v2-tech-diagonal", new Vector3(545, 0, 335), new Vector3(100, 0, 160), 22);
  roadSegment("v2-canal-link", new Vector3(-520, 0, -245), new Vector3(-145, 0, -85), 20);
  roadSegment("v2-port-link", new Vector3(520, 0, -290), new Vector3(160, 0, -95), 22);
  arcRoad("v2-north-ring", 0, 475, 360, Math.PI * 0.10, Math.PI * 0.90, 20, 26);
  arcRoad("v2-south-ring", 0, -445, 400, Math.PI * 1.08, Math.PI * 1.92, 22, 26);
  arcRoad("v2-central-roundabout", 0, 165, 84, 0, Math.PI * 2, 20, 18);

  // Boulevard sidewalks and median make the spawn view immediately different.
  box("v2-boulevard-median", new Vector3(0, 0.33, 40), new Vector3(5.5, 0.35, 760), medianMat);
  box("v2-boulevard-sidewalk-west", new Vector3(-20.5, 0.27, 40), new Vector3(6, 0.22, 770), sidewalkMat);
  box("v2-boulevard-sidewalk-east", new Vector3(20.5, 0.27, 40), new Vector3(6, 0.22, 770), sidewalkMat);
  placeLampLine("v2-boulevard-lamps-west", new Vector3(-22, 0, -430), new Vector3(-22, 0, 390), 44, 0);
  placeLampLine("v2-boulevard-lamps-east", new Vector3(22, 0, -430), new Vector3(22, 0, 390), 44, 0);

  // Proper elevated freeway crossing the skyline instead of another flat grid.
  elevatedRoad(
    "v2-elevated-freeway",
    [
      new Vector3(-590, 0, 390),
      new Vector3(-420, 0, 335),
      new Vector3(-250, 0, 315),
      new Vector3(-70, 0, 340),
      new Vector3(120, 0, 320),
      new Vector3(310, 0, 275),
      new Vector3(560, 0, 320),
    ],
    22,
    8.0,
  );

  // Stronger water silhouettes matching the master-map idea.
  box("v2-canal-west", new Vector3(-405, 0.08, -145), new Vector3(245, 0.16, 54), waterMat);
  box("v2-canal-west-branch", new Vector3(-470, 0.08, -165), new Vector3(54, 0.16, 230), waterMat);
  box("v2-river-central", new Vector3(0, 0.08, -330), new Vector3(480, 0.16, 72), waterMat);

  const root = getBasePath("city-kit");
  const templates = new Map<string, Template>();
  for (const file of BUILDING_FILES) {
    try {
      templates.set(file, await loadTemplate(scene, root, `${file}.gltf`));
    } catch (error) {
      console.warn(`Mirage rebuild could not load ${file}`, error);
    }
  }

  const specs: DistrictSpec[] = [
    {
      name: "downtown",
      center: new Vector3(0, 0, 175), radiusX: 220, radiusZ: 205, count: 38,
      minWidth: 28, maxWidth: 46, minHeight: 1.35, maxHeight: 3.15,
      templateOrder: ["Building_Large_2", "Building_Medium_2_001", "Building_Large_2"], clearCentral: true,
    },
    {
      name: "old-market",
      center: new Vector3(-405, 0, 205), radiusX: 175, radiusZ: 145, count: 28,
      minWidth: 21, maxWidth: 34, minHeight: 0.62, maxHeight: 1.12,
      templateOrder: ["Building_Small_1", "Building_Medium_2_001", "Building_Small_1"],
    },
    {
      name: "tech",
      center: new Vector3(405, 0, 205), radiusX: 180, radiusZ: 150, count: 24,
      minWidth: 26, maxWidth: 44, minHeight: 0.85, maxHeight: 1.75,
      templateOrder: ["Building_Medium_2_001", "Building_Large_2", "Building_Medium_2_001"],
    },
    {
      name: "canal",
      center: new Vector3(-405, 0, -145), radiusX: 170, radiusZ: 130, count: 24,
      minWidth: 20, maxWidth: 32, minHeight: 0.60, maxHeight: 1.05,
      templateOrder: ["Building_Small_1", "Building_Medium_2_001", "Building_Small_1"],
    },
    {
      name: "neon",
      center: new Vector3(0, 0, -125), radiusX: 185, radiusZ: 95, count: 22,
      minWidth: 24, maxWidth: 38, minHeight: 0.85, maxHeight: 1.45,
      templateOrder: ["Building_Medium_2_001", "Building_Large_2", "Building_Medium_2_001"], clearCentral: true,
    },
    {
      name: "riverside",
      center: new Vector3(0, 0, -365), radiusX: 225, radiusZ: 88, count: 18,
      minWidth: 22, maxWidth: 36, minHeight: 0.70, maxHeight: 1.25,
      templateOrder: ["Building_Medium_2_001", "Building_Small_1", "Building_Medium_2_001"], clearCentral: true,
    },
    {
      name: "industrial",
      center: new Vector3(420, 0, -220), radiusX: 165, radiusZ: 165, count: 22,
      minWidth: 30, maxWidth: 50, minHeight: 0.55, maxHeight: 1.05,
      templateOrder: ["Building_Large_2", "Building_Medium_2_001", "Building_Large_2"],
    },
    {
      name: "hills",
      center: new Vector3(0, 0, 525), radiusX: 260, radiusZ: 90, count: 18,
      minWidth: 20, maxWidth: 32, minHeight: 0.55, maxHeight: 0.95,
      templateOrder: ["Building_Small_1", "Building_Small_1", "Building_Medium_2_001"], clearCentral: true,
    },
    {
      name: "beach",
      center: new Vector3(0, 0, -565), radiusX: 280, radiusZ: 80, count: 18,
      minWidth: 22, maxWidth: 38, minHeight: 0.65, maxHeight: 1.25,
      templateOrder: ["Building_Medium_2_001", "Building_Small_1", "Building_Large_2"], clearCentral: true,
    },
  ];

  let buildingIndex = 0;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (const spec of specs) {
    for (let i = 0; i < spec.count; i++) {
      const radial = Math.sqrt((i + 0.55) / spec.count);
      const angle = i * golden + hash01(spec.center.x, spec.center.z, i) * 0.65;
      let x = spec.center.x + Math.cos(angle) * spec.radiusX * radial;
      let z = spec.center.z + Math.sin(angle) * spec.radiusZ * radial;
      x += (hash01(x, z, 11) - 0.5) * 26;
      z += (hash01(x, z, 21) - 0.5) * 24;

      // Reserve main boulevards, roundabout and water corridors.
      if (Math.abs(x) < 34 && z > -455 && z < 430) x += x >= 0 ? 62 : -62;
      if (Math.abs(z - 125) < 28 && x > -550 && x < 550) z += z >= 125 ? 52 : -52;
      if (Math.abs(z + 135) < 23 && Math.abs(x) < 310) z += z >= -135 ? 48 : -48;
      if (spec.clearCentral && Math.hypot(x, z - 165) < 112) {
        const d = new Vector3(x, 0, z - 165).normalize();
        x = d.x * 125;
        z = 165 + d.z * 125;
      }
      if (spec.name === "canal" && (Math.abs(z + 145) < 42 || Math.abs(x + 470) < 42)) continue;
      if (spec.name === "riverside" && Math.abs(z + 330) < 52) continue;

      const templateName = spec.templateOrder[i % spec.templateOrder.length];
      const template = templates.get(templateName);
      if (!template) continue;
      const width = spec.minWidth + hash01(x, z, 31) * (spec.maxWidth - spec.minWidth);
      const depth = spec.minWidth + hash01(x, z, 41) * (spec.maxWidth - spec.minWidth);
      const height = spec.minHeight + hash01(x, z, 51) * (spec.maxHeight - spec.minHeight);
      const rotation = (hash01(x, z, 61) - 0.5) * 0.9 + (i % 3 === 0 ? Math.PI * 0.5 : 0);
      createInstance(template, `v2-${spec.name}-building-${buildingIndex}`, new Vector3(x, 0.28, z), width, depth, height, rotation);
      buildingIndex++;
    }
  }

  // Neon facade accents, so the entertainment district reads differently from downtown.
  for (let i = 0; i < 18; i++) {
    const x = -165 + (i % 9) * 41;
    const z = i < 9 ? -82 : -190;
    box(`v2-neon-pylon-${i}`, new Vector3(x, 4.2, z), new Vector3(1.0, 8.4, 1.0), i % 2 === 0 ? neonBlue : neonPink);
  }

  // Strong civic gateway at downtown approach.
  box("v2-downtown-gateway-left", new Vector3(-33, 12, -15), new Vector3(7, 24, 7), concreteMat, 0, true);
  box("v2-downtown-gateway-right", new Vector3(33, 12, -15), new Vector3(7, 24, 7), concreteMat, 0, true);
  box("v2-downtown-gateway-span", new Vector3(0, 23, -15), new Vector3(66, 4, 7), neonBlue);

  return count + buildingIndex;
}
