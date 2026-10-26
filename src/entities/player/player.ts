// ============================================================================
// First-Person Player Controller: Kinematic Movement, Head Bob, Realistic Flashlight
// ============================================================================

import * as THREE from 'three';
import { PLAYER } from '../../core/config';
import { clamp } from '../../core/math';
import { input } from '../../engine/input';
import { physics } from '../../engine/physics';
import { soundEngine } from '../../audio/audioEngine';
import { getTextureAtlas } from '../../engine/textures';
import { useGameStore } from '../../state/store';
import { WeaponSystem } from './weapon';

export class Player {
  public camera: THREE.PerspectiveCamera;
  public weapons = new WeaponSystem();

  // Orientation
  public pitch = 0;
  public yaw = 0;

  // Head bobbing & breathing
  private bobTimer = 0;
  private footstepTriggered = false;

  // Flashlight
  public flashlight!: THREE.SpotLight;
  private flashlightBeam!: THREE.Mesh;
  private flickerTimer = 0;

  // Velocity & Jump
  private verticalVelocity = 0;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 140);
    this.camera.position.set(6, 10, 196);
  }

  public init(scene: THREE.Scene): void {
    const textures = getTextureAtlas();

    // 1. Build Flashlight Spotlight
    this.flashlight = new THREE.SpotLight(0xfff7e6, 3.2, 55, Math.PI / 5.5, 0.45, 1.2);
    this.flashlight.position.set(0.18, -0.15, 0.1);
    this.flashlight.target.position.set(0, 0, -10);
    this.flashlight.map = textures.flashlightCookie;
    this.flashlight.castShadow = true;
    this.flashlight.shadow.mapSize.width = 1024;
    this.flashlight.shadow.mapSize.height = 1024;
    this.flashlight.shadow.bias = -0.001;

    this.camera.add(this.flashlight);
    this.camera.add(this.flashlight.target);

    // 2. Volumetric Beam Cone
    const coneGeo = new THREE.ConeGeometry(3.6, 22, 16, 1, true);
    coneGeo.translate(0, -11, 0);
    coneGeo.rotateX(-Math.PI / 2);

    const coneMat = new THREE.MeshBasicMaterial({
      color: 0x99b4d1,
      transparent: true,
      opacity: 0.045,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.flashlightBeam = new THREE.Mesh(coneGeo, coneMat);
    this.flashlightBeam.position.set(0.18, -0.15, 0);
    this.camera.add(this.flashlightBeam);

    // 3. Weapons Viewmodel
    this.weapons.init(this.camera);

    scene.add(this.camera);
  }

  public update(dt: number, onEnemyHit?: (point: THREE.Vector3, damage: number) => void): void {
    const state = useGameStore.getState();
    if (state.status !== 'playing') return;

    // 1. Mouse Look (Pitch & Yaw)
    const sens = state.mouseSensitivity;
    this.yaw -= input.state.deltaX * sens;
    this.pitch -= input.state.deltaY * sens;
    this.pitch = clamp(this.pitch, -1.45, 1.45); // Clamped look up/down
    input.resetDeltas();

    // 2. Calculate Movement Direction
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    let moveX = 0;
    let moveZ = 0;
    if (input.state.forward) { moveX += forward.x; moveZ += forward.z; }
    if (input.state.backward) { moveX -= forward.x; moveZ -= forward.z; }
    if (input.state.right) { moveX += right.x; moveZ += right.z; }
    if (input.state.left) { moveX -= right.x; moveZ -= right.z; }

    const isMoving = moveX !== 0 || moveZ !== 0;
    const moveLen = Math.hypot(moveX, moveZ);
    if (moveLen > 0) {
      moveX /= moveLen;
      moveZ /= moveLen;
    }

    // Stamina & Speed
    let speed = PLAYER.walkSpeed;
    if (input.state.sprint && isMoving && state.stamina > 5 && !input.state.crouch) {
      speed = PLAYER.sprintSpeed;
      useGameStore.setState({ stamina: Math.max(0, state.stamina - PLAYER.staminaDrain * dt) });
    } else {
      useGameStore.setState({ stamina: Math.min(PLAYER.staminaMax, state.stamina + PLAYER.staminaRegen * dt) });
    }

    if (input.state.crouch) {
      speed = PLAYER.crouchSpeed;
    }

    // 3. Vertical Velocity & Gravity
    const grounded = physics.isGrounded();
    if (grounded) {
      this.verticalVelocity = 0;
      if (input.state.jump && state.stamina > PLAYER.jumpCost) {
        this.verticalVelocity = PLAYER.jumpSpeed;
        useGameStore.setState({ stamina: state.stamina - PLAYER.jumpCost });
      }
    } else {
      this.verticalVelocity -= PLAYER.gravity * dt;
    }

    // 4. Move via Rapier Kinematic Controller
    const desiredMove = new THREE.Vector3(moveX * speed * dt, this.verticalVelocity * dt, moveZ * speed * dt);
    physics.movePlayer(desiredMove);

    // 5. Update Camera Position and Head Bobbing
    const bodyPos = physics.getPlayerPosition();
    const targetEyeHeight = input.state.crouch ? PLAYER.crouchEyeHeight : PLAYER.eyeHeight;

    let bobY = 0;
    let bobX = 0;
    if (isMoving && grounded) {
      const bobFreq = input.state.sprint ? 14 : 9;
      this.bobTimer += dt * bobFreq;
      bobY = Math.sin(this.bobTimer) * (input.state.sprint ? 0.065 : 0.035);
      bobX = Math.cos(this.bobTimer * 0.5) * (input.state.sprint ? 0.045 : 0.02);

      // Footstep sound at trough of bob
      if (Math.sin(this.bobTimer) < -0.92) {
        if (!this.footstepTriggered) {
          soundEngine.playFootstep(bodyPos, 'dirt');
          this.footstepTriggered = true;
        }
      } else {
        this.footstepTriggered = false;
      }
    } else {
      // Subtle idle breathing sway
      this.bobTimer += dt * 1.5;
      bobY = Math.sin(this.bobTimer) * 0.01;
      bobX = Math.cos(this.bobTimer * 0.7) * 0.005;
    }

    this.camera.position.set(bodyPos.x + bobX, bodyPos.y + targetEyeHeight + bobY, bodyPos.z);
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));

    // 6. Flashlight Logic & Battery Drain
    if (state.flashlightOn) {
      state.drainBattery(PLAYER.batteryDrain * dt);
      let lightIntensity = 3.2;

      // Realistic horror flicker at low battery or low sanity
      if (state.battery < 20 || state.sanity < 35) {
        this.flickerTimer += dt * 15;
        if (Math.sin(this.flickerTimer * 4.3) > 0.6) {
          lightIntensity *= 0.15;
        }
      }

      this.flashlight.intensity = lightIntensity;
      this.flashlightBeam.visible = true;
    } else {
      this.flashlight.intensity = 0;
      this.flashlightBeam.visible = false;
    }

    // 7. Update Weapons
    this.weapons.update(dt);
    if (input.state.fire) {
      this.weapons.shoot(this.camera, onEnemyHit);
    }
  }
}
