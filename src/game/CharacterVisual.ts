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
import { CharacterAnimationController } from "./CharacterAnimationController";

export type CharacterVisualResult = {
  root: TransformNode;
  animator: CharacterAnimationController | null;
  usingFallback: boolean;
};

export class CharacterVisual {
  static async create(scene: Scene, parent: TransformNode): Promise<CharacterVisualResult> {
    const visualRoot = new TransformNode("playerVisualRoot", scene);
    visualRoot.parent = parent;

    try {
      const result = await SceneLoader.ImportMeshAsync(
        "",
        "/assets/characters/",
        "player.glb",
        scene,
      );

      for (const mesh of result.meshes) {
        if (mesh === result.meshes[0]) continue;
        mesh.parent = visualRoot;
        mesh.isPickable = false;
      }

      this.normalizeImportedModel(result.meshes, visualRoot);
      const animator = new CharacterAnimationController(result.animationGroups);
      animator.setState("idle");

      return {
        root: visualRoot,
        animator,
        usingFallback: false,
      };
    } catch (error) {
      console.warn(
        "Player GLB not found at /assets/characters/player.glb. Using fallback capsule visual.",
        error,
      );

      const material = new StandardMaterial("playerFallbackMaterial", scene);
      material.diffuseColor = new Color3(0.15, 0.37, 0.88);

      const body = MeshBuilder.CreateCapsule(
        "playerFallbackVisual",
        { height: 2.0, radius: 0.48 },
        scene,
      );
      body.parent = visualRoot;
      body.position.y = 1.0;
      body.material = material;
      body.isPickable = false;

      return {
        root: visualRoot,
        animator: null,
        usingFallback: true,
      };
    }
  }

  private static normalizeImportedModel(meshes: AbstractMesh[], visualRoot: TransformNode): void {
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
    const targetHeight = 1.85;
    const scale = targetHeight / height;
    visualRoot.scaling.setAll(scale);

    // After scaling, keep the character's feet at the controller origin.
    visualRoot.position.y = -min.y * scale;
  }
}
