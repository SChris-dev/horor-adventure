// ============================================================================
// First-Person Player Controller: Smooth Movement, Grounding, Powerful Flashlight
// High-performance collision, throttled store sync (ZERO React freezing).
// ============================================================================

import * as THREE from 'three';
import { PLAYER } from '../../core/config';
import { clamp } from '../../core/math';
import { input } from '../../engine/input';
import { physics } from '../../engine/physics';
import { soundEngine } from '../../audio/audioEngine';
import { getTerrainHeight } from '../../world/terrain';
import { useGameStore } from '../../state/store';
import { WeaponSystem, EnemyRayTester } from './weapon';

export class Player {
  public camera: THREE.PerspectiveCamera;
  public weapons = new WeaponSystem();

  // World Position
  public position = new THREE.Vector3(6, 4, 196);
  public isGrounded = true;

  // Local stats (throttled sync to store to avoid React 60fps re-render freezes)
  public stamina = 100;
  public battery = 100;
  private lastSyncedStamina = 100;
  private lastSyncedBattery = 100;

  // Orientation
  public pitch = 0;
  public yaw = 0;

  // Head bobbing & breathing
  private bobTimer = 0;
  private footstepTriggered = false;

  // Flashlight & Local illumination (faithful to legacy/index.html high contrast)
  public flashlight!: THREE.SpotLight;
  public localLight!: THREE.PointLight;
  private flashlightBeam!: THREE.Mesh;
  private flickerTimer = 0;

  // Velocity & Jump
  private verticalVelocity = 0;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 160);
    const startY = getTerrainHeight(6, 196);
    this.position.set(6, startY, 196);
    this.camera.position.set(6, startY + PLAYER.eyeHeight, 196);
  }

  public init(scene: THREE.Scene): void {
    // 1. High-Intensity Tactical Flashlight (300 intensity with decay 2, exactly like legacy index.html)
    this.flashlight = new THREE.SpotLight(0xfff2d6, 280, 50, Math.PI / 6, 0.5, 2.0);
    this.flashlight.position.set(0.18, -0.14, -0.1);
    this.flashlight.target.position.set(0, 0, -1);
    this.flashlight.castShadow = true;
    this.flashlight.shadow.mapSize.set(1024, 1024);
    this.flashlight.shadow.bias = -0.0003;
    this.flashlight.shadow.normalBias = 0.03;
    this.flashlight.shadow.camera.near = 0.1;
    this.flashlight.shadow.camera.far = 40;

    this.camera.add(this.flashlight);
    this.camera.add(this.flashlight.target);

    // 2. Local Fill Light (crisp viewmodel and hands illumination)
    this.localLight = new THREE.PointLight(0xffeedd, 1.2, 10, 2);
    this.localLight.position.set(0.1, -0.1, -0.3);
    this.camera.add(this.localLight);

    // 3. Volumetric Beam Cone
    const coneGeo = new THREE.ConeGeometry(2.8, 22, 16, 1, true);
    coneGeo.translate(0, -11, 0);
    coneGeo.rotateX(-Math.PI / 2);

    const coneMat = new THREE.MeshBasicMaterial({
      color: 0x99b8db,
      transparent: true,
      opacity: 0.045,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.flashlightBeam = new THREE.Mesh(coneGeo, coneMat);
    this.flashlightBeam.position.set(0.18, -0.14, 0);
    this.camera.add(this.flashlightBeam);

    // 4. Weapons Viewmodel
    this.weapons.init(this.camera);

    scene.add(this.camera);
  }

  public update(dt: number, enemyTester?: EnemyRayTester): void {
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

    // Stamina & Speed (smooth local update)
    let speed = PLAYER.walkSpeed;
    if (input.state.sprint && isMoving && this.stamina > 5 && !input.state.crouch) {
      speed = PLAYER.sprintSpeed;
      this.stamina = Math.max(0, this.stamina - PLAYER.staminaDrain * dt);
    } else {
      this.stamina = Math.min(PLAYER.staminaMax, this.stamina + PLAYER.staminaRegen * dt);
    }

    if (input.state.crouch) {
      speed = PLAYER.crouchSpeed;
    }

    // 3. Move Player horizontally
    this.position.x += moveX * speed * dt;
    this.position.z += moveZ * speed * dt;

    // Obstacle pushout (trees, rocks, cabin, fence)
    physics.resolveObstacleCollisions(this.position, 0.45);

    // Valley perimeter bounds check
    const distFromCenter = Math.hypot(this.position.x, this.position.z);
    if (distFromCenter > 224) {
      const angle = Math.atan2(this.position.z, this.position.x);
      this.position.x = Math.cos(angle) * 224;
      this.position.z = Math.sin(angle) * 224;
    }

    // 4. Exact Terrain & Platform Grounding (Smooth step on cabin floors, docks, rocks)
    const rawGroundY = getTerrainHeight(this.position.x, this.position.z);
    const groundY = physics.getPlatformHeight(this.position.x, this.position.y, this.position.z, rawGroundY);

    if (this.isGrounded) {
      this.verticalVelocity = 0;
      this.position.y = groundY;
      if (input.state.jump && this.stamina > PLAYER.jumpCost) {
        this.verticalVelocity = PLAYER.jumpSpeed;
        this.isGrounded = false;
        this.stamina -= PLAYER.jumpCost;
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

    // Sync physics position
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
      this.battery = Math.max(0, this.battery - PLAYER.batteryDrain * dt);
      if (this.battery <= 0) {
        useGameStore.getState().setFlashlight(false);
      }

      let intensityFactor = 1.0;
      if (this.battery < 20 || state.sanity < 35) {
        this.flickerTimer += dt * 15;
        if (Math.sin(this.flickerTimer * 4.3) > 0.6) {
          intensityFactor = 0.15;
        }
      }

      this.flashlight.intensity = 280 * intensityFactor;
      this.localLight.intensity = 1.2 * intensityFactor;
      this.flashlightBeam.visible = true;
    } else {
      this.flashlight.intensity = 0;
      this.localLight.intensity = 0;
      this.flashlightBeam.visible = false;
    }

    // 7. Throttled Store Sync (4% threshold prevents React GC stutters)
    if (Math.abs(this.stamina - this.lastSyncedStamina) >= 4.0 || this.stamina <= 0 || this.stamina >= PLAYER.staminaMax) {
      this.lastSyncedStamina = this.stamina;
      useGameStore.setState({ stamina: Math.round(this.stamina) });
    }
    if (Math.abs(this.battery - this.lastSyncedBattery) >= 4.0 || this.battery <= 0) {
      this.lastSyncedBattery = this.battery;
      useGameStore.setState({ battery: Math.round(this.battery) });
    }

    // 8. Update Weapons
    this.weapons.update(dt);
    if (input.state.fire) {
      this.weapons.shoot(this.camera, enemyTester);
    }
  }
}
