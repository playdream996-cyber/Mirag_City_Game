import { Scene } from "@babylonjs/core";

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

  private readonly onKeyDown = (event: KeyboardEvent) => {
    // Read the browser modifier state on every event so sprint does not depend
    // on receiving Shift in a particular order relative to W/A/S/D.
    this.state.sprint = event.shiftKey || event.code === "ShiftLeft" || event.code === "ShiftRight";
    this.applyKey(event.code, true, event.repeat);
    if (event.code === "Space") event.preventDefault();
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.applyKey(event.code, false, false);
    this.state.sprint = event.shiftKey;
    if (event.code === "Space") event.preventDefault();
  };

  private readonly onBlur = () => {
    this.state.forward = false;
    this.state.back = false;
    this.state.left = false;
    this.state.right = false;
    this.state.sprint = false;
    this.state.jumpPressed = false;
    this.state.interactPressed = false;
  };

  constructor(scene: Scene) {
    void scene;
    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp, { passive: false });
    window.addEventListener("blur", this.onBlur);
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

  isSprintActive(): boolean {
    return this.state.sprint;
  }

  hasJumpQueued(): boolean {
    return this.state.jumpPressed;
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
  }

  private applyKey(code: string, isDown: boolean, isRepeat: boolean): void {
    switch (code) {
      case "KeyW":
      case "ArrowUp":
        this.state.forward = isDown;
        break;
      case "KeyS":
      case "ArrowDown":
        this.state.back = isDown;
        break;
      case "KeyA":
      case "ArrowLeft":
        this.state.left = isDown;
        break;
      case "KeyD":
      case "ArrowRight":
        this.state.right = isDown;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        if (isDown) this.state.sprint = true;
        break;
      case "Space":
        if (isDown && !isRepeat) this.state.jumpPressed = true;
        break;
      case "KeyE":
        if (isDown && !isRepeat) this.state.interactPressed = true;
        break;
    }
  }
}
