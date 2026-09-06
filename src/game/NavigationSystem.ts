import { Vector3 } from "@babylonjs/core";

export class NavigationSystem {
  getDirectionText(actorPosition: Vector3, actorYaw: number, target: Vector3 | null, label: string): string {
    if (!target) return "NAV: Free roam — explore the city";

    const toTarget = target.subtract(actorPosition);
    toTarget.y = 0;
    const distance = toTarget.length();
    if (distance < 0.01) return `NAV: ● ${label} — here`;

    const targetYaw = Math.atan2(toTarget.x, toTarget.z);
    let delta = targetYaw - actorYaw;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;

    const abs = Math.abs(delta);
    let arrow = "↑";
    if (abs < Math.PI / 8) arrow = "↑";
    else if (delta > 0 && abs < (3 * Math.PI) / 8) arrow = "↗";
    else if (delta > 0 && abs < (5 * Math.PI) / 8) arrow = "→";
    else if (delta > 0 && abs < (7 * Math.PI) / 8) arrow = "↘";
    else if (delta < 0 && abs < (3 * Math.PI) / 8) arrow = "↖";
    else if (delta < 0 && abs < (5 * Math.PI) / 8) arrow = "←";
    else if (delta < 0 && abs < (7 * Math.PI) / 8) arrow = "↙";
    else arrow = "↓";

    return `NAV: ${arrow} ${label} • ${Math.round(distance)}m`;
  }
}
