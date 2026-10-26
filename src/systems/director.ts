// ============================================================================
// AI Director: Pacing, Monster Spawning, and Stalker Tension Management
// Cycles through build-up, peak horror, and relief, and ducks ambient wildlife.
// ============================================================================

import * as THREE from 'three';
import { EnemyBase } from '../entities/enemies/enemyBase';
import { PaleBride } from '../entities/enemies/paleBride';
import { Shambler } from '../entities/enemies/shambler';
import { Watcher } from '../entities/enemies/watcher';
import { LAYOUT } from '../core/config';
import { soundEngine } from '../audio/audioEngine';
import { useGameStore } from '../state/store';

export class AIDirector {
  public enemies: EnemyBase[] = [];
  public group = new THREE.Group();

  private spawnTimer = 10;
  private nearestDist = 999;

  public init(scene: THREE.Scene): void {
    scene.add(this.group);

    // Initial world spawns near landmarks:
    // 1. Shambler in Graveyard
    this.spawnShambler(LAYOUT.graveyard.x + 4, LAYOUT.graveyard.z + 2);

    // 2. Shambler patrolling the Cabin road
    this.spawnShambler(LAYOUT.cabins[0].x - 12, LAYOUT.cabins[0].z + 18);

    // 3. Shambler by the Lake Dock
    this.spawnShambler(LAYOUT.lake.x - 22, LAYOUT.lake.z - 8);

    // 4. The Pale Bride stalking in the dead forest
    this.spawnPaleBride(30, 90);

    // 5. The Watcher standing at the fog line
    this.spawnWatcher(LAYOUT.chapel.x - 35, LAYOUT.chapel.z - 25);
  }

  public spawnPaleBride(x: number, z: number): PaleBride {
    const bride = new PaleBride(x, z);
    this.enemies.push(bride);
    this.group.add(bride.mesh);
    return bride;
  }

  public spawnShambler(x: number, z: number): Shambler {
    const shambler = new Shambler(x, z);
    this.enemies.push(shambler);
    this.group.add(shambler.mesh);
    return shambler;
  }

  public spawnWatcher(x: number, z: number): Watcher {
    const watcher = new Watcher(x, z);
    this.enemies.push(watcher);
    this.group.add(watcher.mesh);
    return watcher;
  }

  public update(dt: number, playerPos: THREE.Vector3, camera: THREE.Camera): void {
    let closest = 999;
    let maxStatic = 0;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.isDead) {
        useGameStore.getState().incrementKills();
        this.group.remove(enemy.mesh);
        this.enemies.splice(i, 1);
        continue;
      }

      enemy.update(dt, playerPos, camera);
      const d = enemy.position.distanceTo(playerPos);
      if (d < closest) closest = d;

      if (enemy instanceof PaleBride && d < 32) {
        maxStatic = Math.max(maxStatic, (32 - d) / 32);
      }
    }

    this.nearestDist = closest;
    soundEngine.setStaticNoise(maxStatic);

    // Duck crickets when monster is near: dead silence when within 25m!
    const wildlifeFactor = closest < 25 ? 0.0 : (closest - 25) / 30;
    soundEngine.setSafeWildlifeFactor(wildlifeFactor);

    soundEngine.update(dt, closest);

    // Periodic director pacing & reinforcement spawn
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 45 + Math.random() * 30;

      // Keep population active
      const aliveCount = this.enemies.filter((e) => !e.isDead).length;
      if (aliveCount < 4) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 38 + Math.random() * 15;
        const sx = playerPos.x + Math.cos(angle) * dist;
        const sz = playerPos.z + Math.sin(angle) * dist;

        if (Math.random() < 0.45) {
          this.spawnPaleBride(sx, sz);
        } else {
          this.spawnShambler(sx, sz);
        }
      }
    }
  }

  /** Direct raycast against alive enemies along bullet vector. */
  public checkBulletRay(origin: THREE.Vector3, direction: THREE.Vector3, maxRange: number, damage: number): { hit: boolean; point: THREE.Vector3 } | null {
    let closestEnemy: EnemyBase | null = null;
    let closestDist = maxRange;
    const hitPoint = new THREE.Vector3();
    const ray = new THREE.Ray(origin, direction.clone().normalize());
    const tempPoint = new THREE.Vector3();

    for (const enemy of this.enemies) {
      if (enemy.isDead) continue;
      const center = enemy.position.clone();
      center.y += 1.1; // Center of mass
      const sphere = new THREE.Sphere(center, 0.85);

      if (ray.intersectSphere(sphere, tempPoint)) {
        const d = origin.distanceTo(tempPoint);
        if (d < closestDist) {
          closestDist = d;
          closestEnemy = enemy;
          hitPoint.copy(tempPoint);
        }
      }
    }

    if (closestEnemy) {
      closestEnemy.takeDamage(damage);
      return { hit: true, point: hitPoint };
    }
    return null;
  }

  /** Hitscan check from bullet raycast against enemy colliders. */
  public handleBulletHit(hitPoint: THREE.Vector3, damage: number): boolean {
    for (const enemy of this.enemies) {
      if (enemy.isDead) continue;
      const dist = enemy.position.distanceTo(hitPoint);
      if (dist < 1.8) {
        enemy.takeDamage(damage);
        return true;
      }
    }
    return false;
  }

  public getNearestDistance(): number {
    return this.nearestDist;
  }
}
