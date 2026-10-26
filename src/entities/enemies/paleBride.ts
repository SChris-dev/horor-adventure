// ============================================================================
// The Pale Bride (Wraith)
// 2.2m tall emaciated figure in shredded bridal gown with veil and piercing eyeshine.
// Weeping Angel mechanic: Freezes when observed under flashlight; sprints silently when unseen!
// ============================================================================

import * as THREE from 'three';
import { EnemyBase } from './enemyBase';
import { soundEngine } from '../../audio/audioEngine';
import { useGameStore } from '../../state/store';

export class PaleBride extends EnemyBase {
  private twitchTimer = 0;
  private headMesh!: THREE.Mesh;
  private eyeGlowL!: THREE.Mesh;
  private eyeGlowR!: THREE.Mesh;
  private whisperTimer = 0;
  private attackCooldown = 0;

  constructor(x: number, z: number) {
    super(90, 7.5); // Fast when unobserved
    this.position.set(x, 0, z);
    this.buildModel();
    this.alignToTerrain();
  }

  private buildModel(): void {

    // Emaciated pale grey skin
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0x8a9096,
      roughness: 0.85,
      metalness: 0.1
    });

    // Shredded dirty bridal gown
    const gownMat = new THREE.MeshStandardMaterial({
      color: 0xc4c2ba,
      roughness: 0.95,
      transparent: true,
      opacity: 0.85
    });

    // 1. Torso & Flowing Bridal Dress (2.2m height)
    const dressGeo = new THREE.ConeGeometry(0.55, 1.6, 10, 1, true);
    dressGeo.translate(0, 0.8, 0);
    const dress = new THREE.Mesh(dressGeo, gownMat);
    this.mesh.add(dress);

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.7, 8), skinMat);
    torso.position.set(0, 1.55, 0);
    this.mesh.add(torso);

    // 2. Head with Veil
    const headGeo = new THREE.SphereGeometry(0.16, 12, 12);
    this.headMesh = new THREE.Mesh(headGeo, skinMat);
    this.headMesh.position.set(0, 1.95, 0);
    this.mesh.add(this.headMesh);

    // Glowing sunken eyeshine visible in dark and fog
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
    this.eyeGlowL = new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 6), eyeMat);
    this.eyeGlowL.position.set(-0.06, 0.02, -0.14);
    this.eyeGlowR = new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 6), eyeMat);
    this.eyeGlowR.position.set(0.06, 0.02, -0.14);
    this.headMesh.add(this.eyeGlowL, this.eyeGlowR);

    // Long disjointed arms
    const armGeo = new THREE.CylinderGeometry(0.04, 0.03, 1.1, 6);
    armGeo.translate(0, -0.55, 0);

    const armL = new THREE.Mesh(armGeo, skinMat);
    armL.position.set(-0.28, 1.75, 0);
    armL.rotation.z = 0.25;
    armL.rotation.x = -0.3;

    const armR = new THREE.Mesh(armGeo, skinMat);
    armR.position.set(0.28, 1.75, 0);
    armR.rotation.z = -0.25;
    armR.rotation.x = -0.3;

    this.mesh.add(armL, armR);
  }

  public update(dt: number, playerPos: THREE.Vector3, camera: THREE.Camera): void {
    if (this.isDead) return;

    const dist = this.position.distanceTo(playerPos);
    const cameraForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const isObserved = this.isObservedByPlayer(camera.position, cameraForward, 0.58);
    const state = useGameStore.getState();
    const flashlightHitting = state.flashlightOn && dist < 45;

    // Play haunting whisper periodically
    this.whisperTimer -= dt;
    if (this.whisperTimer <= 0 && dist < 28) {
      soundEngine.playBrideWhisper(this.position);
      this.whisperTimer = 5 + Math.random() * 8;
    }

    // WEEPING ANGEL LOGIC:
    // If player is looking directly at her with flashlight, she FREEZES dead in her tracks!
    if (isObserved && flashlightHitting) {
      this.state = 'freeze';

      // Twitching uncanny stop-motion jitter while frozen
      this.twitchTimer += dt;
      if (Math.sin(this.twitchTimer * 18) > 0.8) {
        this.headMesh.rotation.z = (Math.random() - 0.5) * 0.3;
        this.headMesh.rotation.y = (Math.random() - 0.5) * 0.2;
      }
      return;
    }

    // Otherwise, SPRINT IN SILENCE towards player!
    this.state = 'chase';
    const toPlayer = playerPos.clone().sub(this.position);
    toPlayer.y = 0;
    const moveDist = toPlayer.length();

    if (moveDist > 1.8) {
      toPlayer.normalize();
      this.position.addScaledVector(toPlayer, this.speed * dt);
      this.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z) + Math.PI;
    } else {
      // Attack player!
      if (this.attackCooldown <= 0) {
        state.takeDamage(28, 'Torn apart by the Pale Bride');
        state.drainSanity(25);
        this.attackCooldown = 1.4;
      }
    }

    if (this.attackCooldown > 0) {
      this.attackCooldown -= dt;
    }

    this.alignToTerrain();
  }

  protected onHit(): void {
    soundEngine.playBrideWhisper(this.position);
    useGameStore.getState().triggerHitMarker();
    // Knockback
    this.position.y += 0.2;
  }

  protected onDeath(): void {
    soundEngine.playBrideWhisper(this.position);
    this.mesh.visible = false;
  }
}
