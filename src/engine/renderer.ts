// ============================================================================
// Horror Renderer & Post-Processing System
// Features: Film grain, chromatic aberration, horror color grade, blood vignette,
// and adaptive resolution scaling for potato laptops to ultra desktops.
// ============================================================================

import * as THREE from 'three';
import { QUALITY, QualityLevel } from '../core/config';
import { useGameStore } from '../state/store';

const HorrorPostShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uGrainIntensity: { value: 0.12 },
    uAberration: { value: 0.002 },
    uVignetteDarkness: { value: 1.3 },
    uBloodIntensity: { value: 0.0 },
    uSanityDistort: { value: 0.0 },
    uStaticNoise: { value: 0.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uGrainIntensity;
    uniform float uAberration;
    uniform float uVignetteDarkness;
    uniform float uBloodIntensity;
    uniform float uSanityDistort;
    uniform float uStaticNoise;
    varying vec2 vUv;

    // High quality procedural pseudo-noise
    float random(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;

      // Sanity distortion warp
      if (uSanityDistort > 0.01) {
        uv.x += sin(uv.y * 18.0 + uTime * 4.0) * 0.004 * uSanityDistort;
        uv.y += cos(uv.x * 14.0 + uTime * 3.5) * 0.004 * uSanityDistort;
      }

      // Chromatic Aberration (R/B shift)
      vec2 dir = uv - vec2(0.5);
      float dist = length(dir);
      float ab = uAberration * (dist * 1.5 + 0.2);

      float r = texture2D(tDiffuse, uv + dir * ab).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - dir * ab).b;
      vec3 color = vec3(r, g, b);

      // Horror Color Grading: Cinematic cold midnight grade (preserving visibility)
      float luma = dot(color, vec3(0.299, 0.587, 0.114));
      vec3 coldTint = vec3(luma * 0.92, luma * 0.98, luma * 1.05);
      color = mix(color, coldTint, 0.22);

      // Dynamic Film Grain (subtle)
      float grain = (random(uv + vec2(uTime * 17.0, uTime * 31.0)) - 0.5) * (uGrainIntensity * 0.7);
      color += grain;

      // Subtle Atmospheric Vignette (no black screen blockage)
      float vignette = smoothstep(1.4, 0.35, dist);
      color *= vignette;

      // Blood Splatter / Red Pulsing Edge when damaged
      if (uBloodIntensity > 0.01) {
        float edge = smoothstep(0.35, 0.85, dist);
        vec3 bloodRed = vec3(0.65, 0.02, 0.02);
        color = mix(color, bloodRed * (color + 0.3), edge * uBloodIntensity);
      }

      // Radio Static Glitch (for Pale Bride / near death)
      if (uStaticNoise > 0.01) {
        float staticVal = random(vec2(floor(uv.x * 240.0), floor(uv.y * 140.0)) + uTime * 50.0);
        color = mix(color, vec3(staticVal), uStaticNoise * 0.45);
      }

      gl_FragColor = vec4(color, 1.0);
    }
  `
};

export class GameRenderer {
  public renderer!: THREE.WebGLRenderer;
  private postScene!: THREE.Scene;
  private postCamera!: THREE.OrthographicCamera;
  private renderTarget!: THREE.WebGLRenderTarget;
  private postMaterial!: THREE.ShaderMaterial;
  private quad!: THREE.Mesh;

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
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.shadowMap.enabled = preset.flashlightShadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Post processing setup
    this.postScene = new THREE.Scene();
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat
    });

    this.postMaterial = new THREE.ShaderMaterial({
      vertexShader: HorrorPostShader.vertexShader,
      fragmentShader: HorrorPostShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(HorrorPostShader.uniforms)
    });
    this.postMaterial.uniforms.tDiffuse.value = this.renderTarget.texture;

    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMaterial);
    this.postScene.add(this.quad);

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
    this.renderTarget.setSize(w, h);
  };

  /** Render game scene with horror post-processing pass. */
  public render(scene: THREE.Scene, camera: THREE.Camera, time: number, dt: number): void {
    const state = useGameStore.getState();

    // Decay blood pulse
    if (state.bloodPulse > 0.001) {
      useGameStore.setState({ bloodPulse: Math.max(0, state.bloodPulse - dt * 1.8) });
    }

    // Dynamic post-processing uniforms
    const u = this.postMaterial.uniforms;
    u.uTime.value = time;
    u.uAberration.value = 0.002 + (1.0 - state.sanity / 100) * 0.015 + (state.staticNoise * 0.01);
    u.uSanityDistort.value = state.sanityGlitch;
    u.uBloodIntensity.value = state.bloodPulse + (state.hp < 30 ? (30 - state.hp) / 50 : 0);
    u.uStaticNoise.value = state.staticNoise;

    // Pass 1: Render 3D Scene into RenderTarget
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(scene, camera);

    // Pass 2: Render Post-Processing Quad to Screen
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
  }

  public destroy(): void {
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    this.renderTarget.dispose();
  }
}

export const gameRenderer = new GameRenderer();
