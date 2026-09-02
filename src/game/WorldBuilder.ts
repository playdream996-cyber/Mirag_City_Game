import {
  Color3,
  DirectionalLight,
  HemisphericLight,
  MeshBuilder,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";

export type WorldContext = {
  shadows: ShadowGenerator;
};

export function buildWorld(scene: Scene): WorldContext {
  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.8;

  const sun = new DirectionalLight("sun", new Vector3(-0.5, -1, -0.35), scene);
  sun.position = new Vector3(40, 80, 40);
  sun.intensity = 1.7;

  const shadows = new ShadowGenerator(2048, sun);
  shadows.usePercentageCloserFiltering = true;

  const makeMaterial = (name: string, color: Color3) => {
    const material = new StandardMaterial(name, scene);
    material.diffuseColor = color;
    material.specularColor = new Color3(0.12, 0.12, 0.12);
    return material;
  };

  const materials = {
    grass: makeMaterial("grass", new Color3(0.28, 0.58, 0.26)),
    road: makeMaterial("road", new Color3(0.10, 0.11, 0.13)),
    line: makeMaterial("roadLine", new Color3(0.95, 0.82, 0.20)),
  };

  const ground = MeshBuilder.CreateGround("ground", { width: 280, height: 280 }, scene);
  ground.material = materials.grass;
  ground.checkCollisions = true;
  ground.receiveShadows = true;

  const createBox = (
    name: string,
    position: Vector3,
    size: Vector3,
    material: StandardMaterial,
  ) => {
    const box = MeshBuilder.CreateBox(
      name,
      { width: size.x, height: size.y, depth: size.z },
      scene,
    );
    box.position = position;
    box.material = material;
    box.checkCollisions = true;
    box.receiveShadows = true;
    shadows.addShadowCaster(box);
    return box;
  };

  const roadX = (z: number) => {
    createBox("roadX", new Vector3(0, 0.06, z), new Vector3(280, 0.12, 18), materials.road);
    for (let x = -130; x <= 130; x += 16) {
      createBox("lineX", new Vector3(x, 0.13, z), new Vector3(7, 0.03, 0.35), materials.line);
    }
  };

  const roadZ = (x: number) => {
    createBox("roadZ", new Vector3(x, 0.06, 0), new Vector3(18, 0.12, 280), materials.road);
    for (let z = -130; z <= 130; z += 16) {
      createBox("lineZ", new Vector3(x, 0.13, z), new Vector3(0.35, 0.03, 7), materials.line);
    }
  };

  [-70, 0, 70].forEach(roadX);
  [-70, 0, 70].forEach(roadZ);

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
        const width = 12 + Math.random() * 10;
        const depth = 12 + Math.random() * 10;
        const height = 12 + Math.random() * 35;
        const px = cx + (Math.random() - 0.5) * 42;
        const pz = cz + (Math.random() - 0.5) * 42;
        const buildingMat = makeMaterial(
          `building-${gx}-${gz}-${i}`,
          palette[Math.floor(Math.random() * palette.length)],
        );
        createBox(
          "building",
          new Vector3(px, height / 2, pz),
          new Vector3(width, height, depth),
          buildingMat,
        );
      }
    }
  }

  return { shadows };
}
