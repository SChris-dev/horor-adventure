// ============================================================================
// Weather & Horror Atmosphere: Cinematic Fog, Lightning Flashes, Optimized Rain
// ============================================================================

import * as THREE from 'three';
import { Rng } from '../core/math';
import { soundEngine } from '../audio/audioEngine';

export class WeatherSystem {
  public group = new THREE.Group();
  public lightningLight!: THREE.DirectionalLight;
  private rainPoints!: THREE.Points;
  private rainCount = 900; // Optimized count for potato laptops

  private nextLightningTime = 16;
  private isFlashing = false;
  private flashDuration = 0;

  public init(scene: THREE.Scene): void {
    const rng = new Rng(777);

    // 1. Natural Horror Fog: Clear within 25m, atmospheric blue-grey fade to 110m
    scene.fog = new THREE.Fog(0x182434, 25, 110);

    // 2. Lightning Directional Light (normally 0 intensity)
    this.lightningLight = new THREE.DirectionalLight(0xddeeff, 0);
    this.lightningLight.position.set(40, 100, 40);
    scene.add(this.lightningLight);

    // 3. Rain Particle System (Optimized GPU instance)
    const rainPositions = new Float32Array(this.rainCount * 3);
    for (let i = 0; i < this.rainCount; i++) {
      rainPositions[i * 3] = rng.range(-40, 40);
      rainPositions[i * 3 + 1] = rng.range(0, 35);
      rainPositions[i * 3 + 2] = rng.range(-40, 40);
    }

    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));

    const rainMat = new THREE.PointsMaterial({
      color: 0x99aabb,
      size: 0.15,
      transparent: true,
      opacity: 0.45
    });

    this.rainPoints = new THREE.Points(rainGeo, rainMat);
    this.group.add(this.rainPoints);
  }

  public update(dt: number, playerPos: THREE.Vector3, time: number): void {
    // 1. Follow player with rain, cycling vertically with zero CPU buffer recreation
    const rainCycleY = (time * 18) % 35;
    this.rainPoints.position.set(playerPos.x, playerPos.y - rainCycleY + 18, playerPos.z);

    // 2. Lightning flash timer
    this.nextLightningTime -= dt;
    if (this.nextLightningTime <= 0) {
      this.triggerLightning();
      this.nextLightningTime = 20 + Math.random() * 25;
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
    this.flashDuration = 0.1;
    this.lightningLight.intensity = 4.0;

    // Distant rolling thunder
    setTimeout(() => {
      soundEngine.playFootstep(new THREE.Vector3(0, 20, 0), 'wood');
    }, 550);
  }
}
