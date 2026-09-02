import { Color4, Engine, Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, StackPanel, TextBlock } from "@babylonjs/gui";
import { InputController } from "./game/InputController";
import { PlayerController } from "./game/PlayerController";
import { buildWorld } from "./game/WorldBuilder";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });

const scene = new Scene(engine);
scene.clearColor = new Color4(0.62, 0.82, 0.96, 1);
scene.collisionsEnabled = true;

buildWorld(scene);

const input = new InputController(scene);
const player = new PlayerController(scene, input);
player.attachCamera(canvas);

const ui = AdvancedDynamicTexture.CreateFullscreenUI("UI");
const panel = new StackPanel();
panel.width = "340px";
panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
panel.paddingTop = "18px";
panel.paddingLeft = "18px";
ui.addControl(panel);

const title = new TextBlock();
title.text = "MIRAG CITY — PHASE 2";
title.height = "36px";
title.color = "white";
title.fontSize = 21;
title.fontWeight = "700";
title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
panel.addControl(title);

const info = new TextBlock();
info.text = "WASD Move • Shift Sprint • Space Jump\nMouse Orbit / Zoom\nModular player + world architecture";
info.height = "82px";
info.color = "#e8edf7";
info.fontSize = 15;
info.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
panel.addControl(info);

engine.runRenderLoop(() => {
  player.update(engine.getDeltaTime() / 1000);
  scene.render();
});

window.addEventListener("resize", () => engine.resize());
