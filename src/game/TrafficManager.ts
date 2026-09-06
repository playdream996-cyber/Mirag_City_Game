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
      this.horizontalLoop(-140),
      this.horizontalLoop(0),
      this.horizontalLoop(140),
      this.verticalLoop(-140),
      this.verticalLoop(70),
      this.ringRoute(),
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
    ];

    for (let i = 0; i < 18; i++) {
      const route = routes[i % routes.length];
      const startIndex = i % route.length;
      this.cars.push(this.createCar(route, startIndex, colors[i % colors.length], 7 + (i % 5) * 0.75));
    }
  }

  update(dt: number) {
    for (const car of this.cars) {
      const target = car.route[car.targetIndex];
      const toTarget = target.subtract(car.root.position);
      toTarget.y = 0;

      if (toTarget.lengthSquared() < 5) {
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
    bodyMat.specularColor = new Color3(0.12, 0.12, 0.12);

    const body = MeshBuilder.CreateBox(`trafficBody-${index}`, { width: 1.9, height: 0.72, depth: 4.15 }, this.scene);
    body.parent = root;
    body.position.y = 0.72;
    body.material = bodyMat;

    const cabinMat = new StandardMaterial(`trafficCabinMat-${index}`, this.scene);
    cabinMat.diffuseColor = new Color3(0.11, 0.16, 0.22);
    const cabin = MeshBuilder.CreateBox(`trafficCabin-${index}`, { width: 1.55, height: 0.55, depth: 1.9 }, this.scene);
    cabin.parent = root;
    cabin.position = new Vector3(0, 1.25, -0.1);
    cabin.material = cabinMat;

    return { root, route, targetIndex: (startIndex + 1) % route.length, speed };
  }

  private horizontalLoop(z: number): Vector3[] {
    const lane = 3.3;
    return [
      new Vector3(-252, 0.35, z + lane),
      new Vector3(252, 0.35, z + lane),
      new Vector3(252, 0.35, z - lane),
      new Vector3(-252, 0.35, z - lane),
    ];
  }

  private verticalLoop(x: number): Vector3[] {
    const lane = 3.3;
    return [
      new Vector3(x + lane, 0.35, -252),
      new Vector3(x + lane, 0.35, 252),
      new Vector3(x - lane, 0.35, 252),
      new Vector3(x - lane, 0.35, -252),
    ];
  }

  private ringRoute(): Vector3[] {
    return [
      new Vector3(-210, 0.35, -206.5),
      new Vector3(210, 0.35, -206.5),
      new Vector3(213.5, 0.35, -210),
      new Vector3(213.5, 0.35, 210),
      new Vector3(210, 0.35, 213.5),
      new Vector3(-210, 0.35, 213.5),
      new Vector3(-213.5, 0.35, 210),
      new Vector3(-213.5, 0.35, -210),
    ];
  }
}
