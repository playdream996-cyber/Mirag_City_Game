import { CharacterSupportedState, Color4, Engine, Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, StackPanel, TextBlock } from "@babylonjs/gui";
import { InputController } from "./game/InputController";
import { PhysicsManager } from "./game/PhysicsManager";
import { PlayerController } from "./game/PlayerController";
import { buildWorld } from "./game/WorldBuilder";

const BUILD_ID = "phase2-capsulefix-2026-09-02-02";

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

  player.attachCamera(canvas);
  scene.activeCamera = player.camera;

  const ui = AdvancedDynamicTexture.CreateFullscreenUI("UI");
  const panel = new StackPanel();
  panel.width = "590px";
  panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  panel.paddingTop = "18px";
  panel.paddingLeft = "18px";
  ui.addControl(panel);

  const title = new TextBlock();
  title.text = "MIRAG CITY — PHASE 2 CHARACTER FOUNDATION";
  title.height = "38px";
  title.color = "white";
  title.fontSize = 20;
  title.fontWeight = "700";
  title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  panel.addControl(title);

  const info = new TextBlock();
  info.height = "260px";
  info.color = "#e8edf7";
  info.fontSize = 15;
  info.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  panel.addControl(info);

  engine.runRenderLoop(() => {
    const dt = engine.getDeltaTime() / 1000;
    player.update(dt);

    const velocity = player.getVelocity();
    const desired = player.getDesiredVelocity();
    info.text = [
      `Build: ${BUILD_ID}`,
      "WASD Move • Shift Sprint • Space Jump • Mouse Orbit",
      `Input: ${player.hasMovementInput() ? "MOVING" : "IDLE"}`,
      `Sprint key: ${player.isSprintActive() ? "DOWN" : "UP"}`,
      `Jump triggered this frame: ${player.wasJumpTriggered() ? "YES" : "NO"}`,
      `Desired velocity: ${desired.x.toFixed(2)}, ${desired.y.toFixed(2)}, ${desired.z.toFixed(2)}`,
      `Physics velocity: ${velocity.x.toFixed(2)}, ${velocity.y.toFixed(2)}, ${velocity.z.toFixed(2)}`,
      `Support: ${supportLabel(player.getSupportState())} • Grounded: ${player.isGrounded() ? "YES" : "NO"}`,
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
