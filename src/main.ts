import { CharacterSupportedState, Color4, Engine, Scene, Vector3 } from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, StackPanel, TextBlock } from "@babylonjs/gui";
import { CombatTarget } from "./game/CombatTarget";
import { buildCityExpansion } from "./game/CityExpansion";
import { InputController } from "./game/InputController";
import { MissionManager } from "./game/MissionManager";
import { NavigationSystem } from "./game/NavigationSystem";
import { PedestrianManager } from "./game/PedestrianManager";
import { PhysicsManager } from "./game/PhysicsManager";
import { PlayerController } from "./game/PlayerController";
import { TrafficManager } from "./game/TrafficManager";
import { VehicleController } from "./game/VehicleController";
import { WantedSystem } from "./game/WantedSystem";
import { buildWorld } from "./game/WorldBuilder";

const BUILD_ID = "quaternius-city-environment-2026-09-06";
const COMBO_DAMAGE = [20, 22, 24, 34] as const;
const VEHICLE_INTERACT_DISTANCE = 4.5;
const CAMERA_LOOK_AHEAD = 3.4;
const CAMERA_TARGET_HEIGHT = 1.45;

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
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement | null;
  if (!canvas) throw new Error("renderCanvas element was not found.");

  const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.52, 0.72, 0.88, 1);

  const physics = new PhysicsManager();
  await physics.initialize(scene);
  const world = buildWorld(scene, physics);
  const cityKitBuildingCount = await buildCityExpansion(scene, physics);

  const input = new InputController(scene);
  const player = new PlayerController(scene, input);
  await player.initializeVisual();

  const vehicle = new VehicleController(scene, input, new Vector3(14, 0.65, 8));
  const traffic = new TrafficManager(scene);
  const pedestrians = new PedestrianManager(scene);
  await pedestrians.initializeModels();
  const missions = new MissionManager(scene);
  const navigation = new NavigationSystem();
  const wanted = new WantedSystem();
  const combatTarget = new CombatTarget(scene, new Vector3(8, 0.12, 10.2));

  player.camera.alpha = -Math.PI / 2;
  player.camera.beta = 1.28;
  player.camera.radius = 10.5;
  player.camera.lowerBetaLimit = 0.95;
  player.camera.upperBetaLimit = 1.48;
  player.camera.lowerRadiusLimit = 7.5;
  player.camera.upperRadiusLimit = 14;
  player.camera.panningSensibility = 0;

  player.attachCamera(canvas);
  scene.activeCamera = player.camera;

  const ui = AdvancedDynamicTexture.CreateFullscreenUI("UI");
  const panel = new StackPanel();
  panel.width = "830px";
  panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  panel.paddingTop = "18px";
  panel.paddingLeft = "18px";
  ui.addControl(panel);

  const title = new TextBlock();
  title.text = "MIRAG CITY — OPEN WORLD GAMEPLAY";
  title.height = "38px";
  title.color = "white";
  title.fontSize = 20;
  title.fontWeight = "700";
  title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  panel.addControl(title);

  const info = new TextBlock();
  info.height = "650px";
  info.color = "#eef3fb";
  info.fontSize = 15;
  info.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  panel.addControl(info);

  let previousHitWindow = false;
  let hitFeedbackTimer = 0;
  let lastDamage = 0;
  let vehicleMessage = "Walk near the red car and press E to enter.";

  const updatePlayerCameraTarget = (): void => {
    const forward = new Vector3(Math.sin(player.root.rotation.y), 0, Math.cos(player.root.rotation.y));
    const desiredTarget = player.root.position
      .add(forward.scale(CAMERA_LOOK_AHEAD))
      .add(new Vector3(0, CAMERA_TARGET_HEIGHT, 0));
    player.camera.target = Vector3.Lerp(player.camera.target, desiredTarget, 0.18);
  };

  updatePlayerCameraTarget();

  const enterVehicle = (): void => {
    vehicle.setOccupied(true);
    player.setEnabled(false);
    player.detachCamera(canvas);
    vehicle.attachCamera(canvas);
    scene.activeCamera = vehicle.camera;
    vehicleMessage = "DRIVING — WASD steer/drive • E exit";
  };

  const exitVehicle = (): void => {
    vehicle.setOccupied(false);
    vehicle.detachCamera(canvas);
    const exitPosition = vehicle.root.position.add(new Vector3(3.2, 0, 0));
    player.teleport(exitPosition);
    player.setEnabled(true);
    updatePlayerCameraTarget();
    player.attachCamera(canvas);
    scene.activeCamera = player.camera;
    vehicleMessage = "Exited vehicle.";
  };

  engine.runRenderLoop(() => {
    const dt = Math.min(0.05, Math.max(0, engine.getDeltaTime() / 1000));
    const interactPressed = input.consumeInteract();

    if (vehicle.isOccupied) {
      vehicle.update(dt);
      if (interactPressed) exitVehicle();
    } else {
      player.update(dt);
      updatePlayerCameraTarget();
      if (interactPressed && vehicle.distanceTo(player.root.position) <= VEHICLE_INTERACT_DISTANCE) enterVehicle();
    }

    const actorPosition = vehicle.isOccupied ? vehicle.root.position : player.root.position;
    traffic.update(dt, actorPosition);
    pedestrians.update(dt, actorPosition);
    combatTarget.update(dt);
    wanted.update(dt);
    hitFeedbackTimer = Math.max(0, hitFeedbackTimer - dt);

    const carDistance = vehicle.distanceTo(player.root.position);
    const missionInteract = interactPressed && !vehicle.isOccupied && carDistance > VEHICLE_INTERACT_DISTANCE;
    missions.update(actorPosition, missionInteract);

    const hitWindow = !vehicle.isOccupied && player.isMeleeHitActive();
    if (hitWindow && !previousHitWindow) {
      const comboIndex = Math.max(0, Math.min(3, player.getComboStep() - 1));
      const damage = COMBO_DAMAGE[comboIndex];
      const facing = new Vector3(Math.sin(player.root.rotation.y), 0, Math.cos(player.root.rotation.y));
      if (combatTarget.tryReceiveMeleeHit(player.root.position, facing, damage)) {
        lastDamage = damage;
        hitFeedbackTimer = 0.35;
        wanted.addCrime(0.7);
      }
    }
    previousHitWindow = hitWindow;

    const velocity = vehicle.isOccupied ? Vector3.Zero() : player.getVelocity();
    const desired = vehicle.isOccupied ? Vector3.Zero() : player.getDesiredVelocity();
    const probeDistance = vehicle.isOccupied ? 0 : player.getGroundProbeDistance();
    const floorY = vehicle.isOccupied ? vehicle.root.position.y : player.getGroundPointY();
    const targetDistance = combatTarget.getDistanceFrom(actorPosition);
    const district = world.getDistrictAt(actorPosition);
    const nearestLandmark = world.getNearestLandmark(actorPosition);
    const actorYaw = vehicle.isOccupied ? vehicle.root.rotation.y : player.root.rotation.y;
    const navTarget = missions.getNavigationTarget(actorPosition);
    const navText = navigation.getDirectionText(actorPosition, actorYaw, navTarget, missions.getNavigationLabel(actorPosition));

    if (!vehicle.isOccupied && carDistance <= VEHICLE_INTERACT_DISTANCE) vehicleMessage = "Press E to enter vehicle";
    else if (!vehicle.isOccupied && vehicleMessage === "Press E to enter vehicle") vehicleMessage = "Explore on foot or approach the red car.";

    info.text = [
      `Build: ${BUILD_ID}`,
      `District: ${district} • Nearest activity: ${nearestLandmark}`,
      navText,
      wanted.getHudText(),
      missions.getHudText(),
      `Vehicle: ${vehicle.isOccupied ? "OCCUPIED" : `ON FOOT • car ${carDistance.toFixed(1)}m away`} • ${vehicleMessage}`,
      "Controls: WASD Move/Drive • Shift Sprint • Space Jump • F Punch • E Interact/Vehicle • Mouse Orbit",
      `City: ~1500×1500 • ${cityKitBuildingCount} Quaternius buildings • 54 traffic cars • 72 pedestrians • ${pedestrians.getLoadedModelCount()}/8 uploaded animated NPC variants loaded`,
      `TARGET — HP: ${combatTarget.getHealth()}/${combatTarget.getMaxHealth()} • ${combatTarget.isAlive() ? "ALIVE" : "DOWN / RESPAWNING"} • Distance: ${targetDistance.toFixed(2)}m`,
      `Melee result: ${hitFeedbackTimer > 0 ? `HIT -${lastDamage} HP` : "--"}`,
      `Mode: ${vehicle.isOccupied ? "DRIVING" : player.hasMovementInput() ? "MOVING" : "IDLE"} • Sprint: ${!vehicle.isOccupied && player.isSprintActive() ? "DOWN" : "UP"}`,
      `Combo punch: ${vehicle.isOccupied ? "disabled in vehicle" : `${player.getComboStep()}/4 • Hit window: ${hitWindow ? "ACTIVE" : "CLOSED"}`}`,
      `Desired velocity: ${desired.x.toFixed(2)}, ${desired.y.toFixed(2)}, ${desired.z.toFixed(2)}`,
      `Physics velocity: ${velocity.x.toFixed(2)}, ${velocity.y.toFixed(2)}, ${velocity.z.toFixed(2)}`,
      `Vertical: ${vehicle.isOccupied ? "vehicle mode" : `${player.getVerticalVelocity().toFixed(2)} m/s • Havok: ${supportLabel(player.getSupportState())}`}`,
      `Ground: ${vehicle.isOccupied ? "vehicle" : `${player.isGroundProbeHit() ? `HIT (${probeDistance.toFixed(3)}m)` : "MISS"} • ${player.isGrounded() ? "GROUNDED" : "AIR"}`}`,
      `Floor/actor Y: ${Number.isFinite(floorY) ? floorY.toFixed(3) : "N/A"}`,
      `Animation: ${vehicle.isOccupied ? "DRIVING" : player.getAnimationState().toUpperCase()} • Visual: ${player.isUsingFallbackVisual() ? "fallback capsule" : "player.glb"}`,
    ].join("\n");

    scene.render();
  });

  window.addEventListener("resize", () => engine.resize());
  window.addEventListener("beforeunload", () => {
    input.dispose();
    physics.dispose();
    engine.dispose();
  });
}

bootstrap().catch((error) => {
  console.error("Mirag City bootstrap failed:", error);
  const root = document.getElementById("app");
  if (root) root.innerHTML = `<pre style="padding:24px;color:#fff;background:#260d0d;white-space:pre-wrap">Failed to start Mirag City.\n${String(error)}</pre>`;
});
