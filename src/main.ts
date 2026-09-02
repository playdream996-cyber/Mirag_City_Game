import { CharacterSupportedState, Color4, Engine, Scene, Vector3 } from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, StackPanel, TextBlock } from "@babylonjs/gui";
import { CombatTarget } from "./game/CombatTarget";
import { InputController } from "./game/InputController";
import { PhysicsManager } from "./game/PhysicsManager";
import { PlayerController } from "./game/PlayerController";
import { buildWorld } from "./game/WorldBuilder";

const BUILD_ID = "phase2-meleedamage-2026-09-03-17";
const COMBO_DAMAGE = [20, 22, 24, 34] as const;

function supportLabel(state: CharacterSupportedState): string {
  switch (state) {
    case CharacterSupportedState.SUPPORTED:
      return "SUPPORTED";
    case CharacterSupportedState.SLIDING:
      return "SLIDING";
    default:
      return "UNSUPPORTED";
  }
}

async function bootstrap(): Promise<void> {
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });

  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.62, 0.82, 0.96, 1);

  const physics = new PhysicsManager();
  await physics.initialize(scene);
  buildWorld(scene, physics);

  const input = new InputController(scene);
  const player = new PlayerController(scene, input);
  await player.initializeVisual();

  // Temporary combat dummy placed directly in front of the initial player spawn.
  // This validates damage timing before enemy/pedestrian AI is introduced.
  const combatTarget = new CombatTarget(scene, new Vector3(8, 0.12, 10.2));

  player.attachCamera(canvas);
  scene.activeCamera = player.camera;

  const ui = AdvancedDynamicTexture.CreateFullscreenUI("UI");
  const panel = new StackPanel();
  panel.width = "780px";
  panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  panel.paddingTop = "18px";
  panel.paddingLeft = "18px";
  ui.addControl(panel);

  const title = new TextBlock();
  title.text = "MIRAG CITY — PHASE 2 MELEE DAMAGE TEST";
  title.height = "38px";
  title.color = "white";
  title.fontSize = 20;
  title.fontWeight = "700";
  title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  panel.addControl(title);

  const info = new TextBlock();
  info.height = "500px";
  info.color = "#e8edf7";
  info.fontSize = 15;
  info.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  panel.addControl(info);

  let previousHitWindow = false;
  let hitFeedbackTimer = 0;
  let lastDamage = 0;

  engine.runRenderLoop(() => {
    const dt = engine.getDeltaTime() / 1000;
    player.update(dt);
    combatTarget.update(dt);
    hitFeedbackTimer = Math.max(0, hitFeedbackTimer - dt);

    const hitWindow = player.isMeleeHitActive();
    if (hitWindow && !previousHitWindow) {
      const comboIndex = Math.max(0, Math.min(3, player.getComboStep() - 1));
      const damage = COMBO_DAMAGE[comboIndex];
      const facing = new Vector3(
        Math.sin(player.root.rotation.y),
        0,
        Math.cos(player.root.rotation.y),
      );

      if (combatTarget.tryReceiveMeleeHit(player.root.position, facing, damage)) {
        lastDamage = damage;
        hitFeedbackTimer = 0.35;
      }
    }
    previousHitWindow = hitWindow;

    const velocity = player.getVelocity();
    const desired = player.getDesiredVelocity();
    const probeDistance = player.getGroundProbeDistance();
    const floorY = player.getGroundPointY();
    const targetDistance = combatTarget.getDistanceFrom(player.root.position);

    info.text = [
      `Build: ${BUILD_ID}`,
      "WASD Move • Shift Sprint • Space Jump • F Punch • Mouse Orbit",
      `TARGET — HP: ${combatTarget.getHealth()}/${combatTarget.getMaxHealth()} • ${combatTarget.isAlive() ? "ALIVE" : "DOWN / RESPAWNING"} • Distance: ${targetDistance.toFixed(2)}m`,
      `Melee result: ${hitFeedbackTimer > 0 ? `HIT -${lastDamage} HP` : "--"}`,
      `Input: ${player.hasMovementInput() ? "MOVING" : "IDLE"}`,
      `Sprint key: ${player.isSprintActive() ? "DOWN" : "UP"}`,
      `Jump triggered this frame: ${player.wasJumpTriggered() ? "YES" : "NO"}`,
      `Attack triggered this frame: ${player.wasAttackTriggered() ? "YES" : "NO"}`,
      `Combo punch: ${player.getComboStep()}/4 • Hit window: ${hitWindow ? "ACTIVE" : "CLOSED"}`,
      `Desired velocity: ${desired.x.toFixed(2)}, ${desired.y.toFixed(2)}, ${desired.z.toFixed(2)}`,
      `Physics velocity: ${velocity.x.toFixed(2)}, ${velocity.y.toFixed(2)}, ${velocity.z.toFixed(2)}`,
      `Vertical state: ${player.getVerticalVelocity().toFixed(2)} m/s`,
      `Havok support: ${supportLabel(player.getSupportState())}`,
      `Ground probe: ${player.isGroundProbeHit() ? `HIT (${probeDistance.toFixed(3)}m)` : "MISS"} • Grounded: ${player.isGrounded() ? "YES" : "NO"}`,
      `Y debug — center: ${player.getControllerCenterY().toFixed(3)} • physics feet: ${player.getComputedFeetY().toFixed(3)} • visual feet: ${player.getVisualFeetY().toFixed(3)} • floor: ${Number.isFinite(floorY) ? floorY.toFixed(3) : "N/A"}`,
      `Visual correction: ${player.getVisualFeetCorrectionY().toFixed(3)} m`,
      `Animation state: ${player.getAnimationState().toUpperCase()}`,
      `Visual: ${player.isUsingFallbackVisual() ? "fallback capsule (add public/assets/characters/player.glb)" : "player.glb"}`,
    ].join("\n");

    scene.render();
  });

  window.addEventListener("resize", () => engine.resize());
  window.addEventListener("beforeunload", () => {
    input.dispose();
    physics.dispose();
  });
}

bootstrap().catch((error) => {
  console.error("Mirag City bootstrap failed:", error);
  const root = document.getElementById("app");
  if (root) {
    root.innerHTML = `<pre style="padding:24px;color:#fff;background:#260d0d;white-space:pre-wrap">Failed to start Mirag City.\n${String(error)}</pre>`;
  }
});
