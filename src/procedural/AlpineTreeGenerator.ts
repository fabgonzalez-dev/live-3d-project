/**
 * procedural/AlpineTreeGenerator.ts
 * Procedural generation of organic, multi-tiered coniferous and alpine pine trees
 * with tapered twisting trunks, root flares, layered drooping branch boughs,
 * and vertex-colored snow-dusted canopies.
 */

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Color constants for realistic alpine trees under nocturnal aurora lighting */
const BARK_BASE = new THREE.Color(0x231710);      // Deep aged bark
const BARK_HIGHLIGHT = new THREE.Color(0x38271c); // Woody highlights
const NEEDLE_DEEP = new THREE.Color(0x0e2a1d);    // Deep shadowy pine green
const NEEDLE_MID = new THREE.Color(0x19422f);     // Forest green
const SNOW_FROST = new THREE.Color(0xd6eef8);     // Crisp moonlit snow crust

/** Applies vertex colors based on height, normal, and component type */
function applyTreeVertexColors(geo: THREE.BufferGeometry, isFoliage: boolean, rngSeed = 42): THREE.BufferGeometry {
  const pos = geo.attributes['position'] as THREE.BufferAttribute;
  const norm = geo.attributes['normal'] as THREE.BufferAttribute;
  const count = pos.count;
  const colors = new Float32Array(count * 3);
  const rng = mulberry32(rngSeed);

  for (let i = 0; i < count; i++) {
    const ny = norm ? norm.getY(i) : 0;

    if (!isFoliage) {
      // Bark trunk: subtle grain variation
      const grain = (rng() - 0.5) * 0.12;
      const c = BARK_BASE.clone().lerp(BARK_HIGHLIGHT, 0.5 + grain);
      colors[i * 3 + 0] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    } else {
      // Foliage: Upward-facing surfaces catch heavy snow; downward surfaces are deep evergreen
      // ny ranges from -1 (underside) to +1 (top surface)
      const snowFactor = Math.max(0, Math.min(1, (ny - 0.15) * 1.5 + (rng() - 0.5) * 0.15));
      const foliageColor = NEEDLE_DEEP.clone().lerp(NEEDLE_MID, rng() * 0.4);
      const finalColor = foliageColor.clone().lerp(SNOW_FROST, Math.pow(snowFactor, 1.4) * 0.88);

      colors[i * 3 + 0] = finalColor.r;
      colors[i * 3 + 1] = finalColor.g;
      colors[i * 3 + 2] = finalColor.b;
    }
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/**
 * Creates an organic bough tier composed of multiple drooping branch clusters
 */
function createBoughTier(
  clusterCount: number,
  tierRadius: number,
  tierHeight: number,
  droopAngle: number,
  rngSeed: number,
): THREE.BufferGeometry {
  const pieces: THREE.BufferGeometry[] = [];
  const rng = mulberry32(rngSeed);

  for (let k = 0; k < clusterCount; k++) {
    const angle = (k / clusterCount) * Math.PI * 2 + (rng() - 0.5) * 0.35;
    const clusterW = (tierRadius / clusterCount) * 2.8 * (0.85 + rng() * 0.3);
    const clusterH = tierHeight * (0.8 + rng() * 0.35);

    // Multi-faceted cone with natural droop
    const branchCone = new THREE.ConeGeometry(clusterW * 0.5, clusterH, 6);
    branchCone.translate(0, clusterH * 0.5, 0);

    // Droop outward and down
    branchCone.rotateZ(droopAngle + (rng() - 0.5) * 0.08);
    branchCone.rotateY(angle);

    const rad = tierRadius * 0.65;
    branchCone.translate(Math.cos(angle) * rad, 0, Math.sin(angle) * rad);

    pieces.push(branchCone);
  }

  // Central core fill for dense foliage volume
  const coreCone = new THREE.ConeGeometry(tierRadius * 0.72, tierHeight * 1.15, 7);
  coreCone.translate(0, tierHeight * 0.55, 0);
  pieces.push(coreCone);

  const merged = BufferGeometryUtils.mergeGeometries(pieces);
  for (const p of pieces) p.dispose();
  return merged;
}

/**
 * Archetype 1: Tall Alpine Grand Pine (~10m tall)
 * Imposing ancient evergreen with 6 drooping bough tiers and visible woody trunk.
 */
export function createGrandAlpinePineGeometry(seed = 101): THREE.BufferGeometry {
  const rng = mulberry32(seed);
  const parts: THREE.BufferGeometry[] = [];

  // 1. Tapered trunk with slight organic lean
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.38, 3.2, 7);
  trunkGeo.translate(0, 1.6, 0);
  trunkGeo.computeVertexNormals();
  applyTreeVertexColors(trunkGeo, false, seed);
  parts.push(trunkGeo);

  // 2. Base root flare
  const rootGeo = new THREE.CylinderGeometry(0.38, 0.62, 0.5, 7);
  rootGeo.translate(0, 0.25, 0);
  rootGeo.computeVertexNormals();
  applyTreeVertexColors(rootGeo, false, seed + 1);
  parts.push(rootGeo);

  // 3. 6 Layers of drooping boughs from low to high
  const tiers = [
    { y: 2.2, r: 2.3, h: 2.2, clusters: 6, droop: 0.28 },
    { y: 3.6, r: 2.0, h: 2.0, clusters: 5, droop: 0.24 },
    { y: 4.9, r: 1.65, h: 1.9, clusters: 5, droop: 0.20 },
    { y: 6.1, r: 1.30, h: 1.7, clusters: 4, droop: 0.16 },
    { y: 7.2, r: 0.95, h: 1.5, clusters: 4, droop: 0.12 },
    { y: 8.2, r: 0.60, h: 1.3, clusters: 3, droop: 0.08 },
  ];

  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i]!;
    const bough = createBoughTier(t.clusters, t.r, t.h, t.droop, seed + i * 17);
    bough.rotateY(rng() * Math.PI * 2);
    bough.translate(0, t.y, 0);
    bough.computeVertexNormals();
    applyTreeVertexColors(bough, true, seed + i * 29);
    parts.push(bough);
  }

  // 4. Spire crown
  const crown = new THREE.ConeGeometry(0.35, 1.4, 6);
  crown.translate(0, 9.3, 0);
  crown.computeVertexNormals();
  applyTreeVertexColors(crown, true, seed + 99);
  parts.push(crown);

  const finalGeo = BufferGeometryUtils.mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return finalGeo;
}

/**
 * Archetype 2: Ancient Gnarly Twisted Pine (~8m tall)
 * Rugged asymmetric silhouette with bent trunk and dense, irregular boughs.
 */
export function createGnarlyTwistedPineGeometry(seed = 202): THREE.BufferGeometry {
  const rng = mulberry32(seed);
  const parts: THREE.BufferGeometry[] = [];

  // Twisted segmented trunk
  const trunkParts: THREE.BufferGeometry[] = [];
  const seg1 = new THREE.CylinderGeometry(0.32, 0.45, 1.6, 7);
  seg1.translate(0, 0.8, 0);
  trunkParts.push(seg1);

  const seg2 = new THREE.CylinderGeometry(0.24, 0.32, 1.6, 7);
  seg2.rotateZ(0.12);
  seg2.translate(0.1, 2.2, 0);
  trunkParts.push(seg2);

  const seg3 = new THREE.CylinderGeometry(0.16, 0.24, 1.8, 6);
  seg3.rotateZ(-0.09);
  seg3.translate(0.05, 3.7, 0);
  trunkParts.push(seg3);

  const mergedTrunk = BufferGeometryUtils.mergeGeometries(trunkParts);
  for (const p of trunkParts) p.dispose();
  mergedTrunk.computeVertexNormals();
  applyTreeVertexColors(mergedTrunk, false, seed);
  parts.push(mergedTrunk);

  // Asymmetric tiers with drooping horizontal spread
  const tiers = [
    { y: 2.8, r: 2.5, h: 2.1, clusters: 5, droop: 0.34, offsetX: 0.25 },
    { y: 4.2, r: 2.1, h: 1.9, clusters: 5, droop: 0.26, offsetX: 0.10 },
    { y: 5.5, r: 1.6, h: 1.7, clusters: 4, droop: 0.20, offsetX: -0.15 },
    { y: 6.7, r: 1.1, h: 1.5, clusters: 3, droop: 0.14, offsetX: -0.05 },
  ];

  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i]!;
    const bough = createBoughTier(t.clusters, t.r, t.h, t.droop, seed + i * 23);
    bough.rotateY(rng() * Math.PI * 2);
    bough.translate(t.offsetX, t.y, 0);
    bough.computeVertexNormals();
    applyTreeVertexColors(bough, true, seed + i * 37);
    parts.push(bough);
  }

  // Rounded wind-swept crown
  const crown = new THREE.ConeGeometry(0.48, 1.5, 6);
  crown.rotateZ(-0.1);
  crown.translate(-0.05, 7.8, 0);
  crown.computeVertexNormals();
  applyTreeVertexColors(crown, true, seed + 101);
  parts.push(crown);

  const finalGeo = BufferGeometryUtils.mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return finalGeo;
}

/**
 * Archetype 3: Slender High-Altitude Fir (~9m tall)
 * Symmetrical, elegant alpine needle spire with sharp pyramidal profile.
 */
export function createSlenderFirGeometry(seed = 303): THREE.BufferGeometry {
  const rng = mulberry32(seed);
  const parts: THREE.BufferGeometry[] = [];

  const trunk = new THREE.CylinderGeometry(0.12, 0.26, 2.5, 6);
  trunk.translate(0, 1.25, 0);
  trunk.computeVertexNormals();
  applyTreeVertexColors(trunk, false, seed);
  parts.push(trunk);

  const tiers = [
    { y: 1.8, r: 1.8, h: 1.8, clusters: 5, droop: 0.22 },
    { y: 3.1, r: 1.5, h: 1.6, clusters: 5, droop: 0.19 },
    { y: 4.3, r: 1.25, h: 1.5, clusters: 4, droop: 0.16 },
    { y: 5.4, r: 1.0, h: 1.4, clusters: 4, droop: 0.13 },
    { y: 6.4, r: 0.75, h: 1.3, clusters: 3, droop: 0.10 },
    { y: 7.4, r: 0.50, h: 1.2, clusters: 3, droop: 0.06 },
  ];

  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i]!;
    const bough = createBoughTier(t.clusters, t.r, t.h, t.droop, seed + i * 19);
    bough.rotateY(rng() * Math.PI * 2);
    bough.translate(0, t.y, 0);
    bough.computeVertexNormals();
    applyTreeVertexColors(bough, true, seed + i * 43);
    parts.push(bough);
  }

  const spire = new THREE.ConeGeometry(0.28, 1.6, 6);
  spire.translate(0, 8.4, 0);
  spire.computeVertexNormals();
  applyTreeVertexColors(spire, true, seed + 105);
  parts.push(spire);

  const finalGeo = BufferGeometryUtils.mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return finalGeo;
}

/**
 * Archetype 4: Roadside Snow Pine Shrub / Dwarf Pine (~4m tall)
 * Low-lying, dense snowy cluster lining the snowbanks.
 */
export function createRoadsideSnowShrubGeometry(seed = 404): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  const bough1 = new THREE.ConeGeometry(1.4, 1.8, 6);
  bough1.translate(0, 0.9, 0);
  applyTreeVertexColors(bough1, true, seed);
  parts.push(bough1);

  const bough2 = new THREE.ConeGeometry(1.05, 1.5, 6);
  bough2.rotateY(0.5);
  bough2.translate(0, 1.8, 0);
  applyTreeVertexColors(bough2, true, seed + 1);
  parts.push(bough2);

  const bough3 = new THREE.ConeGeometry(0.65, 1.2, 5);
  bough3.rotateY(1.1);
  bough3.translate(0, 2.6, 0);
  applyTreeVertexColors(bough3, true, seed + 2);
  parts.push(bough3);

  const finalGeo = BufferGeometryUtils.mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return finalGeo;
}
