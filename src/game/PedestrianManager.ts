import "@babylonjs/loaders/glTF";
import {
  AbstractMesh,
  Color3,
  MeshBuilder,
  Scene,
  SceneLoader,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import { getDistrictRule, pickNpcVariant, type NpcVariant } from "./DistrictRules";

type Pedestrian = {
  root: TransformNode;
  target: Vector3;
  speed: number;
  boundsMin: Vector3;
  boundsMax: Vector3;
  fallbackVisual: TransformNode;
  variant: NpcVariant;
};

const NPC_VARIANTS: readonly NpcVariant[] = [
  "Suit",
  "Punk",
  "Worker",
  "Casual_Hoodie",
  "Casual_2",
  "Beach",
  "Swat",
  "Adventurer",
];

const NPC_TARGET_HEIGHT = 1.82;

export class PedestrianManager {
  private readonly pedestrians: Pedestrian[] = [];
  private rebalanceTimer = 0;
  private loadedModelCount = 0;

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
      const variant = pickNpcVariant(center, i * 17 + center.x * 3 + center.z * 5);
      this.pedestrians.push(this.createPedestrian(center, i, variant));
    }
  }

  async initializeModels(): Promise<void> {
    const assetRoot = window.location.hostname.endsWith("github.io")
      ? "/Mirag_City_Game/assets/npcs/"
      : "/assets/npcs/";

    await Promise.all(
      NPC_VARIANTS.map(async (variant) => {
        try {
          const result = await SceneLoader.ImportMeshAsync("", assetRoot, `${variant}.gltf`, this.scene);
          const templateRoot = new TransformNode(`npcTemplate-${variant}`, this.scene);

          const importedTopLevel = result.meshes.filter((mesh) => !mesh.parent);
          for (const mesh of importedTopLevel) mesh.parent = templateRoot;
          for (const mesh of result.meshes) mesh.isPickable = false;

          this.normalizeImportedModel(result.meshes, templateRoot);

          const assigned = this.pedestrians.filter((ped) => ped.variant === variant);
          if (assigned.length === 0) {
            templateRoot.dispose();
            return;
          }

          templateRoot.parent = assigned[0].root;
          templateRoot.name = `npcModel-${variant}-0`;
          assigned[0].fallbackVisual.setEnabled(false);

          const walk = result.animationGroups.find((group) => group.name.toLowerCase() === "walk");
          if (walk) walk.start(true, 1.0, walk.from, walk.to, false);
          else result.animationGroups[0]?.start(true);

          for (let i = 1; i < assigned.length; i++) {
            const clone = templateRoot.clone(`npcModel-${variant}-${i}`, assigned[i].root, false);
            if (!clone) continue;
            clone.setEnabled(true);
            assigned[i].fallbackVisual.setEnabled(false);
          }

          this.loadedModelCount++;
        } catch (error) {
          console.warn(`NPC model ${variant}.gltf could not be loaded; keeping fallback pedestrians for this variant.`, error);
        }
      }),
    );
  }

  getLoadedModelCount(): number {
    return this.loadedModelCount;
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

    const districtRule = getDistrictRule(focusPosition);
    const targetVisible = Math.max(5, Math.round(14 * districtRule.pedestrianDensity));

    let visible = 0;
    for (const ped of this.pedestrians) {
      if (Vector3.DistanceSquared(ped.root.position, focusPosition) < 85 * 85) visible++;
    }
    if (visible >= targetVisible) return;

    const allowed = new Set<NpcVariant>(districtRule.npcVariants);
    const distant = this.pedestrians
      .filter((ped) => allowed.has(ped.variant))
      .filter((ped) => Vector3.DistanceSquared(ped.root.position, focusPosition) > 180 * 180)
      .slice(0, targetVisible - visible);

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

  private createPedestrian(center: Vector3, index: number, variant: NpcVariant): Pedestrian {
    const root = new TransformNode(`pedestrian-${index}`, this.scene);
    const radius = index % 6 === 0 ? 26 : 18;
    const min = center.add(new Vector3(-radius,0,-radius));
    const max = center.add(new Vector3(radius,0,radius));
    root.position.copyFrom(this.randomPoint(min,max));
    root.position.y = 1.0;

    const fallbackVisual = new TransformNode(`pedFallback-${index}`, this.scene);
    fallbackVisual.parent = root;

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
    torso.parent = fallbackVisual; torso.position.y = 0.12; torso.material = shirt;
    const legs = MeshBuilder.CreateBox(`pedLegs-${index}`, { width:0.52, height:0.7, depth:0.32 }, this.scene);
    legs.parent = fallbackVisual; legs.position.y = -0.55; legs.material = pants;
    const head = MeshBuilder.CreateSphere(`pedHead-${index}`, { diameter:0.48 }, this.scene);
    head.parent = fallbackVisual; head.position.y = 0.92; head.material = skin;

    return {
      root,
      target:this.randomPoint(min,max),
      speed:0.95+(index%6)*0.16,
      boundsMin:min,
      boundsMax:max,
      fallbackVisual,
      variant,
    };
  }

  private normalizeImportedModel(meshes: AbstractMesh[], visualRoot: TransformNode): void {
    const renderable = meshes.filter((mesh) => mesh.getTotalVertices() > 0);
    if (renderable.length === 0) return;

    let min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
    let max = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);

    for (const mesh of renderable) {
      mesh.computeWorldMatrix(true);
      const bounds = mesh.getHierarchyBoundingVectors(true);
      min = Vector3.Minimize(min, bounds.min);
      max = Vector3.Maximize(max, bounds.max);
    }

    const height = Math.max(0.001, max.y - min.y);
    const scale = NPC_TARGET_HEIGHT / height;
    visualRoot.scaling.setAll(scale);
    visualRoot.position.y = -min.y * scale - 1.0;
  }

  private randomPoint(min:Vector3,max:Vector3):Vector3 {
    return new Vector3(min.x+Math.random()*(max.x-min.x),1.0,min.z+Math.random()*(max.z-min.z));
  }
}
