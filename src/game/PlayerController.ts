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
const GRAVITY_ACCELERATION = -19.6;
const TERMINAL_FALL_SPEED = -45.0;
const ZERO_GRAVITY = Vector3.Zero();
const DOWN = new Vector3(0, -1, 0);
const CAPSULE_HEIGHT = 1.8;
const CAPSULE_RADIUS = 0.42;
const CAPSULE_FEET_OFFSET = CAPSULE_HEIGHT * 0.5 + CAPSULE_RADIUS;
const COYOTE_TIME = 0.16;
const JUMP_BUFFER_TIME = 0.18;
const GROUND_PROBE_START = 0.20;
const GROUND_PROBE_LENGTH = 0.50;
const MAX_GROUND_SNAP_DISTANCE = 0.30;
const GROUND_PENETRATION_TOLERANCE = 0.03;
const INITIAL_SPAWN = new Vector3(8, 0.12, 8);

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
  private verticalVelocity = 0;
  private lastSupportState: CharacterSupportedState = CharacterSupportedState.UNSUPPORTED;
  private groundProbeHit = false;
  private groundProbeDistance = Number.POSITIVE_INFINITY;
  private groundPointY = Number.NaN;
  private visualFeetCorrectionY = 0;

  constructor(
    private readonly scene: Scene,
    private readonly input: InputController,
  ) {
    this.root = new TransformNode("playerRoot", scene);
    // Spawn feet directly on the road surface. The old Y=0 spawn was inside the
    // 0.12 m road collider and Havok could resolve the initial overlap downward.
    this.root.position.copyFrom(INITIAL_SPAWN);

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
    if (!value) {
      this.verticalVelocity = 0;
      this.physicsController.setVelocity(Vector3.Zero());
    }
  }

  teleport(position: Vector3): void {
    this.root.position.copyFrom(position);
    this.physicsController.setPosition(position.add(new Vector3(0, CAPSULE_FEET_OFFSET, 0)));
    this.physicsController.setVelocity(Vector3.Zero());
    this.verticalVelocity = 0;
    this.visualFeetCorrectionY = 0;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
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

  getGroundPointY(): number {
    return this.groundPointY;
  }

  getControllerCenterY(): number {
    return this.physicsController.getPosition().y;
  }

  getComputedFeetY(): number {
    return this.physicsController.getPosition().y - CAPSULE_FEET_OFFSET;
  }

  getVisualFeetY(): number {
    return this.root.position.y;
  }

  getVisualFeetCorrectionY(): number {
    return this.visualFeetCorrectionY;
  }

  getVerticalVelocity(): number {
    return this.verticalVelocity;
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

    this.visualFeetCorrectionY = 0;
    this.syncRootFromPhysics();
    this.updateGroundProbe();

    const support = this.physicsController.checkSupport(safeDt, DOWN);
    this.lastSupportState = support.supportedState;

    // Keep the real physics feet on a nearby detected floor in both directions.
    // Positive gap = hovering above the floor. Negative gap = penetrating below it.
    // The previous version only corrected positive gaps, so Havok could remain SUPPORTED
    // while the capsule was ~20 cm inside the ground after running across surfaces.
    let floorGap = Number.POSITIVE_INFINITY;
    if (this.groundProbeHit && Number.isFinite(this.groundPointY)) {
      floorGap = this.getComputedFeetY() - this.groundPointY;
      if (
        this.verticalVelocity <= 0.1 &&
        Math.abs(floorGap) > GROUND_PENETRATION_TOLERANCE &&
        Math.abs(floorGap) <= MAX_GROUND_SNAP_DISTANCE
      ) {
        const controllerPosition = this.physicsController.getPosition();
        this.physicsController.setPosition(
          new Vector3(
            controllerPosition.x,
            controllerPosition.y - floorGap,
            controllerPosition.z,
          ),
        );
        this.verticalVelocity = 0;
        this.physicsController.setVelocity(
          new Vector3(
            this.physicsController.getVelocity().x,
            0,
            this.physicsController.getVelocity().z,
          ),
        );
        this.syncRootFromPhysics();
        this.updateGroundProbe();
        floorGap = this.groundProbeHit && Number.isFinite(this.groundPointY)
          ? this.getComputedFeetY() - this.groundPointY
          : Number.POSITIVE_INFINITY;
      }
    }

    const havokSupported = support.supportedState !== CharacterSupportedState.UNSUPPORTED;
    const probeSupported =
      this.groundProbeHit &&
      Number.isFinite(floorGap) &&
      floorGap >= -GROUND_PENETRATION_TOLERANCE &&
      floorGap <= MAX_GROUND_SNAP_DISTANCE;
    const hasGroundContact = havokSupported || probeSupported;
    this.grounded = hasGroundContact && this.verticalVelocity <= 0.1;

    if (this.grounded) {
      this.coyoteTimer = COYOTE_TIME;
      if (this.verticalVelocity < 0) this.verticalVelocity = 0;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - safeDt);
    }

    this.camera.target = Vector3.Lerp(
      this.camera.target,
      this.root.position.add(new Vector3(0, 1.25, 0)),
      Math.min(1, safeDt * 10),
    );

    if (this.input.consumeJump()) {
      this.jumpBufferTimer = JUMP_BUFFER_TIME;
    } else {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - safeDt);
    }

    const cameraForward = this.camera.target.subtract(this.camera.position);
    cameraForward.y = 0;
    if (cameraForward.lengthSquared() > 0.0001) cameraForward.normalize();
    else cameraForward.copyFromFloats(0, 0, 1);

    const cameraRight = new Vector3(cameraForward.z, 0, -cameraForward.x).normalize();

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

    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.verticalVelocity = JUMP_SPEED;
      this.grounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.lastJumpTriggered = true;
    } else if (!this.grounded) {
      this.verticalVelocity = Math.max(
        TERMINAL_FALL_SPEED,
        this.verticalVelocity + GRAVITY_ACCELERATION * safeDt,
      );
    }

    const currentVelocity = this.physicsController.getVelocity();
    const horizontalVelocity = this.grounded
      ? new Vector3(desiredVelocity.x, 0, desiredVelocity.z)
      : new Vector3(
          Scalar.Lerp(currentVelocity.x, desiredVelocity.x, Math.min(1, safeDt * AIR_CONTROL)),
          0,
          Scalar.Lerp(currentVelocity.z, desiredVelocity.z, Math.min(1, safeDt * AIR_CONTROL)),
        );

    const outputVelocity = new Vector3(
      horizontalVelocity.x,
      this.verticalVelocity,
      horizontalVelocity.z,
    );

    this.physicsController.setVelocity(outputVelocity);
    this.physicsController.integrate(safeDt, support, ZERO_GRAVITY);

    if (hasMovement) {
      const targetRotation = Math.atan2(inputMove.x, inputMove.z);
      this.root.rotation.y = this.lerpAngle(
        this.root.rotation.y,
        targetRotation,
        Math.min(1, safeDt * 12),
      );
    }

    this.updateAnimation(hasMovement, state.sprint, this.verticalVelocity);
  }

  private syncRootFromPhysics(): void {
    const controllerPosition = this.physicsController.getPosition();
    this.root.position.copyFromFloats(
      controllerPosition.x,
      controllerPosition.y - CAPSULE_FEET_OFFSET,
      controllerPosition.z,
    );
  }

  private updateGroundProbe(): void {
    const physicsFeetY = this.getComputedFeetY();
    const controllerPosition = this.physicsController.getPosition();
    const origin = new Vector3(
      controllerPosition.x,
      physicsFeetY + GROUND_PROBE_START,
      controllerPosition.z,
    );
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
