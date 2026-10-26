// ============================================================================
// Master Game Engine: Coordinates Physics, World, Player, AI Director, and Post-FX
// ============================================================================

import * as THREE from 'three';
import { physics } from './physics';
import { gameRenderer } from './renderer';
import { input } from './input';
import { createTerrain } from '../world/terrain';
import { FoliageSystem } from '../world/foliage';
import { LandmarksSystem, InteractableItem } from '../world/landmarks';
import { WeatherSystem } from '../world/weather';
import { Player } from '../entities/player/player';
import { AIDirector } from '../systems/director';
import { useGameStore } from '../state/store';
import { LAYOUT } from '../core/config';

export class GameInstance {
  public scene!: THREE.Scene;
  public player!: Player;
  public foliage!: FoliageSystem;
  public landmarks!: LandmarksSystem;
  public weather!: WeatherSystem;
  public director!: AIDirector;

  private isRunning = false;
  private lastTime = 0;
  private currentNearbyItem: InteractableItem | null = null;

  public async init(canvas: HTMLCanvasElement): Promise<void> {
    this.scene = new THREE.Scene();

    // 1. Initialize Renderer & Post-FX
    gameRenderer.init(canvas);

    // 2. Initialize Physics WASM
    const spawn = LAYOUT.spawn;
    await physics.init(spawn.x, 6, spawn.z);

    // 3. Ambient Lighting
    const ambientLight = new THREE.AmbientLight(0x0a1420, 0.65);
    this.scene.add(ambientLight);

    const moonLight = new THREE.DirectionalLight(0x1a2e45, 0.45);
    moonLight.position.set(-60, 90, -40);
    this.scene.add(moonLight);

    // 4. Create Terrain & Water
    const { mesh: terrainMesh, waterMesh } = createTerrain();
    this.scene.add(terrainMesh, waterMesh);

    // 5. Create Foliage & Instancing
    this.foliage = new FoliageSystem();
    this.foliage.init();
    this.scene.add(this.foliage.group);

    // 6. Create Landmarks & Interactive Items
    this.landmarks = new LandmarksSystem();
    this.landmarks.init();
    this.scene.add(this.landmarks.group);

    // 7. Weather (Fog, Rain, Lightning)
    this.weather = new WeatherSystem();
    this.weather.init(this.scene);
    this.scene.add(this.weather.group);

    // 8. Player Controller
    this.player = new Player();
    this.player.init(this.scene);

    // 9. AI Director (Monsters & Pacing)
    this.director = new AIDirector();
    this.director.init(this.scene);

    // 10. Input Callbacks
    input.init(canvas);
    input.setCallbacks({
      onInteract: () => {
        if (this.currentNearbyItem) {
          this.landmarks.triggerInteract(this.currentNearbyItem);
          this.currentNearbyItem = null;
        }
      },
      onReload: () => {
        this.player.weapons.reload();
      }
    });

    this.isRunning = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  private loop = (time: number): void => {
    if (!this.isRunning) return;

    const dt = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;

    const status = useGameStore.getState().status;
    if (status === 'playing') {
      // 1. Step Physics
      physics.step(dt);

      // 2. Update Player & Weapons
      this.player.update(dt, (hitPoint, damage) => {
        this.director.handleBulletHit(hitPoint, damage);
      });

      const playerPos = physics.getPlayerPosition();

      // 3. Update AI Monsters & Director
      this.director.update(dt, playerPos, this.player.camera);

      // 4. Update Weather & Atmospheric Particles
      this.weather.update(dt, playerPos, time / 1000);

      // 5. Check Nearby Interactables
      this.currentNearbyItem = this.landmarks.checkNearby(playerPos);
    }

    // 6. Render Post-Processing
    gameRenderer.render(this.scene, this.player.camera, time / 1000, dt);

    requestAnimationFrame(this.loop);
  };

  public getNearbyInteractable(): InteractableItem | null {
    return this.currentNearbyItem;
  }

  public destroy(): void {
    this.isRunning = false;
    input.destroy();
    gameRenderer.destroy();
  }
}

export const game = new GameInstance();
