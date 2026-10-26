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
  private noiseBuf: AudioBuffer | null = null;
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

      // Create white noise buffer for gunshots & transients
      const sr = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, sr * 1.0, sr);
      const ndata = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < ndata.length; i++) {
        ndata[i] = Math.random() * 2 - 1;
      }

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

  public setStaticNoise(val: number): void {
    if (this.staticGain && this.ctx) {
      this.staticGain.gain.setValueAtTime(clamp(val * 0.22, 0, 0.35), this.ctx.currentTime);
    }
  }

  public update(dt: number, nearestMonsterDist: number): void {
    if (!this.ctx || !this.isInitialized) return;

    // Smooth ambient volume
    this.currentAmbientVol += (this.targetAmbientVol - this.currentAmbientVol) * dt * 2;
    if (this.windGain) {
      this.windGain.gain.setValueAtTime(this.currentAmbientVol, this.ctx.currentTime);
    }

    const state = useGameStore.getState();

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

  /** Powerful procedural gunshot with noise transient and low punch sub drop */
  public playPistolShot(_pos?: THREE.Vector3): void {
    if (!this.ctx || !this.masterGain) return;
    try {
      const t = this.ctx.currentTime;

      // 1. Filtered noise crack
      if (this.noiseBuf) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuf;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1100, t);
        filter.frequency.exponentialRampToValueAtTime(160, t + 0.18);
        filter.Q.value = 0.9;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.65, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        src.start(t);
        src.stop(t + 0.23);
      }

      // 2. Low punch sub transient (175 Hz -> 36 Hz)
      const punch = this.ctx.createOscillator();
      const pGain = this.ctx.createGain();
      punch.type = 'sine';
      punch.frequency.setValueAtTime(175, t);
      punch.frequency.exponentialRampToValueAtTime(36, t + 0.11);
      pGain.gain.setValueAtTime(0.55, t);
      pGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      punch.connect(pGain);
      pGain.connect(this.masterGain);
      punch.start(t);
      punch.stop(t + 0.13);
    } catch (e) {}
  }

  /** Heavy double-barrel shotgun blast */
  public playShotgunShot(_pos?: THREE.Vector3): void {
    if (!this.ctx || !this.masterGain) return;
    try {
      const t = this.ctx.currentTime;

      if (this.noiseBuf) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuf;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(950, t);
        filter.frequency.exponentialRampToValueAtTime(120, t + 0.32);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.9, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        src.start(t);
        src.stop(t + 0.36);
      }

      // Heavy sub rumble
      const punch = this.ctx.createOscillator();
      const pGain = this.ctx.createGain();
      punch.type = 'triangle';
      punch.frequency.setValueAtTime(130, t);
      punch.frequency.exponentialRampToValueAtTime(24, t + 0.24);
      pGain.gain.setValueAtTime(0.7, t);
      pGain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      punch.connect(pGain);
      pGain.connect(this.masterGain);
      punch.start(t);
      punch.stop(t + 0.28);
    } catch (e) {}
  }

  public playClick(pitch = 850): void {
    if (!this.ctx || !this.masterGain) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(pitch, t);
      osc.frequency.exponentialRampToValueAtTime(220, t + 0.035);
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.045);
    } catch (e) {}
  }

  public playReload(): void {
    this.playClick(620);
    setTimeout(() => this.playClick(940), 450);
    setTimeout(() => this.playClick(1180), 1250);
  }

  public playPickup(): void {
    if (!this.ctx || !this.masterGain) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, t);
      osc.frequency.setValueAtTime(780, t + 0.06);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.19);
    } catch (e) {}
  }

  public playHurt(): void {
    if (!this.ctx || !this.masterGain) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(130, t);
      osc.frequency.exponentialRampToValueAtTime(42, t + 0.25);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.27);
    } catch (e) {}
  }

  public playEnemyHit(): void {
    this.playClick(420);
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
    this.playClick(720);
  }

  public playDryFire(): void {
    this.playClick(700);
  }

  public setMasterVolume(val: number): void {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(clamp(val, 0, 1), this.ctx.currentTime);
    }
  }
}

export const soundEngine = new AudioEngine();
