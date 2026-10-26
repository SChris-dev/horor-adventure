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

    // 3. Atmospheric Horror Moonlight & Sky
    this.scene.background = new THREE.Color(0x141c26);

    const ambientLight = new THREE.AmbientLight(0x324458, 1.4);
    this.scene.add(ambientLight);

    const moonLight = new THREE.DirectionalLight(0x769cc4, 1.6);
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

      // 2. Update Player & Weapons with direct raycast monster hit test
      this.player.update(dt, (origin, dir, range, damage) => {
        return this.director.checkBulletRay(origin, dir, range, damage);
      });

      const playerPos = this.player.position;

      // 3. Update AI Monsters & Director
      this.director.update(dt, playerPos, this.player.camera);

      // 4. Update Weather & Atmospheric Particles
      this.weather.update(dt, playerPos, time / 1000);

      // 5. Check Nearby Interactables and Floating Pickups
      this.currentNearbyItem = this.landmarks.checkNearby(playerPos);
      this.landmarks.updatePickups(time / 1000, playerPos);

      // 6. Survival timer tick (1Hz throttle, zero React VDOM overhead)
      if (Math.floor(time / 1000) !== Math.floor(this.lastTime / 1000)) {
        useGameStore.setState((s) => ({ survivalTime: s.survivalTime + 1 }));
      }
    }

    // 7. Render Direct to Canvas
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
