import { Scene, Vector3 } from "@babylonjs/core";
import { PhysicsManager } from "./PhysicsManager";
import { VoxCityChunkManager } from "./VoxCityChunkManager";
import { VoxCityCollision } from "./VoxCityCollision";

export class VoxCityWorld {
  private readonly chunks: VoxCityChunkManager;
  private readonly collision: VoxCityCollision;
  private colliderCount = 0;
  private initialized = false;

  constructor(scene: Scene, physics: PhysicsManager) {
    this.chunks = new VoxCityChunkManager(scene);
    this.collision = new VoxCityCollision(scene, physics);
  }

  async initialize(initialPosition: Vector3): Promise<void> {
    const results = await Promise.allSettled([
      this.collision.initialize(),
      this.chunks.initialize(initialPosition),
    ]);

    const collisionResult = results[0];
    if (collisionResult.status === "fulfilled") this.colliderCount = collisionResult.value;
    else console.warn("VoxCity collision shell unavailable:", collisionResult.reason);

    const chunkResult = results[1];
    if (chunkResult.status === "rejected") console.warn("VoxCity visual shell unavailable:", chunkResult.reason);

    this.initialized = true;
  }

  update(actorPosition: Vector3): void {
    if (!this.initialized) return;
    this.chunks.update(actorPosition);
  }

  getHudText(): string {
    return `${this.chunks.getHudText()} • ${this.colliderCount} simplified colliders`;
  }

  dispose(): void {
    this.chunks.dispose();
    this.collision.dispose();
  }
}
