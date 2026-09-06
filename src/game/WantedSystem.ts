export class WantedSystem {
  private heat = 0;
  private cooldown = 0;

  addCrime(amount: number): void {
    this.heat = Math.min(5, this.heat + amount);
    this.cooldown = 10;
  }

  update(dt: number): void {
    if (this.heat <= 0) return;
    if (this.cooldown > 0) {
      this.cooldown = Math.max(0, this.cooldown - dt);
      return;
    }
    this.heat = Math.max(0, this.heat - dt * 0.08);
  }

  getStars(): number {
    return Math.ceil(this.heat);
  }

  getHudText(): string {
    const stars = this.getStars();
    return `WANTED: ${stars > 0 ? "★".repeat(stars) + "☆".repeat(5 - stars) : "☆☆☆☆☆"}`;
  }
}
