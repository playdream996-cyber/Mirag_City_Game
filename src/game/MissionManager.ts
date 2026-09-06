import { Color3, MeshBuilder, Scene, StandardMaterial, Vector3 } from "@babylonjs/core";

export type MissionStatus = "available" | "active" | "complete";

type Mission = {
  id: string;
  title: string;
  objective: string;
  position: Vector3;
  completionPosition: Vector3;
  radius: number;
  completionRadius: number;
  status: MissionStatus;
};

export class MissionManager {
  private readonly missions: Mission[] = [
    { id: "bank", title: "Bank Heist", objective: "Reach the getaway point after casing Central Bank.", position: new Vector3(-37.5, 0, 13), completionPosition: new Vector3(-150, 0, 0), radius: 10, completionRadius: 14, status: "available" },
    { id: "police", title: "Police Pursuit", objective: "Escape from Police HQ to the west boulevard.", position: new Vector3(37.5, 0, 13), completionPosition: new Vector3(-75, 0, 75), radius: 10, completionRadius: 14, status: "available" },
    { id: "gang", title: "Gang Territory", objective: "Move from the Old Town gang block to the safe corner.", position: new Vector3(-187.5, 0, -13), completionPosition: new Vector3(-300, 0, -75), radius: 12, completionRadius: 15, status: "available" },
    { id: "race", title: "Street Race", objective: "Reach the Neon Quarter finish checkpoint.", position: new Vector3(112.5, 0, -75), completionPosition: new Vector3(300, 0, -225), radius: 12, completionRadius: 18, status: "available" },
    { id: "port", title: "Port Smuggling", objective: "Deliver the pickup from the port to the east highway exit.", position: new Vector3(262.5, 0, 150), completionPosition: new Vector3(340, 0, -75), radius: 12, completionRadius: 18, status: "available" },
    { id: "mansion", title: "Mansion Job", objective: "Leave the Hills mansion area and reach the Old Town handoff.", position: new Vector3(-262.5, 0, 225), completionPosition: new Vector3(-150, 0, 75), radius: 12, completionRadius: 16, status: "available" },
  ];

  private activeMission: Mission | null = null;
  private lastMessage = "Explore the city and approach a mission marker.";

  constructor(private readonly scene: Scene) {
    const markerMat = new StandardMaterial("missionMarkerMat", scene);
    markerMat.diffuseColor = new Color3(0.95, 0.68, 0.12);
    markerMat.emissiveColor = new Color3(0.35, 0.18, 0.02);

    const finishMat = new StandardMaterial("missionFinishMat", scene);
    finishMat.diffuseColor = new Color3(0.12, 0.72, 0.38);
    finishMat.emissiveColor = new Color3(0.02, 0.22, 0.08);

    for (const mission of this.missions) {
      const marker = MeshBuilder.CreateCylinder(`mission-${mission.id}`, { diameter: 3.4, height: 0.18, tessellation: 28 }, scene);
      marker.position = mission.position.add(new Vector3(0, 0.12, 0));
      marker.material = markerMat;

      const finish = MeshBuilder.CreateCylinder(`mission-finish-${mission.id}`, { diameter: 3.0, height: 0.12, tessellation: 28 }, scene);
      finish.position = mission.completionPosition.add(new Vector3(0, 0.08, 0));
      finish.material = finishMat;
      finish.setEnabled(false);
    }
  }

  update(actorPosition: Vector3, interactPressed: boolean): void {
    if (this.activeMission) {
      const finishDistance = Vector3.Distance(actorPosition, this.activeMission.completionPosition);
      this.setFinishMarkerVisible(this.activeMission.id, true);
      if (finishDistance <= this.activeMission.completionRadius) {
        this.activeMission.status = "complete";
        this.lastMessage = `${this.activeMission.title} complete.`;
        this.setFinishMarkerVisible(this.activeMission.id, false);
        this.activeMission = null;
        return;
      }
      this.lastMessage = `${this.activeMission.title}: ${this.activeMission.objective} (${Math.round(finishDistance)}m)`;
      return;
    }

    const nearby = this.getNearestAvailable(actorPosition);
    if (!nearby) {
      this.lastMessage = "All available missions are complete.";
      return;
    }

    const distance = Vector3.Distance(actorPosition, nearby.position);
    if (distance <= nearby.radius) {
      this.lastMessage = `Press E to start: ${nearby.title}`;
      if (interactPressed) {
        nearby.status = "active";
        this.activeMission = nearby;
        this.setFinishMarkerVisible(nearby.id, true);
        this.lastMessage = `${nearby.title}: ${nearby.objective}`;
      }
    } else {
      this.lastMessage = `Nearest mission: ${nearby.title} (${Math.round(distance)}m)`;
    }
  }

  getHudText(): string {
    return this.activeMission ? `MISSION: ${this.lastMessage}` : this.lastMessage;
  }

  getNavigationTarget(position: Vector3): Vector3 | null {
    if (this.activeMission) return this.activeMission.completionPosition.clone();
    return this.getNearestAvailable(position)?.position.clone() ?? null;
  }

  getNavigationLabel(position: Vector3): string {
    if (this.activeMission) return `${this.activeMission.title} finish`;
    return this.getNearestAvailable(position)?.title ?? "Explore";
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

  private setFinishMarkerVisible(missionId: string, visible: boolean): void {
    this.scene.getMeshByName(`mission-finish-${missionId}`)?.setEnabled(visible);
  }
}
