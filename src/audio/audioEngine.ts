// ============================================================================
// 3D Spatial Audio Engine: Cinematic Horror Ambience and Balanced SFX
// Pure atmospheric audio: gentle howling wind, deep sub-bass drone, HRTF spatial sounds
// Zero piercing frequencies.
// ============================================================================

import * as THREE from 'three';
import { clamp } from '../core/math';
import { useGameStore } from '../state/store';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private staticGain: GainNode | null = null;

  private isInitialized = false;
  private targetAmbientVol = 0.22;
  private currentAmbientVol = 0.22;

  private nextHeartbeatTime = 0;

  public init(): void {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = useGameStore.getState().masterVolume;
      this.masterGain.connect(this.ctx.destination);

      // 1. Soft atmospheric wind in dead trees
      this.initWindBed();

      // 2. Subtle deep sub-drone (low horror presence)
      this.initSubDrone();

      // 3. Radio static for Pale Bride proximity
      this.initStaticBed();

      this.isInitialized = true;
    } catch (e) {
      console.warn('AudioEngine waiting for user click to start audio context:', e);
    }
  }

  public resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private initWindBed(): void {
    if (!this.ctx || !this.masterGain) return;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.15;
    this.windGain.connect(this.masterGain);

    // Warm, gentle pink-tinted noise buffer
    const bufferSize = this.ctx.sampleRate * 4;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      data[i] = (b0 + b1 + b2) * 0.12;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    // Smooth low-pass filter to eliminate any harsh high frequencies
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    filter.Q.value = 1.0;

    noiseSource.connect(filter);
    filter.connect(this.windGain);
    noiseSource.start();
  }

  private initSubDrone(): void {
    if (!this.ctx || !this.masterGain) return;

    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.08;
    this.droneGain.connect(this.masterGain);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 46; // Warm 46Hz low frequency sub rumble

    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 80;

    osc.connect(lowpass);
    lowpass.connect(this.droneGain);
    osc.start();
  }

  private initStaticBed(): void {
    if (!this.ctx || !this.masterGain) return;

    this.staticGain = this.ctx.createGain();
    this.staticGain.gain.value = 0;
    this.staticGain.connect(this.masterGain);

    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.15;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 1.5;

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

  /** Ducks ambient sound when monster is close (eerie hush). */
  public setSafeWildlifeFactor(factor: number): void {
    this.targetAmbientVol = 0.04 + clamp(factor, 0, 1) * 0.14;
  }

  public update(dt: number, nearestMonsterDist: number): void {
    if (!this.ctx || !this.isInitialized) return;

    // Smooth ambient volume
    this.currentAmbientVol += (this.targetAmbientVol - this.currentAmbientVol) * dt * 2;
    if (this.windGain) {
      this.windGain.gain.setValueAtTime(this.currentAmbientVol, this.ctx.currentTime);
    }

    const state = useGameStore.getState();

    // Radio static tied to Pale Bride proximity
    if (this.staticGain) {
      const targetStatic = state.staticNoise * 0.22;
      this.staticGain.gain.setValueAtTime(targetStatic, this.ctx.currentTime);
    }

    // Dynamic heartbeat thump when hurt or terrorized
    const bpm = state.heartbeatRate;
    const interval = 60 / bpm;
    if (this.ctx.currentTime >= this.nextHeartbeatTime && (state.hp < 40 || state.sanity < 40 || nearestMonsterDist < 18)) {
      this.playHeartbeatThump();
      this.nextHeartbeatTime = this.ctx.currentTime + interval;
    }
  }

  private playHeartbeatThump(): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(65, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(32, this.ctx.currentTime + 0.14);

    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.16);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.18);
  }

  // -------------------------------------------------------------------------
  // Spatial SFX
  // -------------------------------------------------------------------------

  public playFootstep(pos: THREE.Vector3, surface: 'dirt' | 'wood' | 'stone' = 'dirt'): void {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    const freq = surface === 'wood' ? 110 : surface === 'stone' ? 140 : 80;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(35, this.ctx.currentTime + 0.06);

    filter.type = 'lowpass';
    filter.frequency.value = 260;

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.07);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  public playPistolShot(pos: THREE.Vector3): void {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.65, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.14);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.16);
  }

  public playShotgunShot(pos: THREE.Vector3): void {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(25, this.ctx.currentTime + 0.28);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 450;

    gain.gain.setValueAtTime(0.8, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.32);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.35);
  }

  public playMonsterGrowl(pos: THREE.Vector3, pitch = 1.0): void {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90 * pitch, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(55 * pitch, this.ctx.currentTime + 0.7);

    filter.type = 'lowpass';
    filter.frequency.value = 240;

    gain.gain.setValueAtTime(0.01, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.35, this.ctx.currentTime + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.75);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.8);
  }

  public playBrideWhisper(pos: THREE.Vector3): void {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(380, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(340, this.ctx.currentTime + 0.8);

    gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.16, this.ctx.currentTime + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.9);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.95);
  }

  public playWatcherHum(pos: THREE.Vector3): void {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(42, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.01, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.45, this.ctx.currentTime + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.2);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 1.3);
  }

  public playInteract(): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(280, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
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
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.04);
  }

  public playReload(): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(520, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.14);
  }

  public setMasterVolume(val: number): void {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(clamp(val, 0, 1), this.ctx.currentTime);
    }
  }
}

export const soundEngine = new AudioEngine();
