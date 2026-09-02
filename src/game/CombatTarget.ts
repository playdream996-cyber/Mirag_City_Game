import {
  AbstractMesh,
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import {
  AdvancedDynamicTexture,
  Control,
  Rectangle,
  TextBlock,
} from "@babylonjs/gui";

const MAX_HEALTH = 100;
const HIT_REACTION_DURATION = 0.24;
const DEATH_RESPAWN_DELAY = 1.8;
const MELEE_RANGE = 2.35;
const MELEE_HALF_ANGLE_COS = Math.cos((65 * Math.PI) / 180);
const HP_BAR_Y = 2.28;
const DAMAGE_POPUP_DURATION = 0.48;

export class CombatTarget {
  public readonly root: TransformNode;

  private readonly spawnPosition: Vector3;
  private readonly bodyMaterial: StandardMaterial;
  private readonly healthBarPlane: Mesh;
  private readonly healthFill: Rectangle;
  private readonly healthLabel: TextBlock;
  private readonly damagePlane: Mesh;
  private readonly damageText: TextBlock;

  private health = MAX_HEALTH;
  private displayedHealth = MAX_HEALTH;
  private hitReactionTimer = 0;
  private respawnTimer = 0;
  private damagePopupTimer = 0;
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

    const hp = this.createHealthBar(scene);
    this.healthBarPlane = hp.plane;
    this.healthFill = hp.fill;
    this.healthLabel = hp.label;

    const popup = this.createDamagePopup(scene);
    this.damagePlane = popup.plane;
    this.damageText = popup.text;

    this.updateHealthBar(true);
  }

  update(dt: number): void {
    this.lastHit = false;

    if (!this.alive) {
      this.respawnTimer = Math.max(0, this.respawnTimer - dt);
      if (this.respawnTimer === 0) this.respawn();
      return;
    }

    // Smoothly chase the real HP value rather than snapping the bar instantly.
    const healthLerp = Math.min(1, dt * 10);
    this.displayedHealth += (this.health - this.displayedHealth) * healthLerp;
    if (Math.abs(this.displayedHealth - this.health) < 0.05) this.displayedHealth = this.health;
    this.updateHealthBar(false);

    this.hitReactionTimer = Math.max(0, this.hitReactionTimer - dt);
    if (this.hitReactionTimer > 0) {
      const progress = this.hitReactionTimer / HIT_REACTION_DURATION;
      this.root.rotation.z = Math.sin(progress * Math.PI) * 0.22;
      this.bodyMaterial.emissiveColor.copyFromFloats(0.45 * progress, 0.03, 0.03);
    } else {
      this.root.rotation.z = 0;
      this.bodyMaterial.emissiveColor.copyFromFloats(0, 0, 0);
    }

    this.damagePopupTimer = Math.max(0, this.damagePopupTimer - dt);
    if (this.damagePopupTimer > 0) {
      const life = this.damagePopupTimer / DAMAGE_POPUP_DURATION;
      const elapsed = 1 - life;
      this.damagePlane.setEnabled(true);
      this.damagePlane.position.y = 2.52 + elapsed * 0.48;
      this.damageText.alpha = Math.min(1, life * 2.2);
    } else {
      this.damagePlane.setEnabled(false);
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
    this.showDamagePopup(damage);

    // Small visual knockback. This dummy has no gameplay physics yet; actual NPC
    // knockback will later feed into the pedestrian/enemy controller.
    this.root.position.addInPlace(toTarget.scale(0.16));

    if (this.health === 0) {
      this.alive = false;
      this.respawnTimer = DEATH_RESPAWN_DELAY;
      this.healthBarPlane.setEnabled(false);
      this.damagePlane.setEnabled(false);
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

  private createHealthBar(scene: Scene): {
    plane: Mesh;
    fill: Rectangle;
    label: TextBlock;
  } {
    const plane = MeshBuilder.CreatePlane(
      "combatTargetHealthBar",
      { width: 1.55, height: 0.34 },
      scene,
    );
    plane.parent = this.root;
    plane.position.y = HP_BAR_Y;
    plane.billboardMode = AbstractMesh.BILLBOARDMODE_ALL;
    plane.isPickable = false;

    const ui = AdvancedDynamicTexture.CreateForMesh(plane, 512, 112, false);

    const background = new Rectangle("combatTargetHealthBackground");
    background.width = 0.94;
    background.height = 0.54;
    background.cornerRadius = 18;
    background.thickness = 4;
    background.color = "#101218";
    background.background = "#281316";
    ui.addControl(background);

    const fill = new Rectangle("combatTargetHealthFill");
    fill.width = 1;
    fill.height = 1;
    fill.cornerRadius = 13;
    fill.thickness = 0;
    fill.background = "#3ed05b";
    fill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    background.addControl(fill);

    const label = new TextBlock("combatTargetHealthLabel");
    label.text = `${MAX_HEALTH} / ${MAX_HEALTH}`;
    label.color = "white";
    label.fontSize = 31;
    label.fontWeight = "700";
    label.outlineWidth = 3;
    label.outlineColor = "#111111";
    ui.addControl(label);

    return { plane, fill, label };
  }

  private createDamagePopup(scene: Scene): { plane: Mesh; text: TextBlock } {
    const plane = MeshBuilder.CreatePlane(
      "combatTargetDamagePopup",
      { width: 1.25, height: 0.48 },
      scene,
    );
    plane.parent = this.root;
    plane.position.y = 2.52;
    plane.billboardMode = AbstractMesh.BILLBOARDMODE_ALL;
    plane.isPickable = false;

    const ui = AdvancedDynamicTexture.CreateForMesh(plane, 320, 128, false);
    const text = new TextBlock("combatTargetDamageText");
    text.text = "-20";
    text.color = "#ffd34d";
    text.fontSize = 72;
    text.fontWeight = "800";
    text.outlineWidth = 5;
    text.outlineColor = "#4a130c";
    ui.addControl(text);

    plane.setEnabled(false);
    return { plane, text };
  }

  private showDamagePopup(damage: number): void {
    this.damageText.text = `-${damage}`;
    this.damageText.alpha = 1;
    this.damagePlane.position.y = 2.52;
    this.damagePopupTimer = DAMAGE_POPUP_DURATION;
    this.damagePlane.setEnabled(true);
  }

  private updateHealthBar(force: boolean): void {
    const ratio = Math.max(0, Math.min(1, this.displayedHealth / MAX_HEALTH));
    this.healthFill.width = Math.max(0.001, ratio);
    this.healthLabel.text = `${Math.ceil(this.health)} / ${MAX_HEALTH}`;

    if (ratio > 0.6) this.healthFill.background = "#3ed05b";
    else if (ratio > 0.3) this.healthFill.background = "#f2b93b";
    else this.healthFill.background = "#ef4444";

    if (force) this.healthBarPlane.setEnabled(this.alive);
  }

  private respawn(): void {
    this.health = MAX_HEALTH;
    this.displayedHealth = MAX_HEALTH;
    this.alive = true;
    this.hitReactionTimer = 0;
    this.damagePopupTimer = 0;
    this.root.position.copyFrom(this.spawnPosition);
    this.root.rotation.copyFromFloats(0, 0, 0);
    this.bodyMaterial.emissiveColor.copyFromFloats(0, 0, 0);
    this.root.setEnabled(true);
    this.healthBarPlane.setEnabled(true);
    this.damagePlane.setEnabled(false);
    this.updateHealthBar(true);
  }
}
