import {
  ArcRotateCamera,
  CharacterSupportedState,
  PhysicsCharacterController,
  Ray,
  Scalar,
  Scene,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import { InputController } from "./InputController";
import { CharacterAnimationController, CharacterAnimationState } from "./CharacterAnimationController";
import { CharacterVisual } from "./CharacterVisual";

const WALK_SPEED = 4.8;
const RUN_SPEED = 11.0;
const AIR_CONTROL = 5.0;
const JUMP_SPEED = 8.5;
const GRAVITY = new Vector3(0, -19.6, 0);
const DOWN = new Vector3(0, -1, 0);
const CAPSULE_HEIGHT = 1.8;
const CAPSULE_RADIUS = 0.42;
const CAPSULE_FEET_OFFSET = CAPSULE_HEIGHT * 0.5;
const COYOTE_TIME = 0.16;
const JUMP_BUFFER_TIME = 0.18;
const JUMP_CONTACT_RELEASE = 0.08;
const GROUND_PROBE_START = 0.25;
const GROUND_PROBE_LENGTH = 1.0;
const MAX_GROUND_SNAP_DISTANCE = 0.65;
const GROUND_SKIN = 0.01;

export class PlayerController {
  public readonly root: TransformNode;
  public readonly camera: ArcRotateCamera;

  private readonly physicsController: PhysicsCharacterController;
  private animator: CharacterAnimationController | null = null;
  private visualRoot: TransformNode | null = null;
  private enabled = true;
  private grounded = false;
  private visualFallback = true;
  private lastAnimationState: CharacterAnimationState = "idle";
  private lastDesiredVelocity = Vector3.Zero();
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private lastJumpTriggered = false;
  private jumpAscending = false;
  private lastSupportState: CharacterSupportedState = CharacterSupportedState.UNSUPPORTED;
  private groundProbeHit = false;
  private groundProbeDistance = Number.POSITIVE_INFINITY;
  private groundPointY = Number.NaN;

  constructor(
    private readonly scene: Scene,
    private readonly input: InputController,
  ) {
    this.root = new TransformNode("playerRoot", scene);
    this.root.position = new Vector3(8, 0, 8);

    this.physicsController = new PhysicsCharacterController(
      this.root.position.add(new Vector3(0, CAPSULE_FEET_OFFSET, 0)),
      {
        capsuleHeight: CAPSULE_HEIGHT,
        capsuleRadius: CAPSULE_RADIUS,
      },
      scene,
    );

    this.physicsController.keepDistance = 0.03;
    this.physicsController.keepContactTolerance = 0.08;
    this.physicsController.maxSlopeCosine = Math.cos((50 * Math.PI) / 180);
    this.physicsController.staticFriction = 0.15;
    this.physicsController.dynamicFriction = 0.1;

    this.camera = new ArcRotateCamera(
      "playerCamera",
      -Math.PI / 2,
      1.08,
      8.5,
      this.root.position.add(new Vector3(0, 1.25, 0)),
      scene,
    );
    this.camera.lowerRadiusLimit = 4.5;
    this.camera.upperRadiusLimit = 12;
    this.camera.lowerBetaLimit = 0.55;
    this.camera.upperBetaLimit = 1.45;
    this.camera.wheelPrecision = 40;
  }

  async initializeVisual(): Promise<void> {
    const visual = await CharacterVisual.create(this.scene, this.root);
    this.visualRoot = visual.root;
    this.animator = visual.animator;
    this.visualFallback = visual.usingFallback;
  }

  attachCamera(canvas: HTMLCanvasElement): void {
    this.camera.attachControl(canvas, true);
  }

  detachCamera(_canvas?: HTMLCanvasElement): void {
    this.camera.detachControl();
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
    if (this.visualRoot) this.visualRoot.setEnabled(value);
    if (!value) this.physicsController.setVelocity(Vector3.Zero());
  }

  teleport(position: Vector3): void {
    this.root.position.copyFrom(position);
    this.physicsController.setPosition(position.add(new Vector3(0, CAPSULE_FEET_OFFSET, 0)));
    this.physicsController.setVelocity(Vector3.Zero());
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.jumpAscending = false;
  }

  isUsingFallbackVisual(): boolean {
    return this.visualFallback;
  }

  isGrounded(): boolean {
    return this.grounded;
  }

  getSupportState(): CharacterSupportedState {
    return this.lastSupportState;
  }

  isGroundProbeHit(): boolean {
    return this.groundProbeHit;
  }

  getGroundProbeDistance(): number {
    return this.groundProbeDistance;
  }

  getAnimationState(): CharacterAnimationState {
    return this.lastAnimationState;
  }

  getVelocity(): Vector3 {
    return this.physicsController.getVelocity().clone();
  }

  getDesiredVelocity(): Vector3 {
    return this.lastDesiredVelocity.clone();
  }

  hasMovementInput(): boolean {
    const state = this.input.state;
    return state.forward || state.back || state.left || state.right;
  }

  isSprintActive(): boolean {
    return this.input.isSprintActive();
  }

  wasJumpTriggered(): boolean {
    return this.lastJumpTriggered;
  }

  update(dt: number): void {
    if (!this.enabled) return;
    const safeDt = Math.min(dt, 1 / 20);
    this.lastJumpTriggered = false;

    this.syncRootFromPhysics();

    this.camera.target = Vector3.Lerp(
      this.camera.target,
      this.root.position.add(new Vector3(0, 1.25, 0)),
      Math.min(1, safeDt * 10),
    );

    const up = Vector3.Up();
    const support = this.physicsController.checkSupport(safeDt, DOWN);
    this.lastSupportState = support.supportedState;

    let currentVelocity = this.physicsController.getVelocity();
    this.updateGroundProbe();

    // If Havok leaves the capsule hovering slightly above a visible floor, correct the
    // physics position itself. This keeps physics, gameplay feet, visual feet, and camera
    // on one authoritative Y position instead of hiding the error with a visual offset.
    if (
      this.groundProbeHit &&
      !this.jumpAscending &&
      currentVelocity.y <= 0.1 &&
      this.groundProbeDistance <= MAX_GROUND_SNAP_DISTANCE &&
      Number.isFinite(this.groundPointY)
    ) {
      const p = this.physicsController.getPosition();
      this.physicsController.setPosition(
        new Vector3(p.x, this.groundPointY + CAPSULE_FEET_OFFSET + GROUND_SKIN, p.z),
      );
      currentVelocity = new Vector3(currentVelocity.x, 0, currentVelocity.z);
      this.physicsController.setVelocity(currentVelocity);
      this.syncRootFromPhysics();
      this.updateGroundProbe();
    }

    const havokSupported = support.supportedState !== CharacterSupportedState.UNSUPPORTED;
    const hasGroundContact = havokSupported || this.groundProbeHit;
    this.grounded = hasGroundContact && !this.jumpAscending && currentVelocity.y <= 0.1;

    if (this.grounded) this.coyoteTimer = COYOTE_TIME;
    else this.coyoteTimer = Math.max(0, this.coyoteTimer - safeDt);

    if (this.input.consumeJump()) this.jumpBufferTimer = JUMP_BUFFER_TIME;
    else this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - safeDt);

    const cameraForward = this.camera.target.subtract(this.camera.position);
    cameraForward.y = 0;
    if (cameraForward.lengthSquared() > 0.0001) cameraForward.normalize();
    else cameraForward.copyFromFloats(0, 0, 1);
    const cameraRight = Vector3.Cross(cameraForward, up).normalize();

    const inputMove = Vector3.Zero();
    const state = this.input.state;
    if (state.forward) inputMove.addInPlace(cameraForward);
    if (state.back) inputMove.subtractInPlace(cameraForward);
    if (state.right) inputMove.addInPlace(cameraRight);
    if (state.left) inputMove.subtractInPlace(cameraRight);

    const hasMovement = inputMove.lengthSquared() > 0.001;
    if (hasMovement) inputMove.normalize();

    const desiredSpeed = state.sprint ? RUN_SPEED : WALK_SPEED;
    const desiredVelocity = hasMovement ? inputMove.scale(desiredSpeed) : Vector3.Zero();
    this.lastDesiredVelocity.copyFrom(desiredVelocity);

    let outputVelocity: Vector3;
    if (this.grounded) {
      outputVelocity = new Vector3(desiredVelocity.x, 0, desiredVelocity.z);
    } else {
      outputVelocity = currentVelocity.clone();
      outputVelocity.x = Scalar.Lerp(currentVelocity.x, desiredVelocity.x, Math.min(1, safeDt * AIR_CONTROL));
      outputVelocity.z = Scalar.Lerp(currentVelocity.z, desiredVelocity.z, Math.min(1, safeDt * AIR_CONTROL));
    }

    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      const launchPosition = this.physicsController.getPosition().add(
        new Vector3(0, JUMP_CONTACT_RELEASE, 0),
      );
      this.physicsController.setPosition(launchPosition);
      outputVelocity.y = JUMP_SPEED;
      this.physicsController.setVelocity(outputVelocity);

      this.grounded = false;
      this.jumpAscending = true;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.lastJumpTriggered = true;
    } else {
      this.physicsController.setVelocity(outputVelocity);
    }

    this.physicsController.integrate(safeDt, support, GRAVITY);

    const postVelocity = this.physicsController.getVelocity();
    if (this.jumpAscending && postVelocity.y <= 0) this.jumpAscending = false;

    if (hasMovement) {
      const targetRotation = Math.atan2(inputMove.x, inputMove.z);
      this.root.rotation.y = this.lerpAngle(
        this.root.rotation.y,
        targetRotation,
        Math.min(1, safeDt * 12),
      );
    }

    this.updateAnimation(hasMovement, state.sprint, postVelocity.y);
  }

  private syncRootFromPhysics(): void {
    const controllerPosition = this.physicsController.getPosition();
    this.root.position.copyFrom(
      controllerPosition.subtract(new Vector3(0, CAPSULE_FEET_OFFSET, 0)),
    );
  }

  private updateGroundProbe(): void {
    const origin = this.root.position.add(new Vector3(0, GROUND_PROBE_START, 0));
    const ray = new Ray(origin, DOWN, GROUND_PROBE_LENGTH);
    const hit = this.scene.pickWithRay(
      ray,
      (mesh) =>
        mesh.isEnabled() &&
        mesh.isVisible &&
        (mesh.name === "ground" ||
          mesh.name === "roadX" ||
          mesh.name === "roadZ" ||
          mesh.name === "building"),
      false,
    );

    this.groundProbeHit = !!hit?.hit;
    this.groundProbeDistance = hit?.hit ? hit.distance : Number.POSITIVE_INFINITY;
    this.groundPointY = hit?.hit && hit.pickedPoint ? hit.pickedPoint.y : Number.NaN;
  }

  private updateAnimation(hasMovement: boolean, sprint: boolean, verticalVelocity: number): void {
    let next: CharacterAnimationState;
    if (!this.grounded) next = verticalVelocity > 0.4 ? "jump" : "fall";
    else if (!hasMovement) next = "idle";
    else next = sprint ? "run" : "walk";

    this.lastAnimationState = next;
    this.animator?.setState(next);
  }

  private lerpAngle(from: number, to: number, amount: number): number {
    let delta = (to - from + Math.PI) % (Math.PI * 2) - Math.PI;
    if (delta < -Math.PI) delta += Math.PI * 2;
    return from + delta * amount;
  }
}
