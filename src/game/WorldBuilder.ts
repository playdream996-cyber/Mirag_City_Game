import { Scene } from "@babylonjs/core";
import { PhysicsManager } from "./PhysicsManager";
import {
  buildTokyoBangkokMap,
  TokyoBangkokDistrict,
  TokyoBangkokWorldContext,
} from "./TokyoBangkokMap";

export type DistrictName = TokyoBangkokDistrict;
export type WorldContext = TokyoBangkokWorldContext;

export function buildWorld(scene: Scene, physics: PhysicsManager): WorldContext {
  return buildTokyoBangkokMap(scene, physics);
}
