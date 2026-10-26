// ============================================================================
// Base Enemy Class: Perception, Navigation, State Machine, and Damage Handling
// ============================================================================

import * as THREE from 'three';
import { getTerrainHeight } from '../../world/terrain';

export type AIState = 'idle' | 'stalk' | 'chase' | 'attack' | 'freeze' | 'dead';

export abstract class EnemyBase {
  public mesh: THREE.Group = new THREE.Group();
  public position: THREE.Vector3 = new THREE.Vector3();
  public state: AIState = 'idle';
  public hp: number;
  public maxHp: number;
  public speed: number;
  public isDead = false;

  constructor(hp: number, speed: number) {
    this.hp = hp;
    this.maxHp = hp;
    this.speed = speed;
  }

  /** Checks if player is looking directly at this enemy within camera field of view. */
  public isObservedByPlayer(cameraPos: THREE.Vector3, cameraForward: THREE.Vector3, cosThreshold = 0.65): boolean {
    const toEnemy = this.position.clone().sub(cameraPos).normalize();
    const dot = cameraForward.dot(toEnemy);
    return dot > cosThreshold;
  }

  /** Damage enemy, returning true if killed. */
  public takeDamage(amount: number): boolean {
    if (this.isDead) return false;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.isDead = true;
      this.state = 'dead';
      this.onDeath();
      return true;
    }
    this.onHit();
    return false;
  }

  protected alignToTerrain(): void {
    const groundY = getTerrainHeight(this.position.x, this.position.z);
    this.position.y = groundY;
    this.mesh.position.copy(this.position);
  }

  public abstract update(dt: number, playerPos: THREE.Vector3, camera: THREE.Camera): void;
  protected abstract onHit(): void;
  protected abstract onDeath(): void;
}
