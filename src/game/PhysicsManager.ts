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
  private readonly aggregateByNode = new Map<TransformNode, PhysicsAggregate>();

  async initialize(scene: Scene): Promise<void> {
    const havokInstance = await HavokPhysics();
    const plugin = new HavokPlugin(true, havokInstance);
    scene.enablePhysics(new Vector3(0, -9.81, 0), plugin);
    scene.getPhysicsEngine()?.setTimeStep(1 / 60);
  }

  addStaticBox(node: TransformNode): PhysicsAggregate {
    const aggregate = new PhysicsAggregate(
      node,
      PhysicsShapeType.BOX,
      { mass: 0, friction: 0.8, restitution: 0 },
      node.getScene(),
    );
    this.staticAggregates.push(aggregate);
    this.aggregateByNode.set(node, aggregate);
    return aggregate;
  }

  removeStaticBox(node: TransformNode): void {
    const aggregate = this.aggregateByNode.get(node);
    if (!aggregate) return;
    aggregate.dispose();
    this.aggregateByNode.delete(node);
    const index = this.staticAggregates.indexOf(aggregate);
    if (index >= 0) this.staticAggregates.splice(index, 1);
  }

  dispose(): void {
    for (const aggregate of this.staticAggregates) aggregate.dispose();
    this.staticAggregates.length = 0;
    this.aggregateByNode.clear();
  }
}
