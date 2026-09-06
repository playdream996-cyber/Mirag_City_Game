import "@babylonjs/loaders/glTF";
import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  SceneLoader,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import { PhysicsManager } from "./PhysicsManager";

type CityTemplate = {
  root: TransformNode;
  width: number;
  depth: number;
  minY: number;
};

const CITY_BUILDINGS = ["Building_Large_2", "Building_Medium_2_001", "Building_Small_1"] as const;

async function loadTemplate(scene: Scene, assetRoot: string, name: string): Promise<CityTemplate> {
  const result = await SceneLoader.ImportMeshAsync(null, assetRoot, `${name}.gltf`, scene);
  const root = new TransformNode(`city-template-${name}`, scene);
  const importedMeshes = result.meshes.filter((mesh): mesh is Mesh => mesh instanceof Mesh);
  const topLevelMeshes = result.meshes.filter((mesh) => !mesh.parent);

  for (const mesh of topLevelMeshes) mesh.parent = root;
  for (const mesh of importedMeshes) {
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    mesh.computeWorldMatrix(true);
  }

  let min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  let max = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
  for (const mesh of importedMeshes) {
    const bounds = mesh.getBoundingInfo().boundingBox;
    min = Vector3.Minimize(min, bounds.minimumWorld);
    max = Vector3.Maximize(max, bounds.maximumWorld);
  }

  for (const animation of result.animationGroups) animation.stop();
  root.setEnabled(false);

  return {
    root,
    width: Math.max(0.01, max.x - min.x),
    depth: Math.max(0.01, max.z - min.z),
    minY: min.y,
  };
}

function getAssetRoot(): string {
  const path = window.location.pathname;
  const repoBase = path.startsWith("/Mirag_City_Game/") ? "/Mirag_City_Game/" : "/";
  return `${repoBase}assets/city-kit/`;
}

export async function buildCityExpansion(scene: Scene, physics: PhysicsManager): Promise<number> {
  for (const boundaryName of ["north-boundary", "south-boundary", "east-boundary", "west-boundary"]) {
    const boundary = scene.getTransformNodeByName(boundaryName) ?? scene.getMeshByName(boundaryName);
    if (boundary) {
      physics.removeStaticBox(boundary);
      boundary.dispose();
    }
  }

  const makeMaterial = (name: string, color: Color3) => {
    const material = new StandardMaterial(name, scene);
    material.diffuseColor = color;
    material.specularColor = new Color3(0.06, 0.06, 0.06);
    return material;
  };

  const groundMat = makeMaterial("outer-city-ground", new Color3(0.19, 0.28, 0.2));
  const roadMat = makeMaterial("outer-city-road", new Color3(0.055, 0.06, 0.07));
  const fallbackMats = [
    makeMaterial("outer-city-building-a", new Color3(0.32, 0.37, 0.42)),
    makeMaterial("outer-city-building-b", new Color3(0.47, 0.42, 0.36)),
    makeMaterial("outer-city-building-c", new Color3(0.28, 0.3, 0.34)),
  ];

  const ground = MeshBuilder.CreateBox("outer-city-ground", { width: 1500, height: 0.35, depth: 1500 }, scene);
  ground.position.y = -0.18;
  ground.material = groundMat;
  ground.receiveShadows = true;
  physics.addStaticBox(ground);

  const roadPositions = [-660, -540, -420, 420, 540, 660];
  for (const z of roadPositions) {
    const road = MeshBuilder.CreateBox(`outer-road-x-${z}`, { width: 1450, height: 0.1, depth: 20 }, scene);
    road.position = new Vector3(0, 0.055, z);
    road.material = roadMat;
  }
  for (const x of roadPositions) {
    const road = MeshBuilder.CreateBox(`outer-road-z-${x}`, { width: 20, height: 0.1, depth: 1450 }, scene);
    road.position = new Vector3(x, 0.055, 0);
    road.material = roadMat;
  }

  const assetRoot = getAssetRoot();
  const templates: CityTemplate[] = [];
  for (const name of CITY_BUILDINGS) {
    try {
      templates.push(await loadTemplate(scene, assetRoot, name));
    } catch (error) {
      console.warn(`Could not load city kit model ${name}; keeping procedural fallback.`, error);
    }
  }

  let index = 0;
  let kitBuildingCount = 0;
  for (let x = -690; x <= 690; x += 90) {
    for (let z = -690; z <= 690; z += 90) {
      if (Math.abs(x) < 390 && Math.abs(z) < 390) continue;
      if (roadPositions.some((road) => Math.abs(x - road) < 35 || Math.abs(z - road) < 35)) continue;

      const width = 58;
      const depth = 58;
      const fallbackHeight = 22 + ((index * 17) % 48);
      const collision = MeshBuilder.CreateBox(
        `outer-building-collision-${index}`,
        { width, height: fallbackHeight, depth },
        scene,
      );
      collision.position = new Vector3(x, fallbackHeight / 2, z);
      collision.isVisible = templates.length === 0;
      collision.material = fallbackMats[index % fallbackMats.length];
      physics.addStaticBox(collision);

      if (templates.length > 0) {
        const template = templates[index % templates.length];
        const visual = template.root.clone(`city-kit-building-${index}`, null);
        if (visual) {
          const baseScale = 0.88 * Math.min(width / template.width, depth / template.depth);
          const variation = 0.9 + (index % 5) * 0.04;
          const scale = baseScale * variation;
          visual.scaling.setAll(scale);
          visual.rotation.y = (index % 4) * (Math.PI / 2);
          visual.position = new Vector3(x, -template.minY * scale, z);
          visual.setEnabled(true);
          kitBuildingCount++;
        } else {
          collision.isVisible = true;
        }
      }

      index++;
    }
  }

  return kitBuildingCount;
}
