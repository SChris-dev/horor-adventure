// ============================================================================
// Physics Engine using @dimforge/rapier3d-compat (WASM)
// Handles Kinematic Character Controller, terrain trimesh/heightfield & raycasting
// ============================================================================

import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { PLAYER } from '../core/config';

export interface RayHit {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number;
  collider: RAPIER.Collider;
}

export class PhysicsSystem {
  public world!: RAPIER.World;
  public playerBody!: RAPIER.RigidBody;
  public playerCollider!: RAPIER.Collider;
  public characterController!: RAPIER.KinematicCharacterController;
  public isReady = false;

  public async init(startX = 6, startY = 10, startZ = 196): Promise<void> {
    await RAPIER.init();

    // Gravity vector (-22 m/s² for punchy fps physics)
    this.world = new RAPIER.World({ x: 0.0, y: -PLAYER.gravity, z: 0.0 });

    // Kinematic Character Controller
    const offset = 0.05;
    this.characterController = this.world.createCharacterController(offset);
    this.characterController.enableAutostep(0.45, 0.25, true);
    this.characterController.enableSnapToGround(0.4);
    this.characterController.setSlideEnabled(true);
    this.characterController.setMaxSlopeClimbAngle((55 * Math.PI) / 180);
    this.characterController.setMinSlopeSlideAngle((60 * Math.PI) / 180);

    // Player capsule body
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(startX, startY, startZ);
    this.playerBody = this.world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.capsule(PLAYER.halfHeight, PLAYER.radius);
    this.playerCollider = this.world.createCollider(colliderDesc, this.playerBody);

    this.isReady = true;
  }

  /** Move player using Rapier Kinematic Character Controller. */
  public movePlayer(movement: THREE.Vector3): THREE.Vector3 {
    if (!this.isReady) return movement;

    this.characterController.computeColliderMovement(this.playerCollider, {
      x: movement.x,
      y: movement.y,
      z: movement.z
    });

    const computed = this.characterController.computedMovement();
    const currentPos = this.playerBody.translation();

    const newPos = {
      x: currentPos.x + computed.x,
      y: currentPos.y + computed.y,
      z: currentPos.z + computed.z
    };

    this.playerBody.setNextKinematicTranslation(newPos);
    this.playerBody.setTranslation(newPos, true);

    return new THREE.Vector3(computed.x, computed.y, computed.z);
  }

  public getPlayerPosition(): THREE.Vector3 {
    if (!this.isReady) return new THREE.Vector3(0, 5, 0);
    const p = this.playerBody.translation();
    return new THREE.Vector3(p.x, p.y, p.z);
  }

  public setPlayerPosition(pos: THREE.Vector3): void {
    if (!this.isReady) return;
    this.playerBody.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
  }

  public isGrounded(): boolean {
    if (!this.isReady) return true;
    return this.characterController.computedGrounded();
  }

  /** Add static terrain trimesh collider. */
  public addTerrainCollider(vertices: Float32Array, indices: Uint32Array): RAPIER.Collider {
    const bodyDesc = RAPIER.RigidBodyDesc.fixed();
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.trimesh(vertices, indices);
    return this.world.createCollider(colliderDesc, body);
  }

  /** Add static box collider for buildings, fences, obstacles. */
  public addBoxCollider(center: THREE.Vector3, halfExtents: THREE.Vector3): RAPIER.Collider {
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(center.x, center.y, center.z);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z);
    return this.world.createCollider(colliderDesc, body);
  }

  /** Add static cylinder collider for trees. */
  public addCylinderCollider(center: THREE.Vector3, halfHeight: number, radius: number): RAPIER.Collider {
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(center.x, center.y, center.z);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cylinder(halfHeight, radius);
    return this.world.createCollider(colliderDesc, body);
  }

  /** Raycast from origin in direction. */
  public raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number): RayHit | null {
    if (!this.isReady) return null;

    const ray = new RAPIER.Ray(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: direction.x, y: direction.y, z: direction.z }
    );

    const hit = this.world.castRayAndGetNormal(ray, maxDistance, true);
    if (!hit) return null;

    const point = origin.clone().addScaledVector(direction, hit.timeOfImpact);
    const normal = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z);

    return {
      point,
      normal,
      distance: hit.timeOfImpact,
      collider: hit.collider
    };
  }

  public step(dt: number): void {
    if (!this.isReady) return;
    this.world.timestep = dt;
    this.world.step();
  }
}

export const physics = new PhysicsSystem();
