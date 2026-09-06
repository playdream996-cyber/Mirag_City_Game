import { Scene } from "@babylonjs/core";
import { PhysicsManager } from "./PhysicsManager";

// Rebuild branch: the old procedural/block city expansion is intentionally disabled.
// New modular district environment will be added on top of TokyoBangkokMap after the
// road/water/terrain layout is validated.
export async function buildCityExpansion(_scene: Scene, _physics: PhysicsManager): Promise<number> {
  return 0;
}
