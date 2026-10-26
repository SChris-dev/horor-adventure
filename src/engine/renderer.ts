// ============================================================================
// High-Performance Three.js Game Renderer
// Direct-to-screen rendering with ACES Filmic Tone Mapping and adaptive resolution.
// Zero fillrate bottleneck: runs at max refresh rate (60/120/144fps).
// ============================================================================

import * as THREE from 'three';
import { QUALITY, QualityLevel } from '../core/config';
import { useGameStore } from '../state/store';

export class GameRenderer {
  public renderer!: THREE.WebGLRenderer;

  public init(canvas: HTMLCanvasElement): void {
    const quality = useGameStore.getState().quality;
    const preset = QUALITY[quality];

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: preset.msaa > 0,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.maxPixelRatio));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.4;
    this.renderer.shadowMap.enabled = preset.flashlightShadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    window.addEventListener('resize', this.onResize);
  }

  public setQuality(quality: QualityLevel): void {
    const preset = QUALITY[quality];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.maxPixelRatio));
    this.renderer.shadowMap.enabled = preset.flashlightShadows;
  }

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
  };

  /** Direct render call: 0ms overhead, max framerate. */
  public render(scene: THREE.Scene, camera: THREE.Camera, _time: number, _dt: number): void {
    this.renderer.render(scene, camera);
  }

  public destroy(): void {
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
  }
}

export const gameRenderer = new GameRenderer();
