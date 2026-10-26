// ============================================================================
// The Hollowed (Infected Shambler)
// Blind mutated villager with stitched eyes and unhinged bloody jaw.
// Hunts purely by sound (footsteps, sprinting, gunfire) and close flashlight beam!
// ============================================================================

import * as THREE from 'three';
import { EnemyBase } from './enemyBase';
import { soundEngine } from '../../audio/audioEngine';
import { useGameStore } from '../../state/store';
import { input } from '../../engine/input';

export class Shambler extends EnemyBase {
  private growlTimer = 0;
  private attackCooldown = 0;
  private walkPhase = 0;
  private limbL!: THREE.Mesh;
  private limbR!: THREE.Mesh;
  private jawMesh!: THREE.Mesh;

  private alertTimer = 0;
  private targetNoisePos: THREE.Vector3 | null = null;

  constructor(x: number, z: number) {
    super(70, 2.2); // Slower base speed, accelerates in berserk
    this.position.set(x, 0, z);
    this.buildModel();
    this.alignToTerrain();
  }

  private buildModel(): void {

    // Bloody decayed flesh material
    const fleshMat = new THREE.MeshStandardMaterial({
      color: 0x5a463c,
      roughness: 0.8,
      metalness: 0.1
    });

    const goreMat = new THREE.MeshStandardMaterial({
      color: 0x880e0e,
      roughness: 0.45,
      metalness: 0.2
    });

    // 1. Twisted Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.32), fleshMat);
    torso.position.set(0, 1.15, 0);
    this.mesh.add(torso);

    // 2. Mutilated Head with torn jaw
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.24), fleshMat);
    head.position.set(0, 1.68, 0.04);
    this.mesh.add(head);

    // Unhinged bloody jaw hanging low
    this.jawMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.18), goreMat);
    this.jawMesh.position.set(0, 1.5, -0.08);
    this.mesh.add(this.jawMesh);

    // 3. Arms with claws
    const armGeo = new THREE.BoxGeometry(0.12, 0.75, 0.12);
    armGeo.translate(0, -0.35, 0);

    this.limbL = new THREE.Mesh(armGeo, fleshMat);
    this.limbL.position.set(-0.34, 1.45, 0);

    this.limbR = new THREE.Mesh(armGeo, fleshMat);
    this.limbR.position.set(0.34, 1.45, 0);

    this.mesh.add(this.limbL, this.limbR);

    // 4. Legs
    const legGeo = new THREE.BoxGeometry(0.14, 0.8, 0.14);
    legGeo.translate(0, -0.4, 0);

    const legL = new THREE.Mesh(legGeo, fleshMat);
    legL.position.set(-0.16, 0.8, 0);

    const legR = new THREE.Mesh(legGeo, fleshMat);
    legR.position.set(0.16, 0.8, 0);

    this.mesh.add(legL, legR);
  }

  public update(dt: number, playerPos: THREE.Vector3, camera: THREE.Camera): void {
    if (this.isDead) return;

    const dist = this.position.distanceTo(playerPos);
    const state = useGameStore.getState();

    // Noise Perception:
    // Sprinting makes noise within 18m
    const isPlayerSprinting = input.state.sprint && (input.state.forward || input.state.backward);
    const playerNoise = isPlayerSprinting ? 22 : (input.state.crouch ? 3 : 8);

    // Flashlight beam detection at close range
    const flashlightHitting = state.flashlightOn && dist < 14;

    if (dist < playerNoise || flashlightHitting) {
      this.alertTimer = 6.0; // Stay agitated
      this.targetNoisePos = playerPos.clone();
      this.state = 'chase';
    }

    if (this.alertTimer > 0) {
      this.alertTimer -= dt;
      if (this.alertTimer <= 0) {
        this.state = 'idle';
        this.targetNoisePos = null;
      }
    }

    // Sound effects
    this.growlTimer -= dt;
    if (this.growlTimer <= 0 && dist < 35) {
      soundEngine.playMonsterGrowl(this.position, this.state === 'chase' ? 1.2 : 0.85);
      this.growlTimer = (this.state === 'chase' ? 2.5 : 6) + Math.random() * 4;
    }

    // Movement logic
    const currentSpeed = this.state === 'chase' ? 4.8 : 1.6;

    if (this.state === 'chase' && this.targetNoisePos) {
      const toTarget = this.targetNoisePos.clone().sub(this.position);
      toTarget.y = 0;
      const targetDist = toTarget.length();

      if (targetDist > 1.4) {
        toTarget.normalize();
        this.position.addScaledVector(toTarget, currentSpeed * dt);
        this.mesh.rotation.y = Math.atan2(toTarget.x, toTarget.z) + Math.PI;

        // Limb swinging animation
        this.walkPhase += dt * (this.state === 'chase' ? 10 : 4);
        this.limbL.rotation.x = Math.sin(this.walkPhase) * 0.7;
        this.limbR.rotation.x = -Math.sin(this.walkPhase) * 0.7;
      } else if (dist < 2.0) {
        // Attack
        if (this.attackCooldown <= 0) {
          state.takeDamage(24, 'Mutilated by the Hollowed Shambler');
          this.attackCooldown = 1.2;
        }
      }
    }

    if (this.attackCooldown > 0) {
      this.attackCooldown -= dt;
    }

    this.alignToTerrain();
  }

  protected onHit(): void {
    soundEngine.playMonsterGrowl(this.position, 1.4);
    useGameStore.getState().triggerHitMarker();
    this.alertTimer = 8.0;
    this.state = 'chase';
  }

  protected onDeath(): void {
    soundEngine.playMonsterGrowl(this.position, 0.6);
    this.mesh.visible = false;
  }
}
