// ============================================================================
// Procedural Texture Generator for Argon Hollow
// Generates high-atmosphere horror textures using procedural noise and canvas
// ============================================================================

import * as THREE from 'three';
import { Rng, tileFbm } from '../core/math';

export interface TextureAtlas {
  ground: THREE.CanvasTexture;
  groundNormal: THREE.CanvasTexture;
  bark: THREE.CanvasTexture;
  woodPlanks: THREE.CanvasTexture;
  stone: THREE.CanvasTexture;
  rustyMetal: THREE.CanvasTexture;
  bloodDecal: THREE.CanvasTexture;
  grassBlade: THREE.CanvasTexture;
  fogPuff: THREE.CanvasTexture;
  flashlightCookie: THREE.CanvasTexture;
}

let cachedTextures: TextureAtlas | null = null;

function createCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/** Generates tileable damp forest soil / leaf mulch texture. */
function createGroundTexture(size = 512): HTMLCanvasElement {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;
  const rng = new Rng(42);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const n1 = tileFbm(u, v, 6, 4, 101);
      const n2 = tileFbm(u, v, 16, 3, 202);
      const pebble = rng.chance(0.015) ? rng.range(0.15, 0.35) : 0;

      // Rich forest earth with damp mulch and scattered pebbles
      let r = 78 + n1 * 32 + n2 * 18 + pebble * 70;
      let g = 68 + n1 * 28 + n2 * 15 + pebble * 65;
      let b = 55 + n1 * 22 + n2 * 12 + pebble * 55;

      const idx = (y * size + x) * 4;
      data[idx] = Math.min(255, Math.floor(r));
      data[idx + 1] = Math.min(255, Math.floor(g));
      data[idx + 2] = Math.min(255, Math.floor(b));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/** Generates rough dead pine tree bark. */
function createBarkTexture(size = 256): HTMLCanvasElement {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Stretched vertically for bark ridges
      const u = x / size;
      const v = y / size;
      const n1 = tileFbm(u * 8, v * 2, 4, 4, 303);
      const n2 = tileFbm(u * 16, v * 1, 6, 3, 404);

      const val = n1 * 0.7 + n2 * 0.3;
      const r = 65 + val * 45;
      const g = 52 + val * 35;
      const b = 42 + val * 28;

      const idx = (y * size + x) * 4;
      data[idx] = Math.min(255, Math.floor(r));
      data[idx + 1] = Math.min(255, Math.floor(g));
      data[idx + 2] = Math.min(255, Math.floor(b));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/** Generates weathered rotting wooden planks for cabins and docks. */
function createWoodPlanksTexture(size = 512): HTMLCanvasElement {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  const numPlanks = 8;
  const plankHeight = size / numPlanks;

  for (let y = 0; y < size; y++) {
    const plankIdx = Math.floor(y / plankHeight);
    const plankY = (y % plankHeight) / plankHeight;
    const isSeam = plankY < 0.04 || plankY > 0.96;
    const plankSeed = plankIdx * 77 + 12;

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const grain = tileFbm(u * 14, v * 2, 6, 3, plankSeed);

      let r = 85 + grain * 38;
      let g = 70 + grain * 30;
      let b = 55 + grain * 24;

      if (isSeam) {
        r *= 0.45;
        g *= 0.45;
        b *= 0.45;
      }

      const idx = (y * size + x) * 4;
      data[idx] = Math.min(255, Math.floor(r));
      data[idx + 1] = Math.min(255, Math.floor(g));
      data[idx + 2] = Math.min(255, Math.floor(b));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/** Generates weathered chapel cobblestone with dark moss. */
function createStoneTexture(size = 512): HTMLCanvasElement {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const n1 = tileFbm(u, v, 8, 4, 505);
      const moss = tileFbm(u * 2, v * 2, 4, 3, 606);

      let r = 85 + n1 * 45;
      let g = 85 + n1 * 45;
      let b = 90 + n1 * 45;

      // Dark mold and moss in crevices
      if (moss > 0.6) {
        g += (moss - 0.6) * 40;
        r -= 10;
        b -= 10;
      }

      const idx = (y * size + x) * 4;
      data[idx] = Math.max(0, Math.min(255, Math.floor(r)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.floor(g)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.floor(b)));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/** Generates rusted corroded metal. */
function createRustyMetalTexture(size = 256): HTMLCanvasElement {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const n = tileFbm(u, v, 6, 4, 707);
      const rust = tileFbm(u * 2, v * 2, 8, 3, 808);

      let r = 40 + n * 20;
      let g = 40 + n * 20;
      let b = 42 + n * 20;

      if (rust > 0.45) {
        const factor = (rust - 0.45) * 2;
        r += factor * 55;
        g += factor * 20;
        b -= factor * 10;
      }

      const idx = (y * size + x) * 4;
      data[idx] = Math.max(0, Math.min(255, Math.floor(r)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.floor(g)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.floor(b)));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/** Generates graphic bloody splatter decal with drips and coagulation. */
function createBloodDecalTexture(size = 256): HTMLCanvasElement {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;
  const rng = new Rng(999);

  ctx.clearRect(0, 0, size, size);

  // Central impact splatter pool
  for (let i = 0; i < 22; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const dist = rng.range(0, size * 0.28);
    const r = rng.range(size * 0.06, size * 0.18);
    const px = cx + Math.cos(angle) * dist;
    const py = cy + Math.sin(angle) * dist;

    const grad = ctx.createRadialGradient(px, py, 0, px, py, r);
    grad.addColorStop(0, 'rgba(110, 4, 4, 0.95)');
    grad.addColorStop(0.65, 'rgba(65, 2, 2, 0.85)');
    grad.addColorStop(1, 'rgba(30, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Radiating droplets and streaks
  for (let i = 0; i < 35; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const dist = rng.range(size * 0.2, size * 0.46);
    const dropR = rng.range(1.5, 4.5);
    const px = cx + Math.cos(angle) * dist;
    const py = cy + Math.sin(angle) * dist;

    ctx.fillStyle = rng.chance(0.5) ? 'rgba(95, 3, 3, 0.85)' : 'rgba(50, 1, 1, 0.9)';
    ctx.beginPath();
    ctx.arc(px, py, dropR, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

/** Generates dead yellow-brown grass tuft cutout. */
function createGrassBladeTexture(size = 128): HTMLCanvasElement {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  const rng = new Rng(1234);
  const numBlades = 16;

  for (let i = 0; i < numBlades; i++) {
    const bx = size * 0.5 + rng.range(-15, 15);
    const by = size;
    const tipX = bx + rng.range(-40, 40);
    const tipY = rng.range(10, 40);
    const cpX = (bx + tipX) / 2 + rng.range(-20, 20);
    const cpY = (by + tipY) / 2;

    const shade = rng.range(0.8, 1.2);
    const r = Math.floor(48 * shade);
    const g = Math.floor(44 * shade);
    const b = Math.floor(28 * shade);

    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.9)`;
    ctx.lineWidth = rng.range(2, 3.5);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(cpX, cpY, tipX, tipY);
    ctx.stroke();
  }

  return canvas;
}

/** Generates soft volumetric fog particle sprite. */
function createFogPuffTexture(size = 128): HTMLCanvasElement {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  const c = size / 2;

  const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
  grad.addColorStop(0, 'rgba(210, 220, 230, 0.35)');
  grad.addColorStop(0.35, 'rgba(180, 195, 205, 0.2)');
  grad.addColorStop(0.7, 'rgba(140, 155, 165, 0.07)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

/** Generates realistic flashlight cookie texture with lens ring falloff. */
function createFlashlightCookieTexture(size = 256): HTMLCanvasElement {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  const c = size / 2;

  const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
  grad.addColorStop(0, 'rgba(255, 255, 250, 1)');
  grad.addColorStop(0.18, 'rgba(245, 245, 235, 0.92)');
  grad.addColorStop(0.5, 'rgba(190, 200, 215, 0.55)');
  grad.addColorStop(0.78, 'rgba(90, 100, 120, 0.2)');
  grad.addColorStop(0.92, 'rgba(30, 40, 50, 0.05)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

/** Preload and return texture atlas. */
export function getTextureAtlas(): TextureAtlas {
  if (cachedTextures) return cachedTextures;

  const groundCanvas = createGroundTexture(512);
  const groundTex = new THREE.CanvasTexture(groundCanvas);
  groundTex.wrapS = THREE.RepeatWrapping;
  groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(32, 32);

  const groundNormTex = new THREE.CanvasTexture(groundCanvas);
  groundNormTex.wrapS = THREE.RepeatWrapping;
  groundNormTex.wrapT = THREE.RepeatWrapping;
  groundNormTex.repeat.set(32, 32);

  const barkCanvas = createBarkTexture(256);
  const barkTex = new THREE.CanvasTexture(barkCanvas);
  barkTex.wrapS = THREE.RepeatWrapping;
  barkTex.wrapT = THREE.RepeatWrapping;
  barkTex.repeat.set(1, 4);

  const woodCanvas = createWoodPlanksTexture(512);
  const woodTex = new THREE.CanvasTexture(woodCanvas);
  woodTex.wrapS = THREE.RepeatWrapping;
  woodTex.wrapT = THREE.RepeatWrapping;
  woodTex.repeat.set(2, 2);

  const stoneCanvas = createStoneTexture(512);
  const stoneTex = new THREE.CanvasTexture(stoneCanvas);
  stoneTex.wrapS = THREE.RepeatWrapping;
  stoneTex.wrapT = THREE.RepeatWrapping;
  stoneTex.repeat.set(4, 4);

  const rustCanvas = createRustyMetalTexture(256);
  const rustTex = new THREE.CanvasTexture(rustCanvas);
  rustTex.wrapS = THREE.RepeatWrapping;
  rustTex.wrapT = THREE.RepeatWrapping;

  const bloodCanvas = createBloodDecalTexture(256);
  const bloodTex = new THREE.CanvasTexture(bloodCanvas);

  const grassCanvas = createGrassBladeTexture(128);
  const grassTex = new THREE.CanvasTexture(grassCanvas);

  const fogCanvas = createFogPuffTexture(128);
  const fogTex = new THREE.CanvasTexture(fogCanvas);

  const cookieCanvas = createFlashlightCookieTexture(256);
  const cookieTex = new THREE.CanvasTexture(cookieCanvas);

  cachedTextures = {
    ground: groundTex,
    groundNormal: groundNormTex,
    bark: barkTex,
    woodPlanks: woodTex,
    stone: stoneTex,
    rustyMetal: rustTex,
    bloodDecal: bloodTex,
    grassBlade: grassTex,
    fogPuff: fogTex,
    flashlightCookie: cookieTex
  };

  return cachedTextures;
}
