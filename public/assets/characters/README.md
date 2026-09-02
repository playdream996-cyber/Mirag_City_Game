# Player Character Asset Contract

Place the production player model here as:

`public/assets/characters/player.glb`

## Required model setup
- GLB / glTF 2.0
- Character facing +Z in bind/reference pose if possible
- Feet close to local Y=0
- One main humanoid skeleton
- Skinning and materials embedded in the GLB
- Keep model scale consistent; runtime normalizes visual height to about 1.85 m

## Recommended animation clip names
The runtime automatically searches animation-group names using these hints:

- Idle: `Idle`, `Stand`, `Breathing`
- Walk: `Walk`, `Walking`
- Run: `Run`, `Running`, `Sprint`
- Jump: `Jump`, `JumpStart`, `Takeoff`
- Fall: `Fall`, `Falling`, `Air`, `JumpIdle`

Names are matched case-insensitively and partial matches are supported.

## Current fallback behavior
If `player.glb` is absent or fails to load, the game intentionally creates a simple blue capsule visual. Gameplay physics remains active, so missing art does not block development.

## Important separation
The GLB is visual only. Babylon's `PhysicsCharacterController` capsule is authoritative for movement and collision. Do not add gameplay collision meshes to the player GLB.
