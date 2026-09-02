import { AnimationGroup } from "@babylonjs/core";

export type CharacterAnimationState =
  | "idle"
  | "walk"
  | "run"
  | "jump"
  | "fall"
  | "land"
  | "punch1"
  | "punch2"
  | "punch3"
  | "punch4";

// Exact Quaternius Universal Animation Library names come first. The pack only
// contains two dedicated punch clips, so punch3/punch4 intentionally reuse them
// to form a longer Jab -> Cross -> Jab -> Cross combo.
const NAME_HINTS: Record<CharacterAnimationState, string[]> = {
  idle: ["idle_loop", "idle", "stand", "breathing"],
  walk: ["walk_loop", "walk", "walking"],
  run: ["sprint_loop", "jog_fwd_loop", "run", "running", "sprint"],
  jump: ["jump_start", "jump_loop", "jump", "jumpstart", "takeoff"],
  fall: ["jump_loop", "fall", "air", "falling", "jumpidle"],
  land: ["jump_land", "land", "landing"],
  punch1: ["punch_jab", "jab", "punch"],
  punch2: ["punch_cross", "cross", "punch"],
  punch3: ["punch_jab", "jab", "punch"],
  punch4: ["punch_cross", "cross", "punch"],
};

// User requested faster punching specifically. Locomotion/jump playback stays at
// the original authored speed; combat is accelerated for a snappier feel.
const PLAYBACK_SPEED: Record<CharacterAnimationState, number> = {
  idle: 1.0,
  walk: 1.0,
  run: 1.0,
  jump: 1.0,
  fall: 1.0,
  land: 1.0,
  punch1: 2.0,
  punch2: 2.0,
  punch3: 2.15,
  punch4: 2.2,
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
    if (!next) return;

    // A later combo step can intentionally reuse the same AnimationGroup (jab or
    // cross). Restart it whenever the logical state changes so punch3/punch4 play.
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
    if (state === "punch1" || state === "punch3") return this.clips.get("punch1") ?? this.clips.get("idle");
    if (state === "punch2" || state === "punch4") return this.clips.get("punch2") ?? this.clips.get("idle");
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
