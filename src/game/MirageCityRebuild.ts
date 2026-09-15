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
import {
  MIRAGE_ARC_ROADS,
  MIRAGE_BRIDGES,
  MIRAGE_BUILDING_ROWS,
  MIRAGE_ELEVATED_FREEWAY,
  MIRAGE_LANDMARKS,
  MIRAGE_ROADS,
  type BuildingTemplateName,
  type PlanPoint,
  type RoadClass,
} from "./MirageCityMasterPlan";

type Template = {
  mesh: Mesh;
  width: number;
  depth: number;
  minY: number;
};

const BUILDING_FILES: readonly BuildingTemplateName[] = [
  "Building_Large_2",
  "Building_Medium_2_001",
  "Building_Small_1",
];

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

function disposeLegacyCity(scene: Scene, physics: PhysicsManager): void {
  const prefixes = [
    "modular-",
    "outer-road-",
    "outer-building-",
    "kit-",
    "dense-",
    "mcp-",
    "neon-floor-",
    "neon-pillar-",
    "neon-light-",
    "neon-feature-",
    "neon-planter-",
    "v2-",
  ];

  for (const mesh of [...scene.meshes]) {
    if (!prefixes.some((prefix) => mesh.name.startsWith(prefix))) continue;
    physics.removeStaticBox(mesh);
    mesh.dispose();
  }
}

function toVector(point: PlanPoint, y = 0): Vector3 {
  return new Vector3(point[0], y, point[1]);
}

export async function rebuildMirageCity(scene: Scene, physics: PhysicsManager): Promise<number> {
  disposeLegacyCity(scene, physics);
  let count = 0;

  const mats = {
    expressway: makeMaterial(scene, "plan-expressway", new Color3(0.025, 0.028, 0.034)),
    arterial: makeMaterial(scene, "plan-arterial", new Color3(0.035, 0.039, 0.046)),
    collector: makeMaterial(scene, "plan-collector", new Color3(0.050, 0.053, 0.060)),
    local: makeMaterial(scene, "plan-local", new Color3(0.062, 0.064, 0.069)),
    waterfront: makeMaterial(scene, "plan-waterfront", new Color3(0.045, 0.050, 0.056)),
    lane: makeMaterial(scene, "plan-lane", new Color3(0.94, 0.92, 0.78)),
    sidewalk: makeMaterial(scene, "plan-sidewalk", new Color3(0.45, 0.46, 0.47)),
    median: makeMaterial(scene, "plan-median", new Color3(0.10, 0.30, 0.12)),
    concrete: makeMaterial(scene, "plan-concrete", new Color3(0.34, 0.36, 0.38)),
    darkConcrete: makeMaterial(scene, "plan-dark-concrete", new Color3(0.18, 0.20, 0.22)),
    water: makeMaterial(scene, "plan-water", new Color3(0.02, 0.28, 0.48)),
    sand: makeMaterial(scene, "plan-sand", new Color3(0.78, 0.69, 0.49)),
    grass: makeMaterial(scene, "plan-grass", new Color3(0.14, 0.36, 0.16)),
    glass: makeMaterial(scene, "plan-glass", new Color3(0.08, 0.24, 0.34)),
    civic: makeMaterial(scene, "plan-civic", new Color3(0.60, 0.64, 0.67)),
    tech: makeMaterial(scene, "plan-tech", new Color3(0.18, 0.38, 0.48)),
    market: makeMaterial(scene, "plan-market", new Color3(0.62, 0.43, 0.30)),
    industrial: makeMaterial(scene, "plan-industrial", new Color3(0.31, 0.34, 0.35)),
    hotel: makeMaterial(scene, "plan-hotel", new Color3(0.76, 0.75, 0.70)),
    villa: makeMaterial(scene, "plan-villa", new Color3(0.72, 0.69, 0.60)),
    neonBlue: makeMaterial(scene, "plan-neon-blue", new Color3(0.02, 0.10, 0.16), new Color3(0.00, 0.75, 1.00)),
    neonPink: makeMaterial(scene, "plan-neon-pink", new Color3(0.15, 0.02, 0.10), new Color3(0.95, 0.03, 0.54)),
  };
  mats.water.alpha = 0.93;

  const box = (
    name: string,
    position: Vector3,
    size: Vector3,
    material: StandardMaterial,
    solid = false,
  ): Mesh => {
    const mesh = MeshBuilder.CreateBox(name, { width: size.x, height: size.y, depth: size.z }, scene);
    mesh.position.copyFrom(position);
    mesh.material = material;
    mesh.receiveShadows = true;
    if (solid) physics.addStaticBox(mesh);
    count++;
    return mesh;
  };

  const roadMaterial = (roadClass: RoadClass): StandardMaterial => mats[roadClass];

  const flatSegment = (
    name: string,
    a: Vector3,
    b: Vector3,
    width: number,
    material: StandardMaterial,
    y = 0.18,
    laneMarks = true,
  ): void => {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.01) return;
    const yaw = Math.atan2(-dz, dx);
    const center = new Vector3((a.x + b.x) * 0.5, y, (a.z + b.z) * 0.5);
    const road = box(name, center, new Vector3(length, 0.22, width), material);
    road.rotation.y = yaw;

    if (!laneMarks || width < 16) return;
    for (let offset = -length * 0.42; offset <= length * 0.42; offset += 18) {
      const ox = Math.cos(yaw) * offset;
      const oz = -Math.sin(yaw) * offset;
      const mark = box(`${name}-dash-${Math.round(offset)}`, new Vector3(center.x + ox, y + 0.125, center.z + oz), new Vector3(7.5, 0.02, 0.28), mats.lane);
      mark.rotation.y = yaw;
    }
  };

  const polylineRoad = (id: string, points: readonly PlanPoint[], width: number, material: StandardMaterial): void => {
    for (let i = 0; i < points.length - 1; i++) {
      flatSegment(`${id}-${i}`, toVector(points[i]), toVector(points[i + 1]), width, material);
    }
  };

  const deckBetween = (
    name: string,
    a: Vector3,
    b: Vector3,
    width: number,
    height: number,
    material: StandardMaterial,
    solid = false,
  ): Mesh => {
    const length = Vector3.Distance(a, b);
    const mesh = MeshBuilder.CreateBox(name, { width, height, depth: length }, scene);
    mesh.position.copyFrom(a.add(b).scale(0.5));
    mesh.lookAt(b);
    mesh.material = material;
    mesh.receiveShadows = true;
    if (solid) physics.addStaticBox(mesh);
    count++;
    return mesh;
  };

  const bridge = (id: string, from: PlanPoint, to: PlanPoint, width: number, deckY: number, railings = true): void => {
    const aGround = toVector(from, 0.22);
    const bGround = toVector(to, 0.22);
    const horizontal = bGround.subtract(aGround);
    const horizontalLength = Math.max(0.01, Math.hypot(horizontal.x, horizontal.z));
    const ux = horizontal.x / horizontalLength;
    const uz = horizontal.z / horizontalLength;
    const nx = -uz;
    const nz = ux;
    const rampLength = 26;

    const aDeck = toVector(from, deckY);
    const bDeck = toVector(to, deckY);
    const aRampGround = new Vector3(aGround.x - ux * rampLength, 0.22, aGround.z - uz * rampLength);
    const bRampGround = new Vector3(bGround.x + ux * rampLength, 0.22, bGround.z + uz * rampLength);

    deckBetween(`${id}-ramp-a`, aRampGround, aDeck, width, 0.34, mats.arterial, true);
    deckBetween(`${id}-deck`, aDeck, bDeck, width, 0.40, mats.arterial, true);
    deckBetween(`${id}-ramp-b`, bDeck, bRampGround, width, 0.34, mats.arterial, true);

    if (railings) {
      const railOffset = width * 0.48;
      for (const side of [-1, 1] as const) {
        const offset = new Vector3(nx * railOffset * side, 0.72, nz * railOffset * side);
        deckBetween(`${id}-rail-${side}`, aDeck.add(offset), bDeck.add(offset), 0.38, 0.85, mats.concrete);
      }
    }

    const span = Vector3.Distance(aDeck, bDeck);
    const pierCount = Math.max(1, Math.floor(span / 48));
    for (let i = 1; i <= pierCount; i++) {
      const t = i / (pierCount + 1);
      const p = Vector3.Lerp(aDeck, bDeck, t);
      box(`${id}-pier-${i}`, new Vector3(p.x, deckY * 0.5, p.z), new Vector3(2.6, deckY, 2.6), mats.darkConcrete);
    }
  };

  // Water and terrain silhouettes are laid out first so roads and bridges have a real reason to exist.
  box("plan-ocean-south", new Vector3(0, -0.08, -770), new Vector3(1700, 0.14, 300), mats.water);
  box("plan-ocean-west", new Vector3(-775, -0.08, -60), new Vector3(250, 0.14, 1250), mats.water);
  box("plan-ocean-east", new Vector3(775, -0.08, -60), new Vector3(250, 0.14, 1250), mats.water);
  box("plan-beach", new Vector3(0, 0.03, -575), new Vector3(720, 0.12, 150), mats.sand);
  box("plan-hills-green", new Vector3(0, 0.04, 525), new Vector3(620, 0.14, 160), mats.grass);
  box("plan-canal-main", new Vector3(-410, 0.06, -145), new Vector3(260, 0.12, 54), mats.water);
  box("plan-canal-branch", new Vector3(-470, 0.06, -160), new Vector3(54, 0.12, 260), mats.water);
  box("plan-river", new Vector3(0, 0.06, -330), new Vector3(500, 0.12, 74), mats.water);
  box("plan-marina-water", new Vector3(210, 0.06, -620), new Vector3(300, 0.12, 185), mats.water);
  box("plan-port-water", new Vector3(610, 0.06, -230), new Vector3(165, 0.12, 360), mats.water);

  // Authoritative road graph.
  for (const road of MIRAGE_ROADS) {
    polylineRoad(`plan-road-${road.id}`, road.points, road.width, roadMaterial(road.roadClass));
  }

  for (const arc of MIRAGE_ARC_ROADS) {
    let previous: PlanPoint = [
      arc.center[0] + Math.cos(arc.start) * arc.radius,
      arc.center[1] + Math.sin(arc.start) * arc.radius,
    ];
    for (let i = 1; i <= arc.segments; i++) {
      const t = arc.start + ((arc.end - arc.start) * i) / arc.segments;
      const next: PlanPoint = [
        arc.center[0] + Math.cos(t) * arc.radius,
        arc.center[1] + Math.sin(t) * arc.radius,
      ];
      flatSegment(`plan-arc-${arc.id}-${i}`, toVector(previous), toVector(next), arc.width, roadMaterial(arc.roadClass));
      previous = next;
    }
  }

  // Grand Boulevard gets fixed sidewalks and median, making it a designed avenue rather than a line on the ground.
  box("plan-grand-median", new Vector3(0, 0.32, -20), new Vector3(5.2, 0.32, 820), mats.median);
  box("plan-grand-sidewalk-west", new Vector3(-20, 0.25, -20), new Vector3(6, 0.18, 830), mats.sidewalk);
  box("plan-grand-sidewalk-east", new Vector3(20, 0.25, -20), new Vector3(6, 0.18, 830), mats.sidewalk);

  // Fixed crossings. Their locations match water corridors from the master plan.
  for (const item of MIRAGE_BRIDGES) {
    bridge(`plan-bridge-${item.id}`, item.from, item.to, item.width, item.deckY, item.railings !== false);
  }

  // Elevated freeway has a fixed alignment and fixed piers.
  const freewayPoints = MIRAGE_ELEVATED_FREEWAY.points.map((point) => toVector(point, MIRAGE_ELEVATED_FREEWAY.deckY));
  for (let i = 0; i < freewayPoints.length - 1; i++) {
    const a = freewayPoints[i];
    const b = freewayPoints[i + 1];
    deckBetween(`plan-freeway-${i}`, a, b, MIRAGE_ELEVATED_FREEWAY.width, 0.55, mats.expressway, true);
    const mid = a.add(b).scale(0.5);
    box(`plan-freeway-pier-${i}`, new Vector3(mid.x, MIRAGE_ELEVATED_FREEWAY.deckY * 0.5, mid.z), new Vector3(3.0, MIRAGE_ELEVATED_FREEWAY.deckY, 3.0), mats.darkConcrete);
  }

  const root = getBasePath("city-kit");
  const templates = new Map<BuildingTemplateName, Template>();
  for (const file of BUILDING_FILES) {
    try {
      templates.set(file, await loadTemplate(scene, root, `${file}.gltf`));
    } catch (error) {
      console.warn(`Master plan could not load ${file}`, error);
    }
  }

  let buildingIndex = 0;
  for (const row of MIRAGE_BUILDING_ROWS) {
    const start = toVector(row.start);
    const end = toVector(row.end);
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.max(0.01, Math.hypot(dx, dz));
    const ux = dx / length;
    const uz = dz / length;
    const nx = -uz;
    const nz = ux;
    const startTrim = row.startTrim ?? row.spacing * 0.45;
    const endTrim = row.endTrim ?? row.spacing * 0.45;
    const usable = Math.max(0, length - startTrim - endTrim);
    const slots = Math.max(1, Math.floor(usable / row.spacing) + 1);
    const yaw = Math.atan2(-dz, dx);

    for (let i = 0; i < slots; i++) {
      const distance = slots === 1 ? length * 0.5 : startTrim + (usable * i) / (slots - 1);
      const x = start.x + ux * distance + nx * row.setback * row.side;
      const z = start.z + uz * distance + nz * row.setback * row.side;
      const templateName = row.templates[i % row.templates.length];
      const template = templates.get(templateName);
      if (!template) continue;

      createInstance(
        template,
        `plan-building-${row.district}-${row.id}-${buildingIndex}`,
        new Vector3(x, 0.28, z),
        row.width,
        row.depth,
        row.height * (1 + (i % 3) * 0.08),
        yaw + (row.side === 1 ? Math.PI : 0),
      );

      // Simple static footprint collider keeps the authored street walls physically readable.
      const colliderHeight = 15 * row.height;
      const collider = box(
        `plan-building-collider-${buildingIndex}`,
        new Vector3(x, colliderHeight * 0.5, z),
        new Vector3(row.width * 0.82, colliderHeight, row.depth * 0.82),
        mats.darkConcrete,
        true,
      );
      collider.isVisible = false;
      buildingIndex++;
    }
  }

  // Fixed landmark lots.
  for (const landmark of MIRAGE_LANDMARKS) {
    const [width, depth, height] = landmark.size;
    const [x, z] = landmark.position;
    const material = landmark.kind === "tech" ? mats.tech
      : landmark.kind === "market" ? mats.market
      : landmark.kind === "industrial" ? mats.industrial
      : landmark.kind === "hotel" ? mats.hotel
      : landmark.kind === "villa" ? mats.villa
      : landmark.kind === "casino" ? mats.neonPink
      : mats.civic;

    box(`plan-landmark-${landmark.id}`, new Vector3(x, height * 0.5, z), new Vector3(width, height, depth), material, true);
    if (landmark.kind === "casino" || landmark.kind === "tech") {
      box(`plan-landmark-${landmark.id}-accent`, new Vector3(x, height * 0.72, z - depth * 0.51), new Vector3(width * 0.60, 3.0, 0.8), landmark.kind === "casino" ? mats.neonBlue : mats.neonBlue);
    } else {
      box(`plan-landmark-${landmark.id}-glass`, new Vector3(x, height * 0.55, z - depth * 0.51), new Vector3(width * 0.52, height * 0.42, 0.8), mats.glass);
    }
  }

  // Neon pylons are fixed to the entertainment strip, not randomly scattered.
  for (let i = 0; i < 12; i++) {
    const x = -220 + i * 40;
    box(`plan-neon-pylon-n-${i}`, new Vector3(x, 4.2, -63), new Vector3(0.9, 8.4, 0.9), i % 2 === 0 ? mats.neonBlue : mats.neonPink);
    box(`plan-neon-pylon-s-${i}`, new Vector3(x, 4.2, -147), new Vector3(0.9, 8.4, 0.9), i % 2 === 0 ? mats.neonPink : mats.neonBlue);
  }

  return count + buildingIndex;
}
