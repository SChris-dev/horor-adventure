// ============================================================================
// First-Person Player Controller: Smooth Movement, Grounding, Powerful Flashlight
// Bulletproof collision and terrain height clamping (impossible to fall or get stuck)
// ============================================================================

import * as THREE from 'three';
import { PLAYER } from '../../core/config';
import { clamp } from '../../core/math';
import { input } from '../../engine/input';
import { physics } from '../../engine/physics';
import { soundEngine } from '../../audio/audioEngine';
import { getTerrainHeight } from '../../world/terrain';
import { useGameStore } from '../../state/store';
import { WeaponSystem } from './weapon';

export class Player {
  public camera: THREE.PerspectiveCamera;
  public weapons = new WeaponSystem();

  // World Position
  public position = new THREE.Vector3(6, 4, 196);
  public isGrounded = true;

  // Orientation
  public pitch = 0;
  public yaw = 0;

  // Head bobbing & breathing
  private bobTimer = 0;
  private footstepTriggered = false;

  // Flashlight & Local illumination
  public flashlight!: THREE.SpotLight;
  public localLight!: THREE.PointLight;
  private flashlightBeam!: THREE.Mesh;
  private flickerTimer = 0;

  // Velocity & Jump
  private verticalVelocity = 0;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 160);
    const startY = getTerrainHeight(6, 196);
    this.position.set(6, startY, 196);
    this.camera.position.set(6, startY + PLAYER.eyeHeight, 196);
  }

  public init(scene: THREE.Scene): void {
    // 1. Build Powerful Forward Flashlight Spotlight
    this.flashlight = new THREE.SpotLight(0xfff5e6, 5.5, 75, Math.PI / 4, 0.35, 1.0);
    this.flashlight.position.set(0.15, -0.1, 0.1);
    this.flashlight.target.position.set(0, 0, -10);
    this.flashlight.castShadow = true;
    this.flashlight.shadow.mapSize.width = 1024;
    this.flashlight.shadow.mapSize.height = 1024;

    this.camera.add(this.flashlight);
    this.camera.add(this.flashlight.target);

    // 2. Local Fill Light (guarantees hands, weapon, and immediate ground are beautifully illuminated)
    this.localLight = new THREE.PointLight(0xffeedd, 1.6, 14, 1.2);
    this.localLight.position.set(0, 0, -0.2);
    this.camera.add(this.localLight);

    // 3. Volumetric Beam Cone
    const coneGeo = new THREE.ConeGeometry(3.2, 24, 16, 1, true);
    coneGeo.translate(0, -12, 0);
    coneGeo.rotateX(-Math.PI / 2);

    const coneMat = new THREE.MeshBasicMaterial({
      color: 0x99b8db,
      transparent: true,
      opacity: 0.055,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.flashlightBeam = new THREE.Mesh(coneGeo, coneMat);
    this.flashlightBeam.position.set(0.15, -0.1, 0);
    this.camera.add(this.flashlightBeam);

    // 4. Weapons Viewmodel
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

    // 3. Move Player horizontally
    this.position.x += moveX * speed * dt;
    this.position.z += moveZ * speed * dt;

    // Valley perimeter bounds check
    const distFromCenter = Math.hypot(this.position.x, this.position.z);
    if (distFromCenter > 224) {
      const angle = Math.atan2(this.position.z, this.position.x);
      this.position.x = Math.cos(angle) * 224;
      this.position.z = Math.sin(angle) * 224;
    }

    // 4. Exact Terrain Grounding (Bulletproof: impossible to fall through the world!)
    const groundY = getTerrainHeight(this.position.x, this.position.z);

    if (this.isGrounded) {
      this.verticalVelocity = 0;
      this.position.y = groundY;
      if (input.state.jump && state.stamina > PLAYER.jumpCost) {
        this.verticalVelocity = PLAYER.jumpSpeed;
        this.isGrounded = false;
        useGameStore.setState({ stamina: state.stamina - PLAYER.jumpCost });
      }
    } else {
      this.verticalVelocity -= PLAYER.gravity * dt;
      this.position.y += this.verticalVelocity * dt;
      if (this.position.y <= groundY) {
        this.position.y = groundY;
        this.verticalVelocity = 0;
        this.isGrounded = true;
      }
    }

    // Sync physics body position for monster AI and raycasts
    physics.setPlayerPosition(this.position);

    // 5. Update Camera Position and Head Bobbing
    const targetEyeHeight = input.state.crouch ? PLAYER.crouchEyeHeight : PLAYER.eyeHeight;

    let bobY = 0;
    let bobX = 0;
    if (isMoving && this.isGrounded) {
      const bobFreq = input.state.sprint ? 14 : 9;
      this.bobTimer += dt * bobFreq;
      bobY = Math.sin(this.bobTimer) * (input.state.sprint ? 0.055 : 0.03);
      bobX = Math.cos(this.bobTimer * 0.5) * (input.state.sprint ? 0.035 : 0.015);

      // Footstep sound at trough of bob
      if (Math.sin(this.bobTimer) < -0.92) {
        if (!this.footstepTriggered) {
          soundEngine.playFootstep(this.position, 'dirt');
          this.footstepTriggered = true;
        }
      } else {
        this.footstepTriggered = false;
      }
    } else {
      // Subtle idle breathing sway
      this.bobTimer += dt * 1.5;
      bobY = Math.sin(this.bobTimer) * 0.008;
      bobX = Math.cos(this.bobTimer * 0.7) * 0.004;
    }

    this.camera.position.set(this.position.x + bobX, this.position.y + targetEyeHeight + bobY, this.position.z);
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));

    // 6. Flashlight Logic & Battery Drain
    if (state.flashlightOn) {
      state.drainBattery(PLAYER.batteryDrain * dt);
      let intensityFactor = 1.0;

      // Realistic horror flicker at low battery or low sanity
      if (state.battery < 20 || state.sanity < 35) {
        this.flickerTimer += dt * 15;
        if (Math.sin(this.flickerTimer * 4.3) > 0.6) {
          intensityFactor = 0.15;
        }
      }

      this.flashlight.intensity = 5.5 * intensityFactor;
      this.localLight.intensity = 1.6 * intensityFactor;
      this.flashlightBeam.visible = true;
    } else {
      this.flashlight.intensity = 0;
      this.localLight.intensity = 0;
      this.flashlightBeam.visible = false;
    }

    // 7. Update Weapons
    this.weapons.update(dt);
    if (input.state.fire) {
      this.weapons.shoot(this.camera, onEnemyHit);
    }
  }
}
