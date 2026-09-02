import {
  ArcRotateCamera,
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import { InputController } from "./InputController";

export class VehicleController {
  public readonly root: TransformNode;
  public readonly camera: ArcRotateCamera;
  public readonly body: Mesh;
  public isOccupied = false;

  private speed = 0;
  private steering = 0;

  constructor(
    private readonly scene: Scene,
    private readonly input: InputController,
    position = new Vector3(14, 0.65, 8),
  ) {
    this.root = new TransformNode("vehicleRoot", scene);
    this.root.position.copyFrom(position);

    const paint = new StandardMaterial("vehiclePaint", scene);
    paint.diffuseColor = new Color3(0.75, 0.08, 0.06);

    this.body = MeshBuilder.CreateBox(
      "vehicleBody",
      { width: 2.2, height: 0.8, depth: 4.2 },
      scene,
    );
    this.body.parent = this.root;
    this.body.position.y = 0.45;
    this.body.material = paint;
    this.body.checkCollisions = true;

    const cabin = MeshBuilder.CreateBox(
      "vehicleCabin",
      { width: 1.8, height: 0.75, depth: 1.9 },
      scene,
    );
    cabin.parent = this.root;
    cabin.position = new Vector3(0, 1.05, -0.2);
    cabin.material = paint;

    const wheelMat = new StandardMaterial("wheelMat", scene);
    wheelMat.diffuseColor = new Color3(0.04, 0.04, 0.04);

    const wheelPositions = [
      new Vector3(-1.05, 0.3, 1.35),
      new Vector3(1.05, 0.3, 1.35),
      new Vector3(-1.05, 0.3, -1.35),
      new Vector3(1.05, 0.3, -1.35),
    ];

    for (const p of wheelPositions) {
      const wheel = MeshBuilder.CreateCylinder(
        "wheel",
        { diameter: 0.72, height: 0.42, tessellation: 20 },
        scene,
      );
      wheel.parent = this.root;
      wheel.position.copyFrom(p);
      wheel.rotation.z = Math.PI / 2;
      wheel.material = wheelMat;
    }

    this.camera = new ArcRotateCamera(
      "vehicleCamera",
      -Math.PI / 2,
      1.05,
      12,
      this.root.position.clone(),
      scene,
    );
    this.camera.lowerRadiusLimit = 8;
    this.camera.upperRadiusLimit = 16;
    this.camera.lowerBetaLimit = 0.55;
    this.camera.upperBetaLimit = 1.35;
    this.camera.wheelPrecision = 35;
  }

  attachCamera(canvas: HTMLCanvasElement) {
    this.camera.attachControl(canvas, true);
  }

  detachCamera(_canvas?: HTMLCanvasElement) {
    this.camera.detachControl();
  }

  distanceTo(point: Vector3): number {
    return Vector3.Distance(this.root.position, point);
  }

  setOccupied(value: boolean) {
    this.isOccupied = value;
    this.speed = 0;
  }

  update(dt: number) {
    if (!this.isOccupied) return;

    const state = this.input.state;
    const throttle = (state.forward ? 1 : 0) + (state.back ? -1 : 0);
    const steerInput = (state.left ? -1 : 0) + (state.right ? 1 : 0);

    const accel = 18;
    const brake = 24;
    const drag = 7;
    const maxForward = 22;
    const maxReverse = -8;

    if (throttle > 0) this.speed += accel * dt;
    else if (throttle < 0) this.speed -= brake * dt;
    else {
      if (Math.abs(this.speed) <= drag * dt) this.speed = 0;
      else this.speed -= Math.sign(this.speed) * drag * dt;
    }

    this.speed = Math.max(maxReverse, Math.min(maxForward, this.speed));
    this.steering += (steerInput - this.steering) * Math.min(1, dt * 7);

    if (Math.abs(this.speed) > 0.15) {
      const speedFactor = Math.min(1, Math.abs(this.speed) / 8);
      const direction = this.speed >= 0 ? 1 : -1;
      this.root.rotation.y += this.steering * direction * 1.6 * speedFactor * dt;
    }

    const forward = new Vector3(
      Math.sin(this.root.rotation.y),
      0,
      Math.cos(this.root.rotation.y),
    );
    this.root.position.addInPlace(forward.scale(this.speed * dt));
    this.root.position.y = 0.65;

    this.camera.target = Vector3.Lerp(
      this.camera.target,
      this.root.position.add(new Vector3(0, 1.1, 0)),
      0.18,
    );
  }
}
