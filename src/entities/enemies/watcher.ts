// ============================================================================
// The Watcher (Tall Fog Stalker)
// Towering 3.2m silhouette standing motionlessly at the fog perimeter.
// Piercing eyeshine. Looking directly at it drains sanity, induces hallucinations and static!
// ============================================================================

import * as THREE from 'three';
import { EnemyBase } from './enemyBase';
import { soundEngine } from '../../audio/audioEngine';
import { useGameStore } from '../../state/store';

export class Watcher extends EnemyBase {
  private humTimer = 0;
  private eyeMeshL!: THREE.Mesh;
  private eyeMeshR!: THREE.Mesh;
  private gazeTimer = 0;

  constructor(x: number, z: number) {
    super(160, 0); // Stationary stalker
    this.position.set(x, 0, z);
    this.buildModel();
    this.alignToTerrain();
  }

  private buildModel(): void {
    // Pure pitch-black shadow silhouette
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x020304
    });

    // 1. Towering slender body (3.2m height)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 2.2, 8), shadowMat);
    body.position.set(0, 1.8, 0);
    this.mesh.add(body);

    // 2. Head with hollow reflective eyeshine
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), shadowMat);
    head.position.set(0, 3.0, 0);
    this.mesh.add(head);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xddffff });
    this.eyeMeshL = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), eyeMat);
    this.eyeMeshL.position.set(-0.06, 0.04, -0.16);
    this.eyeMeshR = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), eyeMat);
    this.eyeMeshR.position.set(0.06, 0.04, -0.16);
    head.add(this.eyeMeshL, this.eyeMeshR);

    // Long dangling tendril arms
    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 1.8, 6), shadowMat);
    armL.position.set(-0.35, 1.9, 0);
    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 1.8, 6), shadowMat);
    armR.position.set(0.35, 1.9, 0);
    this.mesh.add(armL, armR);
  }

  public update(dt: number, playerPos: THREE.Vector3, camera: THREE.Camera): void {
    if (this.isDead) return;

    const dist = this.position.distanceTo(playerPos);
    // Face player
    this.mesh.lookAt(playerPos.x, this.mesh.position.y + 1.8, playerPos.z);

    const cameraForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const isLookingDirectly = this.isObservedByPlayer(camera.position, cameraForward, 0.88);

    // If player looks directly into the Watcher's eyes
    if (isLookingDirectly && dist < 55) {
      this.gazeTimer += dt;
      if (this.gazeTimer > 0.2) {
        useGameStore.getState().drainSanity(2);
      }

      this.humTimer -= dt;
      if (this.humTimer <= 0) {
        soundEngine.playWatcherHum(this.position);
        this.humTimer = 2.0;
      }

      // If stared at for more than 4 seconds, teleports to another creepy fog vantage point!
      if (this.gazeTimer > 4.2) {
        this.teleport(playerPos);
        this.gazeTimer = 0;
      }
    } else {
      this.gazeTimer = Math.max(0, this.gazeTimer - dt);
    }

    this.alignToTerrain();
  }

  private teleport(playerPos: THREE.Vector3): void {
    // Pick point 35-45m away from player in fog
    const angle = Math.random() * Math.PI * 2;
    const dist = 38 + Math.random() * 12;
    this.position.set(playerPos.x + Math.cos(angle) * dist, 0, playerPos.z + Math.sin(angle) * dist);
    this.alignToTerrain();
    soundEngine.playBrideWhisper(this.position);
  }

  protected onHit(): void {
    useGameStore.getState().triggerHitMarker();
    // Bullets cause it to vanish into mist
    this.takeDamage(40);
  }

  protected onDeath(): void {
    this.mesh.visible = false;
  }
}
