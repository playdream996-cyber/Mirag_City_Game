export type PlanPoint = readonly [x: number, z: number];

export type RoadClass = "expressway" | "arterial" | "collector" | "local" | "waterfront";

export type RoadPlan = {
  id: string;
  roadClass: RoadClass;
  width: number;
  points: readonly PlanPoint[];
};

export type ArcRoadPlan = {
  id: string;
  roadClass: RoadClass;
  width: number;
  center: PlanPoint;
  radius: number;
  start: number;
  end: number;
  segments: number;
};

export type BridgePlan = {
  id: string;
  width: number;
  deckY: number;
  from: PlanPoint;
  to: PlanPoint;
  railings?: boolean;
};

export type BuildingTemplateName = "Building_Large_2" | "Building_Medium_2_001" | "Building_Small_1";

export type BuildingRowPlan = {
  id: string;
  district: string;
  start: PlanPoint;
  end: PlanPoint;
  side: -1 | 1;
  setback: number;
  spacing: number;
  width: number;
  depth: number;
  height: number;
  templates: readonly BuildingTemplateName[];
  startTrim?: number;
  endTrim?: number;
};

export type LandmarkPlan = {
  id: string;
  position: PlanPoint;
  size: readonly [width: number, depth: number, height: number];
  kind: "civic" | "hotel" | "casino" | "tech" | "market" | "industrial" | "villa";
};

export const MIRAGE_DISTRICTS = [
  { id: "hills", label: "Hills / VIP District", center: [0, 515] as const },
  { id: "old-market", label: "Old Market", center: [-395, 215] as const },
  { id: "downtown", label: "Central Downtown", center: [0, 175] as const },
  { id: "tech", label: "Tech / Port", center: [395, 215] as const },
  { id: "canal", label: "Canal Town", center: [-405, -145] as const },
  { id: "neon", label: "Neon Quarter", center: [0, -115] as const },
  { id: "riverside", label: "Riverside", center: [0, -335] as const },
  { id: "industrial", label: "Industrial Docks", center: [430, -225] as const },
  { id: "beach", label: "Beach / Marina", center: [0, -565] as const },
] as const;

// Authoritative road graph. These are not random decoration lines: every building row below
// is aligned to one of these corridors and every bridge has a defined crossing.
export const MIRAGE_ROADS: readonly RoadPlan[] = [
  { id: "A1-grand-boulevard", roadClass: "arterial", width: 34, points: [[0, -485], [0, 445]] },
  { id: "A2-central-cross", roadClass: "arterial", width: 30, points: [[-570, 145], [570, 145]] },
  { id: "A3-market-avenue", roadClass: "collector", width: 22, points: [[-560, 335], [-410, 275], [-255, 225], [-105, 170], [0, 145]] },
  { id: "A4-tech-avenue", roadClass: "collector", width: 22, points: [[0, 145], [110, 175], [260, 230], [410, 285], [560, 335]] },
  { id: "A5-neon-strip", roadClass: "arterial", width: 26, points: [[-305, -105], [305, -105]] },
  { id: "A6-waterfront", roadClass: "waterfront", width: 26, points: [[-485, -485], [485, -485]] },
  { id: "A7-port-boulevard", roadClass: "arterial", width: 24, points: [[150, -95], [300, -165], [455, -230], [585, -245]] },
  { id: "A8-canal-link", roadClass: "collector", width: 20, points: [[-560, -245], [-490, -215], [-405, -175], [-300, -130], [-150, -85]] },
  { id: "A9-riverside-north", roadClass: "collector", width: 18, points: [[-270, -275], [270, -275]] },
  { id: "A10-riverside-south", roadClass: "collector", width: 18, points: [[-270, -395], [270, -395]] },
  { id: "A11-old-market-north", roadClass: "local", width: 14, points: [[-560, 315], [-245, 315]] },
  { id: "A12-old-market-south", roadClass: "local", width: 14, points: [[-555, 185], [-250, 185]] },
  { id: "A13-old-market-west", roadClass: "local", width: 13, points: [[-520, 105], [-520, 345]] },
  { id: "A14-old-market-east", roadClass: "local", width: 13, points: [[-300, 105], [-300, 330]] },
  { id: "A15-tech-north", roadClass: "local", width: 15, points: [[260, 325], [535, 325]] },
  { id: "A16-tech-south", roadClass: "local", width: 15, points: [[250, 175], [545, 175]] },
  { id: "A17-tech-east", roadClass: "local", width: 14, points: [[505, 135], [505, 345]] },
  { id: "A18-canal-west-bank", roadClass: "local", width: 13, points: [[-525, -295], [-525, -20]] },
  { id: "A19-canal-east-bank", roadClass: "local", width: 13, points: [[-335, -295], [-335, -20]] },
  { id: "A20-canal-south-bank", roadClass: "local", width: 13, points: [[-555, -265], [-275, -265]] },
  { id: "A21-industrial-east", roadClass: "local", width: 18, points: [[525, -355], [525, 15]] },
  { id: "A22-industrial-yard", roadClass: "local", width: 18, points: [[290, -335], [570, -335]] },
  { id: "A23-beach-service", roadClass: "local", width: 14, points: [[-330, -560], [330, -560]] },
  { id: "A24-hills-spine", roadClass: "collector", width: 18, points: [[-250, 495], [0, 540], [250, 495]] },
];

export const MIRAGE_ARC_ROADS: readonly ArcRoadPlan[] = [
  { id: "R1-north-ring", roadClass: "expressway", width: 26, center: [0, 470], radius: 360, start: Math.PI * 0.10, end: Math.PI * 0.90, segments: 24 },
  { id: "R2-south-ring", roadClass: "expressway", width: 26, center: [0, -445], radius: 400, start: Math.PI * 1.08, end: Math.PI * 1.92, segments: 26 },
  { id: "R3-central-roundabout", roadClass: "arterial", width: 18, center: [0, 165], radius: 82, start: 0, end: Math.PI * 2, segments: 24 },
  { id: "R4-hills-loop", roadClass: "local", width: 13, center: [0, 525], radius: 210, start: Math.PI * 0.08, end: Math.PI * 0.92, segments: 18 },
  { id: "R5-marina-crescent", roadClass: "local", width: 14, center: [135, -620], radius: 170, start: Math.PI * 1.06, end: Math.PI * 1.86, segments: 18 },
];

export const MIRAGE_BRIDGES: readonly BridgePlan[] = [
  { id: "B1-canal-north-south", width: 16, deckY: 1.15, from: [-430, -195], to: [-430, -90], railings: true },
  { id: "B2-canal-west-crossing", width: 14, deckY: 1.05, from: [-550, -205], to: [-405, -205], railings: true },
  { id: "B3-canal-west-north", width: 14, deckY: 1.05, from: [-550, -75], to: [-405, -75], railings: true },
  { id: "B4-river-west", width: 18, deckY: 1.35, from: [-165, -405], to: [-165, -260], railings: true },
  { id: "B5-river-central", width: 22, deckY: 1.45, from: [0, -410], to: [0, -255], railings: true },
  { id: "B6-river-east", width: 18, deckY: 1.35, from: [165, -405], to: [165, -260], railings: true },
  { id: "B7-port-causeway", width: 20, deckY: 1.10, from: [520, -260], to: [620, -260], railings: true },
];

export const MIRAGE_BUILDING_ROWS: readonly BuildingRowPlan[] = [
  // Downtown: aligned to the grand boulevard and central cross, not scattered.
  { id: "downtown-west-spine", district: "downtown", start: [-55, -5], end: [-55, 355], side: -1, setback: 0, spacing: 58, width: 36, depth: 38, height: 2.35, templates: ["Building_Large_2", "Building_Medium_2_001"] },
  { id: "downtown-east-spine", district: "downtown", start: [55, -5], end: [55, 355], side: 1, setback: 0, spacing: 58, width: 36, depth: 38, height: 2.55, templates: ["Building_Large_2", "Building_Medium_2_001"] },
  { id: "downtown-north-row", district: "downtown", start: [-220, 215], end: [220, 215], side: 1, setback: 0, spacing: 62, width: 36, depth: 36, height: 2.05, templates: ["Building_Large_2", "Building_Medium_2_001"] },
  { id: "downtown-south-row", district: "downtown", start: [-220, 80], end: [220, 80], side: -1, setback: 0, spacing: 62, width: 34, depth: 36, height: 1.75, templates: ["Building_Medium_2_001", "Building_Large_2"] },

  // Old Market: compact perimeter blocks with internal lanes.
  { id: "market-north-front", district: "old-market", start: [-535, 290], end: [-275, 290], side: -1, setback: 17, spacing: 42, width: 27, depth: 30, height: 0.90, templates: ["Building_Small_1", "Building_Medium_2_001"] },
  { id: "market-south-front", district: "old-market", start: [-535, 205], end: [-275, 205], side: 1, setback: 17, spacing: 42, width: 27, depth: 30, height: 0.82, templates: ["Building_Small_1", "Building_Medium_2_001"] },
  { id: "market-west-front", district: "old-market", start: [-495, 125], end: [-495, 305], side: 1, setback: 16, spacing: 41, width: 25, depth: 28, height: 0.78, templates: ["Building_Small_1"] },
  { id: "market-east-front", district: "old-market", start: [-325, 125], end: [-325, 300], side: -1, setback: 16, spacing: 41, width: 25, depth: 28, height: 0.88, templates: ["Building_Small_1", "Building_Medium_2_001"] },

  // Tech district: larger setbacks / campus blocks.
  { id: "tech-north-row", district: "tech", start: [285, 300], end: [500, 300], side: -1, setback: 22, spacing: 55, width: 38, depth: 36, height: 1.35, templates: ["Building_Medium_2_001", "Building_Large_2"] },
  { id: "tech-south-row", district: "tech", start: [285, 200], end: [500, 200], side: 1, setback: 22, spacing: 55, width: 38, depth: 36, height: 1.15, templates: ["Building_Medium_2_001", "Building_Large_2"] },
  { id: "tech-east-row", district: "tech", start: [475, 175], end: [475, 320], side: -1, setback: 22, spacing: 52, width: 36, depth: 34, height: 1.30, templates: ["Building_Medium_2_001"] },

  // Canal town: buildings explicitly follow the canal banks.
  { id: "canal-west-row", district: "canal", start: [-500, -275], end: [-500, -35], side: 1, setback: 20, spacing: 42, width: 25, depth: 28, height: 0.80, templates: ["Building_Small_1", "Building_Medium_2_001"] },
  { id: "canal-east-row", district: "canal", start: [-360, -275], end: [-360, -35], side: -1, setback: 20, spacing: 42, width: 25, depth: 28, height: 0.84, templates: ["Building_Small_1", "Building_Medium_2_001"] },
  { id: "canal-south-row", district: "canal", start: [-500, -235], end: [-330, -235], side: 1, setback: 20, spacing: 44, width: 25, depth: 27, height: 0.76, templates: ["Building_Small_1"] },

  // Neon strip: two clean parallel street walls.
  { id: "neon-north-row", district: "neon", start: [-245, -70], end: [245, -70], side: -1, setback: 0, spacing: 49, width: 34, depth: 31, height: 1.20, templates: ["Building_Medium_2_001", "Building_Large_2"] },
  { id: "neon-south-row", district: "neon", start: [-245, -145], end: [245, -145], side: 1, setback: 0, spacing: 49, width: 34, depth: 31, height: 1.12, templates: ["Building_Medium_2_001", "Building_Large_2"] },

  // Riverside: building fronts stay off the river and face promenades.
  { id: "river-north-row", district: "riverside", start: [-225, -245], end: [225, -245], side: -1, setback: 12, spacing: 53, width: 31, depth: 33, height: 1.10, templates: ["Building_Medium_2_001", "Building_Small_1"] },
  { id: "river-south-row", district: "riverside", start: [-225, -420], end: [225, -420], side: 1, setback: 12, spacing: 53, width: 31, depth: 33, height: 1.05, templates: ["Building_Medium_2_001", "Building_Small_1"] },

  // Industrial docks: large blocks aligned to truck roads.
  { id: "industrial-west-row", district: "industrial", start: [330, -315], end: [330, -40], side: 1, setback: 28, spacing: 64, width: 44, depth: 46, height: 0.92, templates: ["Building_Large_2", "Building_Medium_2_001"] },
  { id: "industrial-east-row", district: "industrial", start: [485, -315], end: [485, -40], side: -1, setback: 28, spacing: 64, width: 44, depth: 46, height: 0.88, templates: ["Building_Large_2", "Building_Medium_2_001"] },
  { id: "industrial-yard-row", district: "industrial", start: [320, -365], end: [515, -365], side: -1, setback: 22, spacing: 62, width: 46, depth: 44, height: 0.80, templates: ["Building_Large_2"] },

  // Beach / marina hotels and services along the coast road.
  { id: "beach-hotel-row", district: "beach", start: [-275, -525], end: [75, -525], side: -1, setback: 18, spacing: 68, width: 42, depth: 40, height: 1.32, templates: ["Building_Medium_2_001", "Building_Large_2"] },
  { id: "marina-service-row", district: "beach", start: [105, -540], end: [315, -540], side: -1, setback: 18, spacing: 55, width: 31, depth: 30, height: 0.82, templates: ["Building_Small_1", "Building_Medium_2_001"] },

  // Hills: lower villa massing with fixed spacing.
  { id: "hills-villa-west", district: "hills", start: [-230, 470], end: [-45, 520], side: -1, setback: 20, spacing: 48, width: 27, depth: 28, height: 0.72, templates: ["Building_Small_1"] },
  { id: "hills-villa-east", district: "hills", start: [45, 520], end: [230, 470], side: 1, setback: 20, spacing: 48, width: 27, depth: 28, height: 0.72, templates: ["Building_Small_1"] },
];

export const MIRAGE_LANDMARKS: readonly LandmarkPlan[] = [
  { id: "central-bank", position: [-95, 155], size: [54, 45, 46], kind: "civic" },
  { id: "police-hq", position: [105, 70], size: [62, 48, 34], kind: "civic" },
  { id: "tech-tower", position: [415, 245], size: [48, 48, 92], kind: "tech" },
  { id: "market-hall", position: [-405, 245], size: [70, 48, 22], kind: "market" },
  { id: "neon-casino", position: [70, -110], size: [72, 52, 44], kind: "casino" },
  { id: "grand-hotel", position: [-80, -555], size: [100, 54, 58], kind: "hotel" },
  { id: "port-warehouse", position: [430, -265], size: [92, 58, 24], kind: "industrial" },
  { id: "vip-mansion", position: [0, 545], size: [82, 48, 22], kind: "villa" },
];

export const MIRAGE_ELEVATED_FREEWAY = {
  id: "E1-north-freeway",
  width: 22,
  deckY: 8,
  points: [
    [-600, 390], [-460, 350], [-310, 325], [-155, 338], [0, 355], [165, 332], [330, 290], [590, 325],
  ] as const,
};
