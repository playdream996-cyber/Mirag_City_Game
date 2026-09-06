import { Color3, MeshBuilder, Scene, StandardMaterial, TransformNode, Vector3 } from "@babylonjs/core";

type TrafficCar = {
  root: TransformNode;
  route: Vector3[];
  targetIndex: number;
  speed: number;
};

export class TrafficManager {
  private readonly cars: TrafficCar[] = [];

  constructor(private readonly scene: Scene) {
    const routes = [
      this.horizontalLoop(-225),
      this.horizontalLoop(-75),
      this.horizontalLoop(75),
      this.horizontalLoop(225),
      this.verticalLoop(-225),
      this.verticalLoop(-75),
      this.verticalLoop(75),
      this.verticalLoop(225),
      this.innerRingRoute(),
      this.outerRingRoute(),
      this.boulevardRoute(),
      this.portRoute(),
    ];

    const colors = [
      new Color3(0.85, 0.15, 0.12),
      new Color3(0.12, 0.55, 0.85),
      new Color3(0.92, 0.72, 0.12),
      new Color3(0.18, 0.72, 0.42),
      new Color3(0.56, 0.28, 0.82),
      new Color3(0.92, 0.92, 0.92),
      new Color3(0.12, 0.14, 0.18),
      new Color3(0.72, 0.34, 0.12),
      new Color3(0.18, 0.65, 0.68),
      new Color3(0.52, 0.52, 0.56),
    ];

    for (let i = 0; i < 36; i++) {
      const route = routes[i % routes.length];
      const startIndex = (i * 2) % route.length;
      this.cars.push(this.createCar(route, startIndex, colors[i % colors.length], 8 + (i % 6) * 0.9));
    }
  }

  update(dt: number) {
    for (const car of this.cars) {
      const target = car.route[car.targetIndex];
      const toTarget = target.subtract(car.root.position);
      toTarget.y = 0;

      if (toTarget.lengthSquared() < 8) {
        car.targetIndex = (car.targetIndex + 1) % car.route.length;
        continue;
      }

      const dir = toTarget.normalize();
      car.root.position.addInPlace(dir.scale(car.speed * dt));
      car.root.rotation.y = Math.atan2(dir.x, dir.z);
    }
  }

  private createCar(route: Vector3[], startIndex: number, color: Color3, speed: number): TrafficCar {
    const index = this.cars.length;
    const root = new TransformNode(`trafficCar-${index}`, this.scene);
    root.position.copyFrom(route[startIndex]);

    const bodyMat = new StandardMaterial(`trafficMat-${index}`, this.scene);
    bodyMat.diffuseColor = color;
    bodyMat.specularColor = new Color3(0.15, 0.15, 0.15);

    const body = MeshBuilder.CreateBox(`trafficBody-${index}`, { width: 1.9, height: 0.72, depth: 4.15 }, this.scene);
    body.parent = root;
    body.position.y = 0.72;
    body.material = bodyMat;

    const cabinMat = new StandardMaterial(`trafficCabinMat-${index}`, this.scene);
    cabinMat.diffuseColor = new Color3(0.08, 0.13, 0.19);
    cabinMat.specularColor = new Color3(0.24, 0.24, 0.24);
    const cabin = MeshBuilder.CreateBox(`trafficCabin-${index}`, { width: 1.55, height: 0.55, depth: 1.9 }, this.scene);
    cabin.parent = root;
    cabin.position = new Vector3(0, 1.25, -0.1);
    cabin.material = cabinMat;

    const rearLightMat = new StandardMaterial(`trafficRear-${index}`, this.scene);
    rearLightMat.diffuseColor = new Color3(0.5, 0.02, 0.02);
    rearLightMat.emissiveColor = new Color3(0.25, 0, 0);
    for (const x of [-0.62, 0.62]) {
      const light = MeshBuilder.CreateBox(`trafficRear-${index}-${x}`, { width: 0.38, height: 0.18, depth: 0.08 }, this.scene);
      light.parent = root;
      light.position = new Vector3(x, 0.78, -2.1);
      light.material = rearLightMat;
    }

    return { root, route, targetIndex: (startIndex + 1) % route.length, speed };
  }

  private horizontalLoop(z: number): Vector3[] {
    const lane = 3.8;
    return [
      new Vector3(-330, 0.35, z + lane),
      new Vector3(330, 0.35, z + lane),
      new Vector3(330, 0.35, z - lane),
      new Vector3(-330, 0.35, z - lane),
    ];
  }

  private verticalLoop(x: number): Vector3[] {
    const lane = 3.8;
    return [
      new Vector3(x + lane, 0.35, -330),
      new Vector3(x + lane, 0.35, 330),
      new Vector3(x - lane, 0.35, 330),
      new Vector3(x - lane, 0.35, -330),
    ];
  }

  private innerRingRoute(): Vector3[] {
    return [
      new Vector3(-225, 0.35, -221),
      new Vector3(225, 0.35, -221),
      new Vector3(229, 0.35, -225),
      new Vector3(229, 0.35, 225),
      new Vector3(225, 0.35, 229),
      new Vector3(-225, 0.35, 229),
      new Vector3(-229, 0.35, 225),
      new Vector3(-229, 0.35, -225),
    ];
  }

  private outerRingRoute(): Vector3[] {
    return [
      new Vector3(-330, 0.35, -336),
      new Vector3(330, 0.35, -336),
      new Vector3(336, 0.35, -330),
      new Vector3(336, 0.35, 330),
      new Vector3(330, 0.35, 336),
      new Vector3(-330, 0.35, 336),
      new Vector3(-336, 0.35, 330),
      new Vector3(-336, 0.35, -330),
    ];
  }

  private boulevardRoute(): Vector3[] {
    return [
      new Vector3(-330, 0.35, 43),
      new Vector3(330, 0.35, 43),
      new Vector3(330, 0.35, 33),
      new Vector3(-330, 0.35, 33),
    ];
  }

  private portRoute(): Vector3[] {
    return [
      new Vector3(150, 0.35, 79),
      new Vector3(300, 0.35, 79),
      new Vector3(304, 0.35, 300),
      new Vector3(225, 0.35, 304),
      new Vector3(146, 0.35, 225),
    ];
  }
}
