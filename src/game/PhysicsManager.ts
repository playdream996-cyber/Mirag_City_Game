import HavokPhysics from "@babylonjs/havok";
import {
  HavokPlugin,
  PhysicsAggregate,
  PhysicsShapeType,
  Scene,
  TransformNode,
  Vector3,
} from "@babylonjs/core";

export class PhysicsManager {
  private readonly staticAggregates: PhysicsAggregate[] = [];

  async initialize(scene: Scene): Promise<void> {
    const havokInstance = await HavokPhysics();
    const plugin = new HavokPlugin(true, havokInstance);
    scene.enablePhysics(new Vector3(0, -9.81, 0), plugin);

    // Stable fixed physics step for deterministic-feeling character movement.
    scene.getPhysicsEngine()?.setTimeStep(1 / 60);
  }

  addStaticBox(node: TransformNode): PhysicsAggregate {
    const aggregate = new PhysicsAggregate(
      node,
      PhysicsShapeType.BOX,
      {
        mass: 0,
        friction: 0.8,
        restitution: 0,
      },
      node.getScene(),
    );
    this.staticAggregates.push(aggregate);
    return aggregate;
  }

  dispose(): void {
    for (const aggregate of this.staticAggregates) {
      aggregate.dispose();
    }
    this.staticAggregates.length = 0;
  }
}
