import { AnimationGroup } from "@babylonjs/core";

export type CharacterAnimationState = "idle" | "walk" | "run" | "jump" | "fall";

// Exact Quaternius Universal Animation Library names come first. Generic hints
// remain as fallbacks so a future character/animation set can still work.
const NAME_HINTS: Record<CharacterAnimationState, string[]> = {
  idle: ["idle_loop", "idle", "stand", "breathing"],
  walk: ["walk_loop", "walk", "walking"],
  run: ["sprint_loop", "jog_fwd_loop", "run", "running", "sprint"],
  jump: ["jump_start", "jump_loop", "jump", "jumpstart", "takeoff"],
  fall: ["jump_loop", "fall", "air", "falling", "jumpidle"],
};

export class CharacterAnimationController {
  private readonly clips = new Map<CharacterAnimationState, AnimationGroup>();
  private activeState: CharacterAnimationState | null = null;
  private activeClip: AnimationGroup | null = null;

  constructor(groups: AnimationGroup[]) {
    for (const state of Object.keys(NAME_HINTS) as CharacterAnimationState[]) {
      const group = this.findBestMatch(groups, NAME_HINTS[state]);
      if (group) {
        group.stop();
        this.clips.set(state, group);
      }
    }
  }

  setState(state: CharacterAnimationState): void {
    if (this.activeState === state) return;
    this.activeState = state;

    const next = this.clips.get(state) ?? this.fallbackClipFor(state);
    if (!next || next === this.activeClip) return;

    if (this.activeClip) {
      this.activeClip.stop();
    }

    const loop = state === "idle" || state === "walk" || state === "run" || state === "fall";
    next.start(loop, 1.0, next.from, next.to, false);
    this.activeClip = next;
  }

  getAvailableStates(): CharacterAnimationState[] {
    return [...this.clips.keys()];
  }

  private fallbackClipFor(state: CharacterAnimationState): AnimationGroup | undefined {
    if (state === "run") return this.clips.get("walk") ?? this.clips.get("idle");
    if (state === "walk") return this.clips.get("run") ?? this.clips.get("idle");
    if (state === "jump") return this.clips.get("fall") ?? this.clips.get("idle");
    if (state === "fall") return this.clips.get("jump") ?? this.clips.get("idle");
    return this.clips.get("idle");
  }

  private findBestMatch(groups: AnimationGroup[], hints: string[]): AnimationGroup | undefined {
    const lowered = groups.map((group) => ({ group, name: group.name.toLowerCase() }));
    for (const hint of hints) {
      const exact = lowered.find(({ name }) => name === hint);
      if (exact) return exact.group;
    }
    for (const hint of hints) {
      const partial = lowered.find(({ name }) => name.includes(hint));
      if (partial) return partial.group;
    }
    return undefined;
  }
}
