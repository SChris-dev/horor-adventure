// ============================================================================
// Foliage and Environment Instancing System
// Spawns dead pine trees, gnarled branches, rocks, grass tufts, and tombstones
// using Three.js InstancedMesh for maximum 60fps performance on potato laptops.
// ============================================================================

import * as THREE from 'three';
import { Rng } from '../core/math';
import { WORLD, LAYOUT } from '../core/config';
import { getTextureAtlas } from '../engine/textures';
import { getTerrainHeight } from './terrain';
import { physics } from '../engine/physics';

export class FoliageSystem {
  public group = new THREE.Group();

  public init(): void {
    const textures = getTextureAtlas();
    const rng = new Rng(888);

    // 1. Dead Pine Trees (InstancedMesh)
    this.createDeadTrees(textures, rng);

    // 2. Boulders & Rocks
    this.createRocks(textures, rng);

    // 3. Graveyard Tombstones
    this.createTombstones(textures, rng);
  }

  private createDeadTrees(textures: ReturnType<typeof getTextureAtlas>, rng: Rng): void {
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.45, 9.5, 7);
    trunkGeo.translate(0, 4.75, 0);

    const trunkMat = new THREE.MeshStandardMaterial({
      map: textures.bark,
      roughness: 0.95,
      metalness: 0.05
    });

    const treeCount = 380;
    const trunkInstanced = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    trunkInstanced.castShadow = true;
    trunkInstanced.receiveShadow = true;

    const dummy = new THREE.Object3D();
    let validCount = 0;

    for (let i = 0; i < treeCount; i++) {
      // Pick random location in world
      const x = rng.range(-WORLD.playRadius + 20, WORLD.playRadius - 20);
      const z = rng.range(-WORLD.playRadius + 20, WORLD.playRadius - 20);

      // Avoid lake
      const lakeDist = Math.hypot(x - LAYOUT.lake.x, z - LAYOUT.lake.z);
      if (lakeDist < LAYOUT.lake.radius + 6) continue;

      // Avoid road center
      let onRoad = false;
      for (let r = 0; r < LAYOUT.road.length - 1; r++) {
        const [ax, az] = LAYOUT.road[r];
        const [bx, bz] = LAYOUT.road[r + 1];
        const dx = bx - ax;
        const dz = bz - az;
        const lenSq = dx * dx + dz * dz;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lenSq));
        const dist = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
        if (dist < 4.5) {
          onRoad = true;
          break;
        }
      }
      if (onRoad) continue;

      const y = getTerrainHeight(x, z);
      if (y < WORLD.waterLevel + 0.5) continue;

      const scaleY = rng.range(0.8, 1.35);
      const scaleXZ = rng.range(0.85, 1.2);
      const rotY = rng.range(0, Math.PI * 2);
      const tiltX = rng.range(-0.06, 0.06);
      const tiltZ = rng.range(-0.06, 0.06);

      dummy.position.set(x, y - 0.2, z);
      dummy.rotation.set(tiltX, rotY, tiltZ);
      dummy.scale.set(scaleXZ, scaleY, scaleXZ);
      dummy.updateMatrix();

      trunkInstanced.setMatrixAt(validCount, dummy.matrix);

      // Add cylinder physics collider for tree trunk
      physics.addCylinderCollider(new THREE.Vector3(x, y + 4.5, z), 4.5 * scaleY, 0.35 * scaleXZ);

      validCount++;
    }

    trunkInstanced.count = validCount;
    trunkInstanced.instanceMatrix.needsUpdate = true;
    this.group.add(trunkInstanced);
  }

  private createRocks(textures: ReturnType<typeof getTextureAtlas>, rng: Rng): void {
    const rockGeo = new THREE.DodecahedronGeometry(1.4, 1);
    const rockMat = new THREE.MeshStandardMaterial({
      map: textures.stone,
      roughness: 0.9,
      metalness: 0.1
    });

    const count = 120;
    const instanced = new THREE.InstancedMesh(rockGeo, rockMat, count);
    instanced.castShadow = true;
    instanced.receiveShadow = true;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const x = rng.range(-200, 200);
      const z = rng.range(-200, 200);
      const y = getTerrainHeight(x, z);

      const scale = rng.range(0.6, 2.2);
      dummy.position.set(x, y + scale * 0.4, z);
      dummy.rotation.set(rng.range(0, 3), rng.range(0, 3), rng.range(0, 3));
      dummy.scale.set(scale * rng.range(0.8, 1.3), scale * rng.range(0.6, 1.0), scale * rng.range(0.8, 1.3));
      dummy.updateMatrix();

      instanced.setMatrixAt(i, dummy.matrix);

      if (scale > 1.2) {
        physics.addBoxCollider(
          new THREE.Vector3(x, y + scale * 0.5, z),
          new THREE.Vector3(scale * 0.7, scale * 0.6, scale * 0.7)
        );
      }
    }

    instanced.instanceMatrix.needsUpdate = true;
    this.group.add(instanced);
  }

  private createTombstones(textures: ReturnType<typeof getTextureAtlas>, rng: Rng): void {
    const stoneGeo = new THREE.BoxGeometry(0.55, 1.1, 0.18);
    stoneGeo.translate(0, 0.55, 0);

    const stoneMat = new THREE.MeshStandardMaterial({
      map: textures.stone,
      roughness: 0.95
    });

    const count = 28;
    const instanced = new THREE.InstancedMesh(stoneGeo, stoneMat, count);
    instanced.castShadow = true;
    instanced.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const gX = LAYOUT.graveyard.x;
    const gZ = LAYOUT.graveyard.z;

    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / 7);
      const col = i % 7;
      const x = gX + (col - 3) * 3.4 + rng.range(-0.5, 0.5);
      const z = gZ + (row - 2) * 3.8 + rng.range(-0.5, 0.5);
      const y = getTerrainHeight(x, z);

      dummy.position.set(x, y - 0.1, z);
      dummy.rotation.set(rng.range(-0.15, 0.15), rng.range(-0.25, 0.25), rng.range(-0.15, 0.15));
      dummy.scale.set(rng.range(0.85, 1.15), rng.range(0.85, 1.25), 1.0);
      dummy.updateMatrix();

      instanced.setMatrixAt(i, dummy.matrix);

      physics.addBoxCollider(new THREE.Vector3(x, y + 0.55, z), new THREE.Vector3(0.3, 0.6, 0.15));
    }

    instanced.instanceMatrix.needsUpdate = true;
    this.group.add(instanced);
  }
}
