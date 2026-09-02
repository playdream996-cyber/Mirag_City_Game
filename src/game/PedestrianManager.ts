import { Color3, MeshBuilder, Scene, StandardMaterial, TransformNode, Vector3 } from "@babylonjs/core";

type Pedestrian = {
  root: TransformNode;
  target: Vector3;
  speed: number;
  boundsMin: Vector3;
  boundsMax: Vector3;
};

export class PedestrianManager {
  private readonly pedestrians: Pedestrian[] = [];

  constructor(private readonly scene: Scene) {
    for (let i = 0; i < 18; i++) {
      const blockX = (i % 6) - 3;
      const blockZ = Math.floor(i / 6) - 1;
      const center = new Vector3(blockX * 38, 0, blockZ * 58);
      this.pedestrians.push(this.createPedestrian(center, i));
    }
  }

  update(dt: number) {
    for (const ped of this.pedestrians) {
      const toTarget = ped.target.subtract(ped.root.position);
      toTarget.y = 0;

      if (toTarget.lengthSquared() < 1.2) {
        ped.target = this.randomPoint(ped.boundsMin, ped.boundsMax);
        continue;
      }

      const dir = toTarget.normalize();
      ped.root.position.addInPlace(dir.scale(ped.speed * dt));
      ped.root.rotation.y = Math.atan2(dir.x, dir.z);
    }
  }

  private createPedestrian(center: Vector3, index: number): Pedestrian {
    const root = new TransformNode(`pedestrian-${index}`, this.scene);
    const min = center.add(new Vector3(-10, 0, -8));
    const max = center.add(new Vector3(10, 0, 8));
    root.position.copyFrom(this.randomPoint(min, max));
    root.position.y = 1.0;

    const skin = new StandardMaterial(`pedSkin-${index}`, this.scene);
    skin.diffuseColor = new Color3(0.78, 0.58 + (index % 3) * 0.05, 0.42);

    const shirt = new StandardMaterial(`pedShirt-${index}`, this.scene);
    shirt.diffuseColor = new Color3(
      0.2 + ((index * 37) % 60) / 100,
      0.2 + ((index * 53) % 50) / 100,
      0.25 + ((index * 29) % 55) / 100,
    );

    const torso = MeshBuilder.CreateCapsule(`pedTorso-${index}`, { height: 1.35, radius: 0.35 }, this.scene);
    torso.parent = root;
    torso.material = shirt;

    const head = MeshBuilder.CreateSphere(`pedHead-${index}`, { diameter: 0.48 }, this.scene);
    head.parent = root;
    head.position.y = 0.92;
    head.material = skin;

    return {
      root,
      target: this.randomPoint(min, max),
      speed: 1.1 + (index % 4) * 0.18,
      boundsMin: min,
      boundsMax: max,
    };
  }

  private randomPoint(min: Vector3, max: Vector3): Vector3 {
    return new Vector3(
      min.x + Math.random() * (max.x - min.x),
      1.0,
      min.z + Math.random() * (max.z - min.z),
    );
  }
}
