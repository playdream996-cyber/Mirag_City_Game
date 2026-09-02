import { KeyboardEventTypes, Scene } from "@babylonjs/core";

export type InputState = {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jumpPressed: boolean;
};

export class InputController {
  public readonly state: InputState = {
    forward: false,
    back: false,
    left: false,
    right: false,
    sprint: false,
    jumpPressed: false,
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
      if (key === " " && isDown) this.state.jumpPressed = true;
    });
  }

  consumeJump(): boolean {
    const pressed = this.state.jumpPressed;
    this.state.jumpPressed = false;
    return pressed;
  }
}
