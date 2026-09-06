import { Color3, MeshBuilder, Scene, StandardMaterial, Vector3 } from "@babylonjs/core";
import { PhysicsManager } from "./PhysicsManager";

export function buildCityExpansion(scene: Scene, physics: PhysicsManager): void {
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
  const buildingMats = [
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

  let index = 0;
  for (let x = -690; x <= 690; x += 90) {
    for (let z = -690; z <= 690; z += 90) {
      if (Math.abs(x) < 390 && Math.abs(z) < 390) continue;
      const height = 18 + ((index * 17) % 68);
      const width = 42 + ((index * 11) % 22);
      const depth = 42 + ((index * 7) % 22);
      const building = MeshBuilder.CreateBox(
        `outer-building-${index}`,
        { width, height, depth },
        scene,
      );
      building.position = new Vector3(x, height / 2, z);
      building.material = buildingMats[index % buildingMats.length];
      building.receiveShadows = true;
      physics.addStaticBox(building);
      index++;
    }
  }
}
