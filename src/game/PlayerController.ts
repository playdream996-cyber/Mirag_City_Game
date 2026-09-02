import {
  ArcRotateCamera,
  MeshBuilder,
  Scalar,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
  Color3,
} from "@babylonjs/core";
import { InputController } from "./InputController";

export class PlayerController {
  public readonly root: TransformNode;
  public readonly camera: ArcRotateCamera;

  private verticalVelocity = 0;
  private grounded = true;

  constructor(
    private readonly scene: Scene,
    private readonly input: InputController,
  ) {
    this.root = new TransformNode("playerRoot", scene);
    this.root.position = new Vector3(8, 1.1, 8);

    const material = new StandardMaterial("playerMaterial", scene);
    material.diffuseColor = new Color3(0.15, 0.37, 0.88);

    const body = MeshBuilder.CreateCapsule("player", { height: 2.2, radius: 0.55 }, scene);
    body.parent = this.root;
    body.material = material;
    body.checkCollisions = true;

    this.camera = new ArcRotateCamera(
      "camera",
      -Math.PI / 2,
      1.1,
      9,
      this.root.position.clone(),
      scene,
    );
    this.camera.lowerRadiusLimit = 5;
    this.camera.upperRadiusLimit = 13;
    this.camera.lowerBetaLimit = 0.55;
    this.camera.upperBetaLimit = 1.45;
    this.camera.wheelPrecision = 40;
  }

  attachCamera(canvas: HTMLCanvasElement) {
    this.camera.attachControl(canvas, true);
  }

  update(dt: number) {
    this.camera.target = Vector3.Lerp(
      this.camera.target,
      this.root.position.add(new Vector3(0, 1.0, 0)),
      0.15,
    );

    const forward = this.camera.target.subtract(this.camera.position);
    forward.y = 0;
    forward.normalize();
    const right = Vector3.Cross(forward, Vector3.Up()).normalize();

    const move = Vector3.Zero();
    const state = this.input.state;
    if (state.forward) move.addInPlace(forward);
    if (state.back) move.subtractInPlace(forward);
    if (state.right) move.addInPlace(right);
    if (state.left) move.subtractInPlace(right);

    const horizontal = Vector3.Zero();
    if (move.lengthSquared() > 0.001) {
      move.normalize();
      const speed = state.sprint ? 9 : 5;
      horizontal.copyFrom(move.scale(speed * dt));
      this.root.rotation.y = Scalar.Lerp(
        this.root.rotation.y,
        Math.atan2(move.x, move.z),
        Math.min(1, dt * 12),
      );
    }

    if (this.input.consumeJump() && this.grounded) {
      this.verticalVelocity = 7.2;
      this.grounded = false;
    }

    this.verticalVelocity += -19.6 * dt;
    const displacement = new Vector3(horizontal.x, this.verticalVelocity * dt, horizontal.z);

    // Phase 2 collision movement. This will be swapped to Babylon's Havok
    // PhysicsCharacterController once the world colliders are migrated to Physics V2.
    const body = this.scene.getMeshByName("player");
    if (body) body.moveWithCollisions(displacement);
    else this.root.position.addInPlace(displacement);

    if (this.root.position.y <= 1.1) {
      this.root.position.y = 1.1;
      this.verticalVelocity = 0;
      this.grounded = true;
    }
  }
}
