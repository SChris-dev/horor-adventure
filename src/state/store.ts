// ============================================================================
// Zustand Store: Bridge between Three.js game engine and React UI
// ============================================================================

import { create } from 'zustand';
import { QualityLevel, START_LOADOUT } from '../core/config';

export type GameStatus = 'loading' | 'title' | 'playing' | 'paused' | 'gameover' | 'victory';

export interface NoteItem {
  id: string;
  title: string;
  author: string;
  date?: string;
  body: string;
}

export interface GameState {
  status: GameStatus;
  quality: QualityLevel;
  mouseSensitivity: number;
  masterVolume: number;

  // Player Stats
  hp: number;
  maxHp: number;
  stamina: number;
  staminaMax: number;
  sanity: number;
  sanityMax: number;
  isCrouching: boolean;
  isSprinting: boolean;

  // Flashlight
  flashlightOn: boolean;
  battery: number; // 0..100

  // Weapons & Combat
  currentWeapon: 'pistol' | 'shotgun';
  pistolMag: number;
  pistolReserve: number;
  shotgunMag: number;
  shotgunReserve: number;
  isReloading: boolean;
  hitMarkerTimer: number;

  // Inventory
  hasKeyCabin: boolean;
  hasKeyChapel: boolean;
  hasKeyGate: boolean;
  fusesCollected: number; // 0 / 3
  medkits: number;
  batteries: number;

  // Objectives
  currentObjective: string;
  objectiveHint: string;

  // Lore / Notes popup
  activeNote: NoteItem | null;

  // Horror / Dread visual feedback
  bloodPulse: number; // 0..1
  sanityGlitch: number; // 0..1
  staticNoise: number; // 0..1 for Wraith presence
  heartbeatRate: number; // BPM (60..180)

  // Game over / victory lore
  deathMessage: string;

  // Actions
  setStatus: (status: GameStatus) => void;
  setQuality: (quality: QualityLevel) => void;
  setSensitivity: (val: number) => void;
  setMasterVolume: (val: number) => void;
  takeDamage: (amount: number, reason?: string) => void;
  heal: (amount: number) => void;
  drainSanity: (amount: number) => void;
  restoreSanity: (amount: number) => void;
  toggleFlashlight: () => void;
  setFlashlight: (on: boolean) => void;
  drainBattery: (amount: number) => void;
  useBatteryItem: () => boolean;
  useMedkitItem: () => boolean;
  switchWeapon: (weapon: 'pistol' | 'shotgun') => void;
  setAmmo: (updates: Partial<{ pistolMag: number; pistolReserve: number; shotgunMag: number; shotgunReserve: number }>) => void;
  setReloading: (reloading: boolean) => void;
  triggerHitMarker: () => void;
  setObjective: (title: string, hint?: string) => void;
  readNote: (note: NoteItem | null) => void;
  collectFuse: () => void;
  collectKey: (key: 'cabin' | 'chapel' | 'gate') => void;
  setHorrorFeedback: (feedback: { bloodPulse?: number; sanityGlitch?: number; staticNoise?: number; heartbeatRate?: number }) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  status: 'title',
  quality: 'high',
  mouseSensitivity: 0.0022,
  masterVolume: 0.8,

  hp: 100,
  maxHp: 100,
  stamina: 100,
  staminaMax: 100,
  sanity: 100,
  sanityMax: 100,
  isCrouching: false,
  isSprinting: false,

  flashlightOn: true,
  battery: 100,

  currentWeapon: 'pistol',
  pistolMag: START_LOADOUT.pistolMag,
  pistolReserve: START_LOADOUT.pistolReserve,
  shotgunMag: 2,
  shotgunReserve: START_LOADOUT.shotgunReserve,
  isReloading: false,
  hitMarkerTimer: 0,

  hasKeyCabin: false,
  hasKeyChapel: false,
  hasKeyGate: false,
  fusesCollected: 0,
  medkits: 1,
  batteries: 2,

  currentObjective: 'Investigate Argon Hollow and find a way out',
  objectiveHint: 'Follow the overgrown road north toward the quarantined gate',

  activeNote: null,

  bloodPulse: 0,
  sanityGlitch: 0,
  staticNoise: 0,
  heartbeatRate: 70,

  deathMessage: 'You vanished into the mist of Argon Hollow.',

  setStatus: (status) => set({ status }),
  setQuality: (quality) => set({ quality }),
  setSensitivity: (mouseSensitivity) => set({ mouseSensitivity }),
  setMasterVolume: (masterVolume) => set({ masterVolume }),

  takeDamage: (amount, reason = 'Slain by the entities of Argon Hollow') => {
    const nextHp = Math.max(0, get().hp - amount);
    set({
      hp: nextHp,
      bloodPulse: 1.0,
      heartbeatRate: Math.min(170, get().heartbeatRate + 25)
    });
    if (nextHp <= 0) {
      set({ status: 'gameover', deathMessage: reason });
    }
  },

  heal: (amount) => set((s) => ({ hp: Math.min(s.maxHp, s.hp + amount) })),

  drainSanity: (amount) =>
    set((s) => ({
      sanity: Math.max(0, s.sanity - amount),
      sanityGlitch: Math.max(s.sanityGlitch, Math.min(1, (100 - (s.sanity - amount)) / 70))
    })),

  restoreSanity: (amount) =>
    set((s) => ({
      sanity: Math.min(s.sanityMax, s.sanity + amount),
      sanityGlitch: Math.max(0, s.sanityGlitch - amount * 0.02)
    })),

  toggleFlashlight: () => {
    const s = get();
    if (s.battery <= 0 && !s.flashlightOn) return;
    set({ flashlightOn: !s.flashlightOn });
  },

  setFlashlight: (flashlightOn) => set({ flashlightOn }),

  drainBattery: (amount) => {
    const s = get();
    if (!s.flashlightOn) return;
    const nextBat = Math.max(0, s.battery - amount);
    if (nextBat <= 0) {
      set({ battery: 0, flashlightOn: false });
    } else {
      set({ battery: nextBat });
    }
  },

  useBatteryItem: () => {
    const s = get();
    if (s.batteries > 0 && s.battery < 95) {
      set({
        batteries: s.batteries - 1,
        battery: Math.min(100, s.battery + 60),
        flashlightOn: true
      });
      return true;
    }
    return false;
  },

  useMedkitItem: () => {
    const s = get();
    if (s.medkits > 0 && s.hp < s.maxHp) {
      set({
        medkits: s.medkits - 1,
        hp: Math.min(s.maxHp, s.hp + 45)
      });
      return true;
    }
    return false;
  },

  switchWeapon: (weapon) => {
    if (!get().isReloading) {
      set({ currentWeapon: weapon });
    }
  },

  setAmmo: (updates) => set(updates),

  setReloading: (isReloading) => set({ isReloading }),

  triggerHitMarker: () => set({ hitMarkerTimer: 0.18 }),

  setObjective: (currentObjective, objectiveHint = '') =>
    set({ currentObjective, objectiveHint }),

  readNote: (activeNote) => set({ activeNote }),

  collectFuse: () => {
    const count = get().fusesCollected + 1;
    set({ fusesCollected: count });
    if (count >= 3) {
      set({
        currentObjective: 'Restore power to the Radio Tower generator',
        objectiveHint: 'All 3 fuses found! Climb the hill to the Radio Tower and activate the beacon'
      });
    } else {
      set({
        objectiveHint: `Fuses recovered: ${count}/3`
      });
    }
  },

  collectKey: (key) => {
    if (key === 'cabin') set({ hasKeyCabin: true });
    if (key === 'chapel') set({ hasKeyChapel: true });
    if (key === 'gate') set({ hasKeyGate: true });
  },

  setHorrorFeedback: (feedback) => set(feedback),

  resetGame: () => {
    set({
      status: 'playing',
      hp: 100,
      stamina: 100,
      sanity: 100,
      isCrouching: false,
      isSprinting: false,
      flashlightOn: true,
      battery: 100,
      currentWeapon: 'pistol',
      pistolMag: START_LOADOUT.pistolMag,
      pistolReserve: START_LOADOUT.pistolReserve,
      shotgunMag: 2,
      shotgunReserve: START_LOADOUT.shotgunReserve,
      isReloading: false,
      hasKeyCabin: false,
      hasKeyChapel: false,
      hasKeyGate: false,
      fusesCollected: 0,
      medkits: 1,
      batteries: 2,
      currentObjective: 'Investigate Argon Hollow and find a way out',
      objectiveHint: 'Follow the overgrown road north toward the quarantined gate',
      activeNote: null,
      bloodPulse: 0,
      sanityGlitch: 0,
      staticNoise: 0,
      heartbeatRate: 70
    });
  }
}));
