import {
  Engine, Scene, Vector3, HemisphericLight, DirectionalLight, Color3, Color4,
  MeshBuilder, StandardMaterial, ArcRotateCamera, KeyboardEventTypes, TransformNode,
  ShadowGenerator, Scalar
} from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock, StackPanel, Control } from "@babylonjs/gui";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });

const scene = new Scene(engine);
scene.clearColor = new Color4(0.62, 0.82, 0.96, 1);
scene.collisionsEnabled = true;

const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
hemi.intensity = 0.8;

const sun = new DirectionalLight("sun", new Vector3(-0.5, -1, -0.35), scene);
sun.position = new Vector3(40, 80, 40);
sun.intensity = 1.7;

const shadows = new ShadowGenerator(2048, sun);
shadows.usePercentageCloserFiltering = true;

function makeMaterial(name: string, color: Color3) {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color;
  m.specularColor = new Color3(0.12, 0.12, 0.12);
  return m;
}

const materials = {
  grass: makeMaterial("grass", new Color3(0.28, 0.58, 0.26)),
  road: makeMaterial("road", new Color3(0.10, 0.11, 0.13)),
  sidewalk: makeMaterial("sidewalk", new Color3(0.48, 0.50, 0.52)),
  line: makeMaterial("roadLine", new Color3(0.95, 0.82, 0.20)),
  player: makeMaterial("player", new Color3(0.15, 0.37, 0.88)),
};

const ground = MeshBuilder.CreateGround("ground", { width: 280, height: 280 }, scene);
ground.material = materials.grass;
ground.checkCollisions = true;
ground.receiveShadows = true;

function createBox(name: string, position: Vector3, size: Vector3, material: StandardMaterial) {
  const b = MeshBuilder.CreateBox(name, { width: size.x, height: size.y, depth: size.z }, scene);
  b.position = position;
  b.material = material;
  b.checkCollisions = true;
  b.receiveShadows = true;
  shadows.addShadowCaster(b);
  return b;
}

function createRoadX(z: number) {
  createBox("roadX", new Vector3(0, 0.06, z), new Vector3(280, 0.12, 18), materials.road);
  for (let x = -130; x <= 130; x += 16) {
    createBox("lineX", new Vector3(x, 0.13, z), new Vector3(7, 0.03, 0.35), materials.line);
  }
}

function createRoadZ(x: number) {
  createBox("roadZ", new Vector3(x, 0.06, 0), new Vector3(18, 0.12, 280), materials.road);
  for (let z = -130; z <= 130; z += 16) {
    createBox("lineZ", new Vector3(x, 0.13, z), new Vector3(0.35, 0.03, 7), materials.line);
  }
}

[-70, 0, 70].forEach(createRoadX);
[-70, 0, 70].forEach(createRoadZ);

const palette = [
  new Color3(0.62, 0.70, 0.79),
  new Color3(0.76, 0.64, 0.54),
  new Color3(0.56, 0.66, 0.62),
  new Color3(0.72, 0.58, 0.62),
];

for (let gx = -2; gx <= 1; gx++) {
  for (let gz = -2; gz <= 1; gz++) {
    const cx = gx * 70 + 35;
    const cz = gz * 70 + 35;
    for (let i = 0; i < 5; i++) {
      const w = 12 + Math.random() * 10;
      const d = 12 + Math.random() * 10;
      const h = 12 + Math.random() * 35;
      const px = cx + (Math.random() - 0.5) * 42;
      const pz = cz + (Math.random() - 0.5) * 42;
      const buildingMat = makeMaterial(
        `building-${gx}-${gz}-${i}`,
        palette[Math.floor(Math.random() * palette.length)]
      );
      createBox("building", new Vector3(px, h / 2, pz), new Vector3(w, h, d), buildingMat);
    }
  }
}

const playerRoot = new TransformNode("playerRoot", scene);
playerRoot.position = new Vector3(8, 1.1, 8);

const body = MeshBuilder.CreateCapsule("player", { height: 2.2, radius: 0.55 }, scene);
body.parent = playerRoot;
body.material = materials.player;
body.checkCollisions = true;
shadows.addShadowCaster(body);

const camera = new ArcRotateCamera(
  "camera",
  -Math.PI / 2,
  1.1,
  9,
  playerRoot.position.clone(),
  scene
);
camera.attachControl(canvas, true);
camera.lowerRadiusLimit = 5;
camera.upperRadiusLimit = 13;
camera.lowerBetaLimit = 0.55;
camera.upperBetaLimit = 1.45;
camera.wheelPrecision = 40;

type InputState = {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
};

const input: InputState = {
  forward: false,
  back: false,
  left: false,
  right: false,
  sprint: false,
};

scene.onKeyboardObservable.add((kbInfo) => {
  const isDown = kbInfo.type === KeyboardEventTypes.KEYDOWN;
  const key = kbInfo.event.key.toLowerCase();

  if (key === "w") input.forward = isDown;
  if (key === "s") input.back = isDown;
  if (key === "a") input.left = isDown;
  if (key === "d") input.right = isDown;
  if (key === "shift") input.sprint = isDown;
});

const velocity = new Vector3();

scene.onBeforeRenderObservable.add(() => {
  const dt = engine.getDeltaTime() / 1000;

  camera.target = Vector3.Lerp(
    camera.target,
    playerRoot.position.add(new Vector3(0, 1.0, 0)),
    0.15
  );

  const cameraForward = camera.target.subtract(camera.position);
  cameraForward.y = 0;
  cameraForward.normalize();

  const cameraRight = Vector3.Cross(cameraForward, Vector3.Up()).normalize();
  const move = Vector3.Zero();

  if (input.forward) move.addInPlace(cameraForward);
  if (input.back) move.subtractInPlace(cameraForward);
  if (input.right) move.addInPlace(cameraRight);
  if (input.left) move.subtractInPlace(cameraRight);

  if (move.lengthSquared() > 0.001) {
    move.normalize();
    const speed = input.sprint ? 9 : 5;
    velocity.x = Scalar.Lerp(velocity.x, move.x * speed, Math.min(1, dt * 10));
    velocity.z = Scalar.Lerp(velocity.z, move.z * speed, Math.min(1, dt * 10));
    playerRoot.rotation.y = Math.atan2(move.x, move.z);
  } else {
    velocity.x = Scalar.Lerp(velocity.x, 0, Math.min(1, dt * 9));
    velocity.z = Scalar.Lerp(velocity.z, 0, Math.min(1, dt * 9));
  }

  playerRoot.position.x += velocity.x * dt;
  playerRoot.position.z += velocity.z * dt;
});

const ui = AdvancedDynamicTexture.CreateFullscreenUI("UI");
const panel = new StackPanel();
panel.width = "320px";
panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
panel.paddingTop = "18px";
panel.paddingLeft = "18px";
ui.addControl(panel);

const title = new TextBlock();
title.text = "MIRAG CITY — PHASE 1";
title.height = "36px";
title.color = "white";
title.fontSize = 21;
title.fontWeight = "700";
title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
panel.addControl(title);

const info = new TextBlock();
info.text = "WASD Move  •  Shift Sprint\nMouse Orbit / Zoom\nCity sandbox + system hooks";
info.height = "74px";
info.color = "#e8edf7";
info.fontSize = 15;
info.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
panel.addControl(info);

engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());
