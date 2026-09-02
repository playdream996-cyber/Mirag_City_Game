import {
  Color3,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";

const MAX_HEALTH = 100;
const HIT_REACTION_DURATION = 0.24;
const DEATH_RESPAWN_DELAY = 1.8;
const MELEE_RANGE = 2.35;
const MELEE_HALF_ANGLE_COS = Math.cos((65 * Math.PI) / 180);

export class CombatTarget {
  public readonly root: TransformNode;

  private readonly spawnPosition: Vector3;
  private readonly bodyMaterial: StandardMaterial;
  private health = MAX_HEALTH;
  private hitReactionTimer = 0;
  private respawnTimer = 0;
  private alive = true;
  private lastHit = false;

  constructor(scene: Scene, position: Vector3) {
    this.spawnPosition = position.clone();
    this.root = new TransformNode("combatTargetRoot", scene);
    this.root.position.copyFrom(position);

    this.bodyMaterial = new StandardMaterial("combatTargetMaterial", scene);
    this.bodyMaterial.diffuseColor = new Color3(0.78, 0.20, 0.18);
    this.bodyMaterial.specularColor = new Color3(0.08, 0.08, 0.08);

    const body = MeshBuilder.CreateCapsule(
      "combatTargetBody",
      { height: 1.45, radius: 0.34 },
      scene,
    );
    body.parent = this.root;
    body.position.y = 0.84;
    body.material = this.bodyMaterial;
    body.isPickable = false;

    const head = MeshBuilder.CreateSphere(
      "combatTargetHead",
      { diameter: 0.52, segments: 16 },
      scene,
    );
    head.parent = this.root;
    head.position.y = 1.72;
    head.material = this.bodyMaterial;
    head.isPickable = false;
  }

  update(dt: number): void {
    this.lastHit = false;

    if (!this.alive) {
      this.respawnTimer = Math.max(0, this.respawnTimer - dt);
      if (this.respawnTimer === 0) this.respawn();
      return;
    }

    this.hitReactionTimer = Math.max(0, this.hitReactionTimer - dt);
    if (this.hitReactionTimer > 0) {
      const progress = this.hitReactionTimer / HIT_REACTION_DURATION;
      this.root.rotation.z = Math.sin(progress * Math.PI) * 0.22;
      this.bodyMaterial.emissiveColor.copyFromFloats(0.45 * progress, 0.03, 0.03);
    } else {
      this.root.rotation.z = 0;
      this.bodyMaterial.emissiveColor.copyFromFloats(0, 0, 0);
    }
  }

  tryReceiveMeleeHit(origin: Vector3, facing: Vector3, damage: number): boolean {
    if (!this.alive) return false;

    const toTarget = this.root.position.subtract(origin);
    toTarget.y = 0;
    const distance = toTarget.length();
    if (distance > MELEE_RANGE || distance < 0.001) return false;

    toTarget.scaleInPlace(1 / distance);
    const horizontalFacing = facing.clone();
    horizontalFacing.y = 0;
    if (horizontalFacing.lengthSquared() < 0.0001) return false;
    horizontalFacing.normalize();

    if (Vector3.Dot(horizontalFacing, toTarget) < MELEE_HALF_ANGLE_COS) return false;

    this.health = Math.max(0, this.health - damage);
    this.hitReactionTimer = HIT_REACTION_DURATION;
    this.lastHit = true;

    // Small visual knockback. This dummy has no gameplay physics yet; actual NPC
    // knockback will later feed into the pedestrian/enemy controller.
    this.root.position.addInPlace(toTarget.scale(0.16));

    if (this.health === 0) {
      this.alive = false;
      this.respawnTimer = DEATH_RESPAWN_DELAY;
      this.root.setEnabled(false);
    }

    return true;
  }

  getHealth(): number {
    return this.health;
  }

  getMaxHealth(): number {
    return MAX_HEALTH;
  }

  isAlive(): boolean {
    return this.alive;
  }

  wasHitThisFrame(): boolean {
    return this.lastHit;
  }

  getDistanceFrom(position: Vector3): number {
    const delta = this.root.position.subtract(position);
    delta.y = 0;
    return delta.length();
  }

  private respawn(): void {
    this.health = MAX_HEALTH;
    this.alive = true;
    this.hitReactionTimer = 0;
    this.root.position.copyFrom(this.spawnPosition);
    this.root.rotation.copyFromFloats(0, 0, 0);
    this.bodyMaterial.emissiveColor.copyFromFloats(0, 0, 0);
    this.root.setEnabled(true);
  }
}
