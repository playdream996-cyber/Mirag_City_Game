import { Color3, MeshBuilder, Scene, StandardMaterial, Vector3 } from "@babylonjs/core";

export type MissionStatus = "available" | "active" | "complete";

type Mission = {
  id: string;
  title: string;
  objective: string;
  position: Vector3;
  radius: number;
  status: MissionStatus;
};

export class MissionManager {
  private readonly missions: Mission[] = [
    { id: "bank", title: "Bank Heist", objective: "Reach Central Bank and start the robbery.", position: new Vector3(-35, 0, 35), radius: 15, status: "available" },
    { id: "police", title: "Police Pursuit", objective: "Trigger a pursuit near Police HQ.", position: new Vector3(35, 0, 35), radius: 15, status: "available" },
    { id: "gang", title: "Gang Territory", objective: "Take control of the Old Town gang block.", position: new Vector3(-175, 0, -35), radius: 18, status: "available" },
    { id: "race", title: "Street Race", objective: "Start the Neon Quarter street race.", position: new Vector3(105, 0, -105), radius: 18, status: "available" },
    { id: "port", title: "Port Smuggling", objective: "Reach the container yard pickup point.", position: new Vector3(245, 0, 175), radius: 20, status: "available" },
    { id: "mansion", title: "Mansion Job", objective: "Infiltrate the Hills mansion grounds.", position: new Vector3(-245, 0, 245), radius: 20, status: "available" },
  ];

  private activeMission: Mission | null = null;
  private lastMessage = "Explore the city and approach a mission marker.";

  constructor(private readonly scene: Scene) {
    const markerMat = new StandardMaterial("missionMarkerMat", scene);
    markerMat.diffuseColor = new Color3(0.95, 0.68, 0.12);
    markerMat.emissiveColor = new Color3(0.35, 0.18, 0.02);

    for (const mission of this.missions) {
      const marker = MeshBuilder.CreateCylinder(`mission-${mission.id}`, { diameter: 3.4, height: 0.18, tessellation: 28 }, scene);
      marker.position = mission.position.add(new Vector3(0, 0.12, 0));
      marker.material = markerMat;
    }
  }

  update(playerPosition: Vector3, interactPressed: boolean): void {
    if (this.activeMission) {
      const distance = Vector3.Distance(playerPosition, this.activeMission.position);
      if (distance > this.activeMission.radius * 2.5) {
        this.activeMission.status = "complete";
        this.lastMessage = `${this.activeMission.title} complete.`;
        this.activeMission = null;
      }
      return;
    }

    const nearby = this.getNearestAvailable(playerPosition);
    if (!nearby) {
      this.lastMessage = "Explore the city and approach a mission marker.";
      return;
    }

    const distance = Vector3.Distance(playerPosition, nearby.position);
    if (distance <= nearby.radius) {
      this.lastMessage = `Press E to start: ${nearby.title}`;
      if (interactPressed) {
        nearby.status = "active";
        this.activeMission = nearby;
        this.lastMessage = `${nearby.title}: ${nearby.objective}`;
      }
    } else {
      this.lastMessage = `Nearest mission: ${nearby.title} (${Math.round(distance)}m)`;
    }
  }

  getHudText(): string {
    if (this.activeMission) return `MISSION: ${this.activeMission.title} — ${this.activeMission.objective}`;
    return this.lastMessage;
  }

  private getNearestAvailable(position: Vector3): Mission | null {
    let best: Mission | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const mission of this.missions) {
      if (mission.status !== "available") continue;
      const distance = Vector3.Distance(position, mission.position);
      if (distance < bestDistance) {
        best = mission;
        bestDistance = distance;
      }
    }
    return best;
  }
}
