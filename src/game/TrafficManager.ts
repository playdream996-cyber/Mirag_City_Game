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
      this.loopRoute(-70),
      this.loopRoute(0),
      this.loopRoute(70),
    ];

    const colors = [
      new Color3(0.85, 0.15, 0.12),
      new Color3(0.12, 0.55, 0.85),
      new Color3(0.92, 0.72, 0.12),
      new Color3(0.18, 0.72, 0.42),
      new Color3(0.56, 0.28, 0.82),
      new Color3(0.92, 0.92, 0.92),
    ];

    for (let i = 0; i < 9; i++) {
      const route = routes[i % routes.length];
      const startIndex = (i * 2) % route.length;
      this.cars.push(this.createCar(route, startIndex, colors[i % colors.length], 5.5 + (i % 4)));
    }
  }

  update(dt: number) {
    for (const car of this.cars) {
      const target = car.route[car.targetIndex];
      const toTarget = target.subtract(car.root.position);
      toTarget.y = 0;

      if (toTarget.lengthSquared() < 3) {
        car.targetIndex = (car.targetIndex + 1) % car.route.length;
        continue;
      }

      const dir = toTarget.normalize();
      car.root.position.addInPlace(dir.scale(car.speed * dt));
      car.root.rotation.y = Math.atan2(dir.x, dir.z);
    }
  }

  private createCar(route: Vector3[], startIndex: number, color: Color3, speed: number): TrafficCar {
    const root = new TransformNode(`trafficCar-${this.cars.length}`, this.scene);
    root.position.copyFrom(route[startIndex]);

    const bodyMat = new StandardMaterial(`trafficMat-${this.cars.length}`, this.scene);
    bodyMat.diffuseColor = color;

    const body = MeshBuilder.CreateBox(`trafficBody-${this.cars.length}`, { width: 1.9, height: 0.75, depth: 4.1 }, this.scene);
    body.parent = root;
    body.position.y = 0.72;
    body.material = bodyMat;

    const cabinMat = new StandardMaterial(`trafficCabinMat-${this.cars.length}`, this.scene);
    cabinMat.diffuseColor = new Color3(0.16, 0.2, 0.25);
    const cabin = MeshBuilder.CreateBox(`trafficCabin-${this.cars.length}`, { width: 1.55, height: 0.55, depth: 1.9 }, this.scene);
    cabin.parent = root;
    cabin.position = new Vector3(0, 1.25, -0.1);
    cabin.material = cabinMat;

    return { root, route, targetIndex: (startIndex + 1) % route.length, speed };
  }

  private loopRoute(offset: number): Vector3[] {
    const lane = 3.2;
    return [
      new Vector3(-120, 0.35, offset + lane),
      new Vector3(120, 0.35, offset + lane),
      new Vector3(120, 0.35, offset - lane),
      new Vector3(-120, 0.35, offset - lane),
    ];
  }
}
