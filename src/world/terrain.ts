// ============================================================================
// Terrain Generator: Procedural Heightmap, Splat Vertex Colors, and Rapier Colliders
// Creates the open world "Argon Hollow" valley bounded by sheer cliffs.
// ============================================================================

import * as THREE from 'three';
import { Simplex2D, distToSegment, clamp } from '../core/math';
import { WORLD, LAYOUT } from '../core/config';
import { getTextureAtlas } from '../engine/textures';
import { physics } from '../engine/physics';

const simplex = new Simplex2D(WORLD.seed);

/**
 * Returns height Y in meters for world coordinate (x, z).
 * Smooth valley floor, carved road, lake depression, and steep perimeter cliffs.
 */
export function getTerrainHeight(x: number, z: number): number {
  const distFromCenter = Math.hypot(x, z);

  // Base rolling hills and valley floor
  const n1 = simplex.fbm(x * 0.007, z * 0.007, 4, 2, 0.5) * 14;
  const n2 = simplex.fbm(x * 0.02, z * 0.02, 3, 2, 0.45) * 4;
  let height = n1 + n2;

  // Carve road: flatten terrain along road segments
  for (let i = 0; i < LAYOUT.road.length - 1; i++) {
    const [ax, az] = LAYOUT.road[i];
    const [bx, bz] = LAYOUT.road[i + 1];
    const d = distToSegment(x, z, ax, az, bx, bz);
    if (d < 7) {
      const roadFactor = 1.0 - smoothstep(2.5, 7.0, d);
      height = height * (1 - roadFactor * 0.7); // flatten
    }
  }

  // Carve Lake basin
  const lakeDist = Math.hypot(x - LAYOUT.lake.x, z - LAYOUT.lake.z);
  if (lakeDist < LAYOUT.lake.radius + 15) {
    const lakeFactor = 1.0 - smoothstep(LAYOUT.lake.radius - 12, LAYOUT.lake.radius + 15, lakeDist);
    height = height * (1 - lakeFactor) + (WORLD.waterLevel - 3.5) * lakeFactor;
  }

  // Chapel plateau
  const chapelDist = Math.hypot(x - LAYOUT.chapel.x, z - LAYOUT.chapel.z);
  if (chapelDist < 35) {
    const pFactor = 1.0 - smoothstep(18, 35, chapelDist);
    height = height * (1 - pFactor) + (1.5) * pFactor;
  }

  // Outer quarantine cliff walls
  if (distFromCenter > WORLD.playRadius - 30) {
    const cliffFactor = clamp((distFromCenter - (WORLD.playRadius - 30)) / 45, 0, 1);
    const cliffNoise = simplex.fbm(x * 0.04, z * 0.04, 3) * 12;
    height += Math.pow(cliffFactor, 2.2) * 48 + cliffNoise * cliffFactor;
  }

  return height;
}

function smoothstep(min: number, max: number, value: number): number {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

export function createTerrain(): { mesh: THREE.Mesh; waterMesh: THREE.Mesh } {
  const size = WORLD.size;
  const segments = 128; // 128x128 grid for smooth hills
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  // Vertices and indices for Rapier collider
  const vertices = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = getTerrainHeight(x, z);
    pos.setY(i, y);

    vertices[i * 3] = x;
    vertices[i * 3 + 1] = y;
    vertices[i * 3 + 2] = z;

    // Splat vertex coloring:
    // Dark earth base
    let r = 0.14;
    let g = 0.12;
    let b = 0.10;

    // Near water: dark mud & silt
    if (y < WORLD.waterLevel + 1.2) {
      r = 0.08;
      g = 0.08;
      b = 0.07;
    }

    // High slope / cliffs: grey rock
    if (y > 18) {
      const rockFactor = clamp((y - 18) / 20, 0, 1);
      r = r * (1 - rockFactor) + 0.22 * rockFactor;
      g = g * (1 - rockFactor) + 0.22 * rockFactor;
      b = b * (1 - rockFactor) + 0.24 * rockFactor;
    }

    // Road coloration (slightly lighter packed gravel)
    for (let s = 0; s < LAYOUT.road.length - 1; s++) {
      const d = distToSegment(x, z, LAYOUT.road[s][0], LAYOUT.road[s][1], LAYOUT.road[s + 1][0], LAYOUT.road[s + 1][1]);
      if (d < 4.0) {
        const rf = 1.0 - d / 4.0;
        r += 0.06 * rf;
        g += 0.05 * rf;
        b += 0.04 * rf;
      }
    }

    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const textures = getTextureAtlas();
  const mat = new THREE.MeshStandardMaterial({
    map: textures.ground,
    roughness: 0.92,
    metalness: 0.05,
    vertexColors: true
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;

  // Add Rapier trimesh collider
  const indexAttr = geo.getIndex();
  if (indexAttr) {
    const indices = new Uint32Array(indexAttr.array);
    physics.addTerrainCollider(vertices, indices);
  }

  // Dark murky lake water surface
  const waterGeo = new THREE.CircleGeometry(LAYOUT.lake.radius + 8, 48);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x050d12,
    roughness: 0.12,
    metalness: 0.85,
    transparent: true,
    opacity: 0.88
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.set(LAYOUT.lake.x, WORLD.waterLevel, LAYOUT.lake.z);
  waterMesh.receiveShadow = true;

  return { mesh, waterMesh };
}
