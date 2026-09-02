import { Color4, Engine, Scene, Vector3 } from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, StackPanel, TextBlock } from "@babylonjs/gui";
import { InputController } from "./game/InputController";
import { PlayerController } from "./game/PlayerController";
import { VehicleController } from "./game/VehicleController";
import { TrafficManager } from "./game/TrafficManager";
import { PedestrianManager } from "./game/PedestrianManager";
import { buildWorld } from "./game/WorldBuilder";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });

const scene = new Scene(engine);
scene.clearColor = new Color4(0.62, 0.82, 0.96, 1);
scene.collisionsEnabled = true;

buildWorld(scene);

const input = new InputController(scene);
const player = new PlayerController(scene, input);
const vehicle = new VehicleController(scene, input, new Vector3(14, 0.65, 8));
const traffic = new TrafficManager(scene);
const pedestrians = new PedestrianManager(scene);

player.attachCamera(canvas);
scene.activeCamera = player.camera;

let driving = false;

const ui = AdvancedDynamicTexture.CreateFullscreenUI("UI");
const panel = new StackPanel();
panel.width = "420px";
panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
panel.paddingTop = "18px";
panel.paddingLeft = "18px";
ui.addControl(panel);

const title = new TextBlock();
title.text = "MIRAG CITY — PHASE 4";
title.height = "36px";
title.color = "white";
title.fontSize = 21;
title.fontWeight = "700";
title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
panel.addControl(title);

const info = new TextBlock();
info.height = "124px";
info.color = "#e8edf7";
info.fontSize = 15;
info.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
panel.addControl(info);

function enterVehicle() {
  driving = true;
  vehicle.setOccupied(true);
  player.setEnabled(false);
  player.detachCamera(canvas);
  vehicle.attachCamera(canvas);
  scene.activeCamera = vehicle.camera;
}

function exitVehicle() {
  driving = false;
  vehicle.setOccupied(false);
  vehicle.detachCamera(canvas);

  const right = new Vector3(
    Math.cos(vehicle.root.rotation.y),
    0,
    -Math.sin(vehicle.root.rotation.y),
  );
  player.teleport(vehicle.root.position.add(right.scale(2.2)).add(new Vector3(0, 0.45, 0)));
  player.setEnabled(true);
  player.attachCamera(canvas);
  scene.activeCamera = player.camera;
}

engine.runRenderLoop(() => {
  const dt = engine.getDeltaTime() / 1000;

  if (input.consumeInteract()) {
    if (driving) {
      exitVehicle();
    } else if (vehicle.distanceTo(player.root.position) <= 3.2) {
      enterVehicle();
    }
  }

  player.update(dt);
  vehicle.update(dt);
  traffic.update(dt);
  pedestrians.update(dt);

  const nearVehicle = !driving && vehicle.distanceTo(player.root.position) <= 3.2;
  info.text = driving
    ? "W/S Accelerate & Reverse • A/D Steer\nE Exit Vehicle • Mouse Orbit / Zoom\n9 AI traffic cars active • 18 pedestrians roaming"
    : `WASD Move • Shift Sprint • Space Jump\nE Enter Vehicle${nearVehicle ? "  ← VEHICLE IN RANGE" : ""}\n9 AI traffic cars active • 18 pedestrians roaming`;

  scene.render();
});

window.addEventListener("resize", () => engine.resize());
