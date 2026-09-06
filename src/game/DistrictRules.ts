import { Vector3 } from "@babylonjs/core";

export type MapDistrict =
  | "Hills / VIP District"
  | "Old Market"
  | "Central Downtown"
  | "Tech / Port"
  | "Neon Quarter"
  | "Canal Town"
  | "Riverside"
  | "Industrial Docks"
  | "Beach / Marina";

export type NpcVariant =
  | "Suit"
  | "Punk"
  | "Worker"
  | "Casual_Hoodie"
  | "Casual_2"
  | "Beach"
  | "Swat"
  | "Adventurer";

export type DistrictRule = {
  buildingDensity: number;
  minHeight: number;
  maxHeight: number;
  pedestrianDensity: number;
  trafficDensity: number;
  trafficSpeedMultiplier: number;
  policeResponse: number;
  neonStrength: number;
  propDensity: number;
  npcVariants: readonly NpcVariant[];
};

export const DISTRICT_RULES: Record<MapDistrict, DistrictRule> = {
  "Hills / VIP District": {
    buildingDensity: 0.3,
    minHeight: 6,
    maxHeight: 22,
    pedestrianDensity: 0.3,
    trafficDensity: 0.3,
    trafficSpeedMultiplier: 0.9,
    policeResponse: 0.8,
    neonStrength: 0.05,
    propDensity: 0.55,
    npcVariants: ["Suit", "Casual_2", "Adventurer"],
  },
  "Old Market": {
    buildingDensity: 0.85,
    minHeight: 8,
    maxHeight: 34,
    pedestrianDensity: 1.15,
    trafficDensity: 0.55,
    trafficSpeedMultiplier: 0.6,
    policeResponse: 0.55,
    neonStrength: 0.18,
    propDensity: 1.25,
    npcVariants: ["Worker", "Casual_Hoodie", "Casual_2", "Punk"],
  },
  "Central Downtown": {
    buildingDensity: 0.95,
    minHeight: 34,
    maxHeight: 150,
    pedestrianDensity: 1.0,
    trafficDensity: 1.0,
    trafficSpeedMultiplier: 0.9,
    policeResponse: 1.0,
    neonStrength: 0.28,
    propDensity: 0.8,
    npcVariants: ["Suit", "Casual_2", "Worker", "Adventurer"],
  },
  "Tech / Port": {
    buildingDensity: 0.6,
    minHeight: 18,
    maxHeight: 72,
    pedestrianDensity: 0.65,
    trafficDensity: 0.65,
    trafficSpeedMultiplier: 0.85,
    policeResponse: 0.9,
    neonStrength: 0.35,
    propDensity: 0.85,
    npcVariants: ["Worker", "Suit", "Swat", "Casual_2"],
  },
  "Neon Quarter": {
    buildingDensity: 0.9,
    minHeight: 18,
    maxHeight: 58,
    pedestrianDensity: 1.25,
    trafficDensity: 0.75,
    trafficSpeedMultiplier: 0.68,
    policeResponse: 0.65,
    neonStrength: 1.0,
    propDensity: 1.1,
    npcVariants: ["Punk", "Casual_Hoodie", "Casual_2", "Beach"],
  },
  "Canal Town": {
    buildingDensity: 0.8,
    minHeight: 7,
    maxHeight: 28,
    pedestrianDensity: 1.05,
    trafficDensity: 0.35,
    trafficSpeedMultiplier: 0.52,
    policeResponse: 0.45,
    neonStrength: 0.12,
    propDensity: 1.15,
    npcVariants: ["Worker", "Casual_Hoodie", "Beach", "Casual_2"],
  },
  Riverside: {
    buildingDensity: 0.65,
    minHeight: 14,
    maxHeight: 54,
    pedestrianDensity: 1.05,
    trafficDensity: 0.7,
    trafficSpeedMultiplier: 0.72,
    policeResponse: 0.6,
    neonStrength: 0.3,
    propDensity: 0.95,
    npcVariants: ["Beach", "Casual_2", "Suit", "Adventurer"],
  },
  "Industrial Docks": {
    buildingDensity: 0.45,
    minHeight: 8,
    maxHeight: 28,
    pedestrianDensity: 0.45,
    trafficDensity: 0.45,
    trafficSpeedMultiplier: 0.72,
    policeResponse: 0.6,
    neonStrength: 0.08,
    propDensity: 1.35,
    npcVariants: ["Worker", "Swat", "Punk"],
  },
  "Beach / Marina": {
    buildingDensity: 0.45,
    minHeight: 8,
    maxHeight: 46,
    pedestrianDensity: 0.85,
    trafficDensity: 0.65,
    trafficSpeedMultiplier: 0.8,
    policeResponse: 0.55,
    neonStrength: 0.18,
    propDensity: 0.8,
    npcVariants: ["Beach", "Casual_2", "Adventurer"],
  },
};

// Physical map coordinates. Positive Z is north; negative Z is toward the beach.
export function getMapDistrict(position: Vector3): MapDistrict {
  const { x, z } = position;

  if (z < -245) return "Beach / Marina";
  if (x > 155 && z < -70) return "Industrial Docks";
  if (x < -145 && z < -70) return "Canal Town";
  if (z < -70) return "Riverside";

  if (x > 145 && z >= 35) return "Tech / Port";
  if (x < -135 && z >= 25) return "Old Market";
  if (z > 215 && x < 160) return "Hills / VIP District";

  if (x > 70 && z < 45) return "Neon Quarter";
  return "Central Downtown";
}

export function getDistrictRule(position: Vector3): DistrictRule {
  return DISTRICT_RULES[getMapDistrict(position)];
}

export function pickNpcVariant(position: Vector3, seed: number): NpcVariant {
  const variants = getDistrictRule(position).npcVariants;
  const index = Math.abs(Math.floor(seed)) % variants.length;
  return variants[index];
}
