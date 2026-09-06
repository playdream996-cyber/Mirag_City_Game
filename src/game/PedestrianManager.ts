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
    const centers = [
      new Vector3(-105, 0, -35), new Vector3(-35, 0, 35), new Vector3(35, 0, 35),
      new Vector3(105, 0, 35), new Vector3(105, 0, -105), new Vector3(175, 0, 105),
      new Vector3(-175, 0, 105), new Vector3(-175, 0, 175), new Vector3(-105, 0, -175),
      new Vector3(-35, 0, -175), new Vector3(35, 0, -175), new Vector3(105, 0, -175),
    ];

    for (let i = 0; i < 30; i++) {
      const center = centers[i % centers.length];
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
    const min = center.add(new Vector3(-18, 0, -18));
    const max = center.add(new Vector3(18, 0, 18));
    root.position.copyFrom(this.randomPoint(min, max));
    root.position.y = 1.0;

    const skin = new StandardMaterial(`pedSkin-${index}`, this.scene);
    skin.diffuseColor = new Color3(0.72 + (index % 3) * 0.04, 0.5 + (index % 4) * 0.04, 0.35);

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
      speed: 1.0 + (index % 5) * 0.16,
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
