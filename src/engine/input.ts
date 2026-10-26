// ============================================================================
// Input System: Pointer Lock, Keyboard, Mouse, and Action Mapping
// ============================================================================

import { useGameStore } from '../state/store';
import { soundEngine } from '../audio/audioEngine';

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  crouch: boolean;
  jump: boolean;
  fire: boolean;
  aim: boolean;
  interact: boolean;
  deltaX: number;
  deltaY: number;
  pointerLocked: boolean;
}

class InputManager {
  public state: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    crouch: false,
    jump: false,
    fire: false,
    aim: false,
    interact: false,
    deltaX: 0,
    deltaY: 0,
    pointerLocked: false
  };

  private domElement: HTMLElement | null = null;
  private onInteractCallback?: () => void;
  private onFireCallback?: () => void;
  private onReloadCallback?: () => void;

  public init(domElement: HTMLElement): void {
    this.domElement = domElement;

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('wheel', this.handleWheel);

    document.addEventListener('pointerlockchange', this.handleLockChange);
  }

  public setCallbacks(callbacks: { onInteract?: () => void; onFire?: () => void; onReload?: () => void }): void {
    this.onInteractCallback = callbacks.onInteract;
    this.onFireCallback = callbacks.onFire;
    this.onReloadCallback = callbacks.onReload;
  }

  public requestPointerLock(): void {
    if (this.domElement && document.pointerLockElement !== this.domElement) {
      soundEngine.init();
      soundEngine.resume();
      this.domElement.requestPointerLock();
    }
  }

  public exitPointerLock(): void {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  private handleLockChange = (): void => {
    this.state.pointerLocked = document.pointerLockElement === this.domElement;
    const store = useGameStore.getState();
    if (!this.state.pointerLocked && store.status === 'playing') {
      store.setStatus('paused');
    }
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    const store = useGameStore.getState();
    if (store.status !== 'playing') {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (store.status === 'paused') store.setStatus('playing');
      }
      return;
    }

    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.state.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.state.backward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.state.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.state.right = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.state.sprint = true;
        store.isSprinting = true;
        break;
      case 'KeyC':
      case 'ControlLeft':
        this.state.crouch = !this.state.crouch;
        store.isCrouching = this.state.crouch;
        break;
      case 'Space':
        this.state.jump = true;
        break;
      case 'KeyF':
        store.toggleFlashlight();
        break;
      case 'KeyR':
        if (this.onReloadCallback) this.onReloadCallback();
        break;
      case 'KeyE':
        this.state.interact = true;
        if (this.onInteractCallback) this.onInteractCallback();
        break;
      case 'Digit1':
        store.switchWeapon('pistol');
        break;
      case 'Digit2':
        store.switchWeapon('shotgun');
        break;
      case 'KeyQ':
        store.useMedkitItem();
        break;
      case 'KeyT':
        store.useBatteryItem();
        break;
      case 'Escape':
      case 'KeyP':
        store.setStatus('paused');
        this.exitPointerLock();
        break;
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.state.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.state.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.state.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.state.right = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.state.sprint = false;
        useGameStore.getState().isSprinting = false;
        break;
      case 'Space':
        this.state.jump = false;
        break;
      case 'KeyE':
        this.state.interact = false;
        break;
    }
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if (!this.state.pointerLocked) return;
    this.state.deltaX += e.movementX;
    this.state.deltaY += e.movementY;
  };

  private handleMouseDown = (e: MouseEvent): void => {
    if (!this.state.pointerLocked) return;
    if (e.button === 0) {
      this.state.fire = true;
      if (this.onFireCallback) this.onFireCallback();
    } else if (e.button === 2) {
      this.state.aim = true;
    }
  };

  private handleMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) {
      this.state.fire = false;
    } else if (e.button === 2) {
      this.state.aim = false;
    }
  };

  private handleWheel = (e: WheelEvent): void => {
    const store = useGameStore.getState();
    if (store.status !== 'playing') return;
    if (e.deltaY > 0) {
      store.switchWeapon('shotgun');
    } else if (e.deltaY < 0) {
      store.switchWeapon('pistol');
    }
  };

  /** Reset per-frame mouse deltas. */
  public resetDeltas(): void {
    this.state.deltaX = 0;
    this.state.deltaY = 0;
  }

  public destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('wheel', this.handleWheel);
    document.removeEventListener('pointerlockchange', this.handleLockChange);
  }
}

export const input = new InputManager();
