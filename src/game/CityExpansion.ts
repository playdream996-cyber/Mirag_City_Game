import { Scene } from "@babylonjs/core";
import { buildDistrictEnvironment } from "./DistrictEnvironment";
import { PhysicsManager } from "./PhysicsManager";

export async function buildCityExpansion(scene: Scene, physics: PhysicsManager): Promise<number> {
  return buildDistrictEnvironment(scene, physics);
}
