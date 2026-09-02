import { AnimationGroup } from "@babylonjs/core";

export type CharacterAnimationState =
  | "idle"
  | "walk"
  | "run"
  | "jump"
  | "fall"
  | "land"
  | "punch1"
  | "punch2";

// Exact Quaternius Universal Animation Library names come first. Generic hints
// remain as fallbacks so a future character/animation set can still work.
const NAME_HINTS: Record<CharacterAnimationState, string[]> = {
  idle: ["idle_loop", "idle", "stand", "breathing"],
  walk: ["walk_loop", "walk", "walking"],
  run: ["sprint_loop", "jog_fwd_loop", "run", "running", "sprint"],
  jump: ["jump_start", "jump_loop", "jump", "jumpstart", "takeoff"],
  fall: ["jump_loop", "fall", "air", "falling", "jumpidle"],
  land: ["jump_land", "land", "landing"],
  punch1: ["punch_jab", "jab", "punch"],
  punch2: ["punch_cross", "cross", "punch"],
};

// Quaternius clips are authored at a cinematic/neutral pace. These multipliers
// make gameplay feel responsive while leaving physics/movement speeds unchanged.
const PLAYBACK_SPEED: Record<CharacterAnimationState, number> = {
  idle: 1.0,
  walk: 1.25,
  run: 1.35,
  jump: 1.25,
  fall: 1.10,
  land: 1.50,
  punch1: 1.60,
  punch2: 1.60,
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
    next.start(loop, PLAYBACK_SPEED[state], next.from, next.to, false);
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
    if (state === "land") return this.clips.get("idle");
    if (state === "punch1" || state === "punch2") return this.clips.get("idle");
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
