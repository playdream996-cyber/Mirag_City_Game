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
  private rebalanceTimer = 0;

  constructor(private readonly scene: Scene) {
    const centers = [
      new Vector3(-112,0,-35), new Vector3(-37,0,35), new Vector3(37,0,35),
      new Vector3(112,0,35), new Vector3(112,0,-112), new Vector3(187,0,112),
      new Vector3(-187,0,112), new Vector3(-262,0,262), new Vector3(-187,0,-112),
      new Vector3(-112,0,-187), new Vector3(-37,0,-262), new Vector3(37,0,-262),
      new Vector3(112,0,-262), new Vector3(187,0,-262), new Vector3(262,0,187),
      new Vector3(262,0,112), new Vector3(37,0,112), new Vector3(-37,0,112),
    ];

    for (let i = 0; i < 72; i++) {
      const center = centers[i % centers.length];
      this.pedestrians.push(this.createPedestrian(center, i));
    }
  }

  update(dt: number, focusPosition?: Vector3): void {
    for (const ped of this.pedestrians) {
      const toTarget = ped.target.subtract(ped.root.position);
      toTarget.y = 0;
      if (toTarget.lengthSquared() < 1.4) {
        ped.target = this.randomPoint(ped.boundsMin, ped.boundsMax);
        continue;
      }
      const dir = toTarget.normalize();
      ped.root.position.addInPlace(dir.scale(ped.speed * dt));
      ped.root.rotation.y = Math.atan2(dir.x, dir.z);
    }

    if (!focusPosition) return;
    this.rebalanceTimer -= dt;
    if (this.rebalanceTimer > 0) return;
    this.rebalanceTimer = 2.2;

    let visible = 0;
    for (const ped of this.pedestrians) {
      if (Vector3.DistanceSquared(ped.root.position, focusPosition) < 85 * 85) visible++;
    }
    if (visible >= 14) return;

    const distant = this.pedestrians
      .filter((ped) => Vector3.DistanceSquared(ped.root.position, focusPosition) > 180 * 180)
      .slice(0, 16 - visible);

    for (let i = 0; i < distant.length; i++) {
      const ped = distant[i];
      const angle = (i / Math.max(1, distant.length)) * Math.PI * 2;
      const radius = 28 + (i % 4) * 10;
      const center = focusPosition.add(new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
      ped.boundsMin = center.add(new Vector3(-16, 0, -16));
      ped.boundsMax = center.add(new Vector3(16, 0, 16));
      ped.root.position.copyFrom(this.randomPoint(ped.boundsMin, ped.boundsMax));
      ped.target = this.randomPoint(ped.boundsMin, ped.boundsMax);
    }
  }

  private createPedestrian(center: Vector3, index: number): Pedestrian {
    const root = new TransformNode(`pedestrian-${index}`, this.scene);
    const radius = index % 6 === 0 ? 26 : 18;
    const min = center.add(new Vector3(-radius,0,-radius));
    const max = center.add(new Vector3(radius,0,radius));
    root.position.copyFrom(this.randomPoint(min,max));
    root.position.y = 1.0;

    const skin = new StandardMaterial(`pedSkin-${index}`, this.scene);
    const skinBase = 0.48 + (index % 5) * 0.07;
    skin.diffuseColor = new Color3(Math.min(0.88,skinBase+0.16),Math.min(0.76,skinBase),Math.min(0.62,skinBase-0.08));

    const shirt = new StandardMaterial(`pedShirt-${index}`, this.scene);
    shirt.diffuseColor = new Color3(
      0.16 + ((index*37)%65)/100,
      0.16 + ((index*53)%58)/100,
      0.2 + ((index*29)%60)/100,
    );

    const pants = new StandardMaterial(`pedPants-${index}`, this.scene);
    pants.diffuseColor = new Color3(0.08+(index%4)*0.04,0.09+(index%3)*0.04,0.12+(index%5)*0.03);

    const torso = MeshBuilder.CreateCapsule(`pedTorso-${index}`, { height:1.3, radius:0.34 }, this.scene);
    torso.parent = root; torso.position.y = 0.12; torso.material = shirt;
    const legs = MeshBuilder.CreateBox(`pedLegs-${index}`, { width:0.52, height:0.7, depth:0.32 }, this.scene);
    legs.parent = root; legs.position.y = -0.55; legs.material = pants;
    const head = MeshBuilder.CreateSphere(`pedHead-${index}`, { diameter:0.48 }, this.scene);
    head.parent = root; head.position.y = 0.92; head.material = skin;

    return { root, target:this.randomPoint(min,max), speed:0.95+(index%6)*0.16, boundsMin:min, boundsMax:max };
  }

  private randomPoint(min:Vector3,max:Vector3):Vector3 {
    return new Vector3(min.x+Math.random()*(max.x-min.x),1.0,min.z+Math.random()*(max.z-min.z));
  }
}
