// ============================================================================
// 3D Spatial Audio Engine with Dynamic Ambience and Procedural Horror SFX
// Uses Web Audio API with HRTF spatialization and dynamic tension ducking
// ============================================================================

import * as THREE from 'three';
import { clamp } from '../core/math';
import { useGameStore } from '../state/store';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private cricketsGain: GainNode | null = null;
  private heartbeatGain: GainNode | null = null;
  private breathingGain: GainNode | null = null;
  private staticGain: GainNode | null = null;

  private isInitialized = false;

  // Stalker tension tracking: crickets go silent when monster approaches
  private targetCricketsVol = 0.25;
  private currentCricketsVol = 0.25;

  private nextHeartbeatTime = 0;

  public init(): void {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = useGameStore.getState().masterVolume;
      this.masterGain.connect(this.ctx.destination);

      // 1. Ambient Drone & Howling Wind
      this.initAmbientBed();

      // 2. Night Crickets (Silence when stalked)
      this.initCrickets();

      // 3. Heartbeat & Breathing
      this.initPhysiologyAudio();

      // 4. Radio Static for Pale Bride
      this.initStaticBed();

      this.isInitialized = true;
    } catch (e) {
      console.warn('AudioEngine initialization failed or waiting for user gesture:', e);
    }
  }

  public resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private initAmbientBed(): void {
    if (!this.ctx || !this.masterGain) return;

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.35;
    this.ambientGain.connect(this.masterGain);

    // Deep sub-bass horror drone (detuned 55Hz & 58Hz)
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'sine';
    osc1.frequency.value = 52;
    osc2.frequency.value = 54.5;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 110;

    const droneGain = this.ctx.createGain();
    droneGain.gain.value = 0.18;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(droneGain);
    droneGain.connect(this.ambientGain);

    osc1.start();
    osc2.start();

    // Wind noise buffer
    const bufferSize = this.ctx.sampleRate * 3;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 240;
    windFilter.Q.value = 2.5;

    const windGain = this.ctx.createGain();
    windGain.gain.value = 0.08;

    whiteNoise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.ambientGain);

    whiteNoise.start();
  }

  private initCrickets(): void {
    if (!this.ctx || !this.masterGain) return;

    this.cricketsGain = this.ctx.createGain();
    this.cricketsGain.gain.value = 0.15;
    this.cricketsGain.connect(this.masterGain);

    // High frequency filtered procedural chirps
    const cricketOsc = this.ctx.createOscillator();
    cricketOsc.type = 'sine';
    cricketOsc.frequency.value = 4600;

    const lfo = this.ctx.createOscillator();
    lfo.type = 'sawtooth';
    lfo.frequency.value = 12; // Chirp rhythm

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.06;

    lfo.connect(this.cricketsGain.gain);
    cricketOsc.connect(this.cricketsGain);

    cricketOsc.start();
    lfo.start();
  }

  private initPhysiologyAudio(): void {
    if (!this.ctx || !this.masterGain) return;

    this.heartbeatGain = this.ctx.createGain();
    this.heartbeatGain.gain.value = 0;
    this.heartbeatGain.connect(this.masterGain);

    this.breathingGain = this.ctx.createGain();
    this.breathingGain.gain.value = 0;
    this.breathingGain.connect(this.masterGain);
  }

  private initStaticBed(): void {
    if (!this.ctx || !this.masterGain) return;

    this.staticGain = this.ctx.createGain();
    this.staticGain.gain.value = 0;
    this.staticGain.connect(this.masterGain);

    // White noise generator for radio static
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800;
    filter.Q.value = 1.8;

    noiseSource.connect(filter);
    filter.connect(this.staticGain);
    noiseSource.start();
  }

  /** Update listener orientation and position from player camera. */
  public updateListener(camera: THREE.Camera): void {
    if (!this.ctx || !this.isInitialized) return;
    const listener = this.ctx.listener;
    const pos = camera.position;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

    if (listener.positionX) {
      listener.positionX.setValueAtTime(pos.x, this.ctx.currentTime);
      listener.positionY.setValueAtTime(pos.y, this.ctx.currentTime);
      listener.positionZ.setValueAtTime(pos.z, this.ctx.currentTime);
      listener.forwardX.setValueAtTime(forward.x, this.ctx.currentTime);
      listener.forwardY.setValueAtTime(forward.y, this.ctx.currentTime);
      listener.forwardZ.setValueAtTime(forward.z, this.ctx.currentTime);
      listener.upX.setValueAtTime(up.x, this.ctx.currentTime);
      listener.upY.setValueAtTime(up.y, this.ctx.currentTime);
      listener.upZ.setValueAtTime(up.z, this.ctx.currentTime);
    } else {
      listener.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
  }

  /** Set crickets silencing factor: 0 when monster is near (dead silence!), 1 when safe. */
  public setSafeWildlifeFactor(factor: number): void {
    this.targetCricketsVol = clamp(factor, 0, 1) * 0.16;
  }

  /** Update dynamic heartbeat, breathing, static noise, and ambient volume every frame. */
  public update(dt: number, nearestMonsterDist: number): void {
    if (!this.ctx || !this.isInitialized) return;

    // Smooth crickets ducking when monsters approach
    this.currentCricketsVol += (this.targetCricketsVol - this.currentCricketsVol) * dt * 3;
    if (this.cricketsGain) {
      this.cricketsGain.gain.setValueAtTime(Math.max(0.0001, this.currentCricketsVol), this.ctx.currentTime);
    }

    const state = useGameStore.getState();

    // Static noise tied to Wraith proximity
    if (this.staticGain) {
      const targetStatic = state.staticNoise * 0.35;
      this.staticGain.gain.setValueAtTime(targetStatic, this.ctx.currentTime);
    }

    // Heartbeat logic
    const bpm = state.heartbeatRate;
    const interval = 60 / bpm;
    if (this.ctx.currentTime >= this.nextHeartbeatTime && (state.hp < 40 || state.sanity < 45 || nearestMonsterDist < 18)) {
      this.playHeartbeatThump();
      this.nextHeartbeatTime = this.ctx.currentTime + interval;
    }
  }

  private playHeartbeatThump(): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(75, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(35, this.ctx.currentTime + 0.14);

    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.16);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.18);
  }

  // -------------------------------------------------------------------------
  // 3D Spatial SFX
  // -------------------------------------------------------------------------

  public playFootstep(pos: THREE.Vector3, surface: 'dirt' | 'wood' | 'stone' | 'water' = 'dirt'): void {
    if (!this.ctx || !this.masterGain) return;

    const panner = this.ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1.5;
    panner.maxDistance = 35;
    panner.positionX.setValueAtTime(pos.x, this.ctx.currentTime);
    panner.positionY.setValueAtTime(pos.y, this.ctx.currentTime);
    panner.positionZ.setValueAtTime(pos.z, this.ctx.currentTime);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    if (surface === 'wood') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, this.ctx.currentTime);
      filter.frequency.value = 500;
    } else if (surface === 'stone') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, this.ctx.currentTime);
      filter.frequency.value = 900;
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(95, this.ctx.currentTime);
      filter.frequency.value = 350;
    }

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.09);
  }

  public playPistolShot(pos: THREE.Vector3): void {
    if (!this.ctx || !this.masterGain) return;

    const panner = this.ctx.createPanner();
    panner.positionX.setValueAtTime(pos.x, this.ctx.currentTime);
    panner.positionY.setValueAtTime(pos.y, this.ctx.currentTime);
    panner.positionZ.setValueAtTime(pos.z, this.ctx.currentTime);

    // Initial sharp attack crack
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.12);

    oscGain.gain.setValueAtTime(0.9, this.ctx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.14);

    osc.connect(oscGain);
    oscGain.connect(panner);

    // Low rumble boom
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(120, this.ctx.currentTime);
    sub.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.28);
    subGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
    subGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

    sub.connect(subGain);
    subGain.connect(panner);

    panner.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
    sub.start();
    sub.stop(this.ctx.currentTime + 0.32);
  }

  public playShotgunShot(pos: THREE.Vector3): void {
    if (!this.ctx || !this.masterGain) return;

    const panner = this.ctx.createPanner();
    panner.positionX.setValueAtTime(pos.x, this.ctx.currentTime);
    panner.positionY.setValueAtTime(pos.y, this.ctx.currentTime);
    panner.positionZ.setValueAtTime(pos.z, this.ctx.currentTime);

    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(150, this.ctx.currentTime);
    sub.frequency.exponentialRampToValueAtTime(25, this.ctx.currentTime + 0.42);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.4);

    subGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
    subGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.45);

    sub.connect(filter);
    filter.connect(subGain);
    subGain.connect(panner);
    panner.connect(this.masterGain);

    sub.start();
    sub.stop(this.ctx.currentTime + 0.46);
  }

  public playMonsterGrowl(pos: THREE.Vector3, pitch = 1.0): void {
    if (!this.ctx || !this.masterGain) return;

    const panner = this.ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 3;
    panner.maxDistance = 65;
    panner.positionX.setValueAtTime(pos.x, this.ctx.currentTime);
    panner.positionY.setValueAtTime(pos.y, this.ctx.currentTime);
    panner.positionZ.setValueAtTime(pos.z, this.ctx.currentTime);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140 * pitch, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(80 * pitch, this.ctx.currentTime + 0.8);

    filter.type = 'bandpass';
    filter.frequency.value = 340;
    filter.Q.value = 3;

    gain.gain.setValueAtTime(0.01, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.65, this.ctx.currentTime + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.95);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 1.0);
  }

  public playBrideWhisper(pos: THREE.Vector3): void {
    if (!this.ctx || !this.masterGain) return;

    const panner = this.ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.positionX.setValueAtTime(pos.x, this.ctx.currentTime);
    panner.positionY.setValueAtTime(pos.y, this.ctx.currentTime);
    panner.positionZ.setValueAtTime(pos.z, this.ctx.currentTime);

    // Haunting high whistle/whisper
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(580, this.ctx.currentTime + 1.2);

    gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.28, this.ctx.currentTime + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.4);

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 1.45);
  }

  public playWatcherHum(pos: THREE.Vector3): void {
    if (!this.ctx || !this.masterGain) return;

    const panner = this.ctx.createPanner();
    panner.positionX.setValueAtTime(pos.x, this.ctx.currentTime);
    panner.positionY.setValueAtTime(pos.y, this.ctx.currentTime);
    panner.positionZ.setValueAtTime(pos.z, this.ctx.currentTime);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(45, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.01, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.7, this.ctx.currentTime + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.8);

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 1.9);
  }

  public playInteract(): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.09);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  public playDryFire(): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  public playReload(): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(680, this.ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.14);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  public setMasterVolume(val: number): void {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(clamp(val, 0, 1), this.ctx.currentTime);
    }
  }
}

export const soundEngine = new AudioEngine();
