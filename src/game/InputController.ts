import { KeyboardEventTypes, Scene } from "@babylonjs/core";

export type InputState = {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jumpPressed: boolean;
  interactPressed: boolean;
};

export class InputController {
  public readonly state: InputState = {
    forward: false,
    back: false,
    left: false,
    right: false,
    sprint: false,
    jumpPressed: false,
    interactPressed: false,
  };

  constructor(scene: Scene) {
    scene.onKeyboardObservable.add((kbInfo) => {
      const isDown = kbInfo.type === KeyboardEventTypes.KEYDOWN;
      const key = kbInfo.event.key.toLowerCase();

      if (key === "w") this.state.forward = isDown;
      if (key === "s") this.state.back = isDown;
      if (key === "a") this.state.left = isDown;
      if (key === "d") this.state.right = isDown;
      if (key === "shift") this.state.sprint = isDown;

      // Babylon's IKeyboardEvent typing does not expose KeyboardEvent.repeat,
      // so edge-triggered actions are latched only when their previous state is clear.
      if (key === " " && isDown && !this.state.jumpPressed) this.state.jumpPressed = true;
      if (key === "e" && isDown && !this.state.interactPressed) this.state.interactPressed = true;
    });
  }

  consumeJump(): boolean {
    const pressed = this.state.jumpPressed;
    this.state.jumpPressed = false;
    return pressed;
  }

  consumeInteract(): boolean {
    const pressed = this.state.interactPressed;
    this.state.interactPressed = false;
    return pressed;
  }
}
