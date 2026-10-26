// ============================================================================
// Weather & Horror Atmosphere: Dense Fog, Drifting Mist, Rain, Lightning Flashes
// ============================================================================

import * as THREE from 'three';
import { Rng } from '../core/math';
import { getTextureAtlas } from '../engine/textures';
import { soundEngine } from '../audio/audioEngine';

export class WeatherSystem {
  public group = new THREE.Group();
  public lightningLight!: THREE.DirectionalLight;
  private rainGeo!: THREE.BufferGeometry;
  private rainPoints!: THREE.Points;
  private rainCount = 2800;
  private fogParticles!: THREE.InstancedMesh;
  private fogDummy = new THREE.Object3D();
  private fogCount = 24;

  private nextLightningTime = 12;
  private isFlashing = false;
  private flashDuration = 0;

  public init(scene: THREE.Scene): void {
    const textures = getTextureAtlas();
    const rng = new Rng(777);

    // 1. Scene Ambient Fog (Dark oppressive cold teal-black)
    scene.fog = new THREE.FogExp2(0x070b10, 0.026);

    // 2. Lightning Directional Light (normally 0 intensity)
    this.lightningLight = new THREE.DirectionalLight(0xddeeff, 0);
    this.lightningLight.position.set(40, 100, 40);
    this.lightningLight.castShadow = true;
    scene.add(this.lightningLight);

    // 3. Rain Particle System
    const rainPositions = new Float32Array(this.rainCount * 3);
    for (let i = 0; i < this.rainCount; i++) {
      rainPositions[i * 3] = rng.range(-35, 35);
      rainPositions[i * 3 + 1] = rng.range(0, 30);
      rainPositions[i * 3 + 2] = rng.range(-35, 35);
    }

    this.rainGeo = new THREE.BufferGeometry();
    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));

    const rainMat = new THREE.PointsMaterial({
      color: 0x8899aa,
      size: 0.16,
      transparent: true,
      opacity: 0.55
    });

    this.rainPoints = new THREE.Points(this.rainGeo, rainMat);
    this.group.add(this.rainPoints);

    // 4. Volumetric Drifting Ground Fog Puffs
    const fogPlaneGeo = new THREE.PlaneGeometry(18, 18);
    const fogMat = new THREE.MeshBasicMaterial({
      map: textures.fogPuff,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    this.fogParticles = new THREE.InstancedMesh(fogPlaneGeo, fogMat, this.fogCount);
    for (let i = 0; i < this.fogCount; i++) {
      this.fogDummy.position.set(rng.range(-120, 120), rng.range(0, 4), rng.range(-120, 120));
      this.fogDummy.rotation.set(-Math.PI / 2, 0, rng.range(0, Math.PI * 2));
      this.fogDummy.scale.setScalar(rng.range(0.8, 1.8));
      this.fogDummy.updateMatrix();
      this.fogParticles.setMatrixAt(i, this.fogDummy.matrix);
    }
    this.fogParticles.instanceMatrix.needsUpdate = true;
    this.group.add(this.fogParticles);
  }

  public update(dt: number, playerPos: THREE.Vector3, time: number): void {
    // 1. Follow player with rain box
    this.rainPoints.position.set(playerPos.x, 0, playerPos.z);
    const pos = this.rainGeo.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;

    for (let i = 0; i < this.rainCount; i++) {
      let y = arr[i * 3 + 1] - dt * 26; // Rain speed
      if (y < playerPos.y - 2) {
        y = playerPos.y + 26;
      }
      arr[i * 3 + 1] = y;
    }
    pos.needsUpdate = true;

    // 2. Lightning flash timer
    this.nextLightningTime -= dt;
    if (this.nextLightningTime <= 0) {
      this.triggerLightning();
      this.nextLightningTime = 16 + Math.random() * 22;
    }

    if (this.isFlashing) {
      this.flashDuration -= dt;
      if (this.flashDuration <= 0) {
        this.lightningLight.intensity = 0;
        this.isFlashing = false;
      }
    }
  }

  public triggerLightning(): void {
    this.isFlashing = true;
    this.flashDuration = 0.12;
    this.lightningLight.intensity = 5.2;

    // Play thunder after brief delay
    setTimeout(() => {
      soundEngine.playFootstep(new THREE.Vector3(0, 20, 0), 'wood');
    }, 450);
  }
}
