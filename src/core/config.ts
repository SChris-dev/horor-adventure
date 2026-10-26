// ============================================================================
// Global configuration: quality presets, world layout and gameplay tuning
// ============================================================================

export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';
export type GameMode = 'story' | 'survival';

export interface QualityPreset {
  label: string;
  maxPixelRatio: number;
  minPixelRatio: number;
  flashlightShadows: boolean;
  shadowMapSize: number;
  moonShadows: boolean;
  bloom: boolean;
  msaa: number;
  grassDensity: number; // 0..1 fraction of instances drawn
  grassDistance: number;
  treeDensity: number; // 0..1 fraction of instances drawn
  drawDistance: number; // camera far plane & fog end
  lightPool: number; // number of real-time point lights
  fogSprites: number;
  rainDrops: number;
  hrtf: boolean;
  animFps: number; // max skeletal update rate for far enemies
}

export const QUALITY: Record<QualityLevel, QualityPreset> = {
  low: {
    label: 'Low (Potato)',
    maxPixelRatio: 0.75,
    minPixelRatio: 0.5,
    flashlightShadows: false,
    shadowMapSize: 512,
    moonShadows: false,
    bloom: false,
    msaa: 0,
    grassDensity: 0,
    grassDistance: 0,
    treeDensity: 0.55,
    drawDistance: 62,
    lightPool: 2,
    fogSprites: 10,
    rainDrops: 1400,
    hrtf: false,
    animFps: 15
  },
  medium: {
    label: 'Medium',
    maxPixelRatio: 1,
    minPixelRatio: 0.6,
    flashlightShadows: true,
    shadowMapSize: 512,
    moonShadows: false,
    bloom: false,
    msaa: 0,
    grassDensity: 0.4,
    grassDistance: 34,
    treeDensity: 0.75,
    drawDistance: 78,
    lightPool: 3,
    fogSprites: 18,
    rainDrops: 2600,
    hrtf: true,
    animFps: 24
  },
  high: {
    label: 'High',
    maxPixelRatio: 1.5,
    minPixelRatio: 0.75,
    flashlightShadows: true,
    shadowMapSize: 1024,
    moonShadows: false,
    bloom: true,
    msaa: 2,
    grassDensity: 0.75,
    grassDistance: 46,
    treeDensity: 1,
    drawDistance: 92,
    lightPool: 4,
    fogSprites: 26,
    rainDrops: 4200,
    hrtf: true,
    animFps: 30
  },
  ultra: {
    label: 'Ultra',
    maxPixelRatio: 2,
    minPixelRatio: 1,
    flashlightShadows: true,
    shadowMapSize: 2048,
    moonShadows: true,
    bloom: true,
    msaa: 4,
    grassDensity: 1,
    grassDistance: 60,
    treeDensity: 1,
    drawDistance: 110,
    lightPool: 6,
    fogSprites: 34,
    rainDrops: 6000,
    hrtf: true,
    animFps: 60
  }
};

export const WORLD = {
  seed: 1337,
  size: 512, // meters, square, centered at origin
  cell: 2, // terrain vertex spacing in meters
  chunkCells: 32, // terrain cells per chunk side (=> 64m chunks)
  playRadius: 228, // beyond this the cliffs rise
  waterLevel: -3.2,
  navCell: 1 // nav-grid resolution in meters
};

/** Hand-authored landmark layout (world X/Z). */
export const LAYOUT = {
  spawn: { x: 6, z: 196, yaw: 0 },
  chapel: { x: -62, z: -38, rot: 0 },
  graveyard: { x: -30, z: -36 },
  cabins: [
    { x: 92, z: 64, rot: -0.6 },
    { x: 128, z: -78, rot: 0.9 },
    { x: -136, z: 108, rot: 2.4 },
    { x: 34, z: -146, rot: -2.2 },
    { x: -150, z: -120, rot: 0.3 }
  ],
  lake: { x: 118, z: 150, radius: 46 },
  radioTower: { x: 160, z: -160 },
  gate: { x: 0, z: -214 },
  wreck: { x: -22, z: 88 },
  road: [
    [6, 214],
    [14, 170],
    [-4, 128],
    [-22, 88],
    [-40, 40],
    [-58, -6],
    [-40, -70],
    [-10, -110],
    [12, -160],
    [0, -214]
  ] as [number, number][]
};

export const PLAYER = {
  radius: 0.35,
  halfHeight: 0.55,
  eyeHeight: 1.62,
  crouchEyeHeight: 1.05,
  walkSpeed: 3.4,
  sprintSpeed: 6.1,
  crouchSpeed: 1.7,
  accel: 10,
  airAccel: 2.5,
  gravity: 22,
  jumpSpeed: 6.2,
  maxHp: 100,
  staminaMax: 100,
  staminaDrain: 17,
  staminaRegen: 13,
  jumpCost: 14,
  batteryDrain: 0.5, // % per second
  sanityMax: 100
};

export interface WeaponDef {
  id: 'pistol' | 'shotgun';
  name: string;
  magSize: number;
  damage: number;
  pellets: number;
  spread: number;
  cooldown: number;
  reloadTime: number;
  range: number;
  noiseRadius: number;
  recoil: number;
}

export const WEAPONS: Record<WeaponDef['id'], WeaponDef> = {
  pistol: {
    id: 'pistol',
    name: 'M1911',
    magSize: 8,
    damage: 34,
    pellets: 1,
    spread: 0.006,
    cooldown: 0.24,
    reloadTime: 1.55,
    range: 80,
    noiseRadius: 48,
    recoil: 0.03
  },
  shotgun: {
    id: 'shotgun',
    name: 'Double-Barrel',
    magSize: 2,
    damage: 16,
    pellets: 9,
    spread: 0.075,
    cooldown: 0.75,
    reloadTime: 2.2,
    range: 40,
    noiseRadius: 70,
    recoil: 0.09
  }
};

export const START_LOADOUT = {
  pistolMag: 8,
  pistolReserve: 12,
  shotgunReserve: 0
};
