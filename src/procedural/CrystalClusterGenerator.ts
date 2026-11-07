/**
 * procedural/CrystalClusterGenerator.ts
 * Procedural generation of organic crystalline cavern geometry (TARGET_07–08 / improvements.md §9).
 * Modeled after natural amethyst geode sanctuaries:
 * - Multi-spire natural amethyst geode clusters with 6-sided hexagonal columns and bevelled pyramidal tips
 * - Grand natural cavern rock archways framing the overhead vault with encrusted crystal veins
 * - Subtle floating luminous gem prisms with bevelled natural facets
 * - Ceiling stalactite quartz needle clusters hanging gracefully from cavern roof
 * - Vertex-colored: dark slate matrix rock base -> deep royal amethyst -> luminous lilac -> icy cyan & diamond tips
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

// Art-directed natural amethyst & quartz palette constants
const COLOR_HOST_ROCK       = new THREE.Color(0x0e0c18); // Dark charcoal/slate matrix rock
const COLOR_AMETHYST_DEEP   = new THREE.Color(0x3b186b); // Deep royal amethyst base
const COLOR_AMETHYST_MID    = new THREE.Color(0x7e22ce); // Radiant violet body
const COLOR_AMETHYST_LILAC  = new THREE.Color(0xc084fc); // Luminous lilac / orchid translucence
const COLOR_CRYSTAL_CYAN    = new THREE.Color(0x67e8f9); // Prismatic icy cyan facet glint
const COLOR_CRYSTAL_HOT     = new THREE.Color(0xfdf4ff); // Diamond white crystalline termination

/** Normalizes and safely merges buffer geometries with matching non-indexed attributes */
export function mergeCrystalParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const normalized: THREE.BufferGeometry[] = [];
  for (const p of parts) {
    const nonIndexed = p.index ? p.toNonIndexed() : p.clone();
    if (!nonIndexed.attributes['normal']) nonIndexed.computeVertexNormals();
    if (!nonIndexed.attributes['color']) {
      const colors = new Float32Array(nonIndexed.attributes['position']!.count * 3);
      colors.fill(0.5);
      nonIndexed.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    if (nonIndexed.attributes['uv']) nonIndexed.deleteAttribute('uv');
    if (nonIndexed.attributes['uv1']) nonIndexed.deleteAttribute('uv1');

    normalized.push(nonIndexed);
    p.dispose();
  }

  const merged = BufferGeometryUtils.mergeGeometries(normalized, false);
  for (const n of normalized) n.dispose();
  return merged ?? new THREE.BufferGeometry();
}

/** Applies a natural multi-stop height gradient vertex color to a crystal geometry */
function applyCrystalGradient(
  geo: THREE.BufferGeometry,
  baseColor: THREE.Color,
  deepColor: THREE.Color,
  midColor: THREE.Color,
  lightColor: THREE.Color,
  tipColor: THREE.Color,
  minY: number,
  maxY: number,
): THREE.BufferGeometry {
  const pos = geo.attributes['position']!;
  const count = pos.count;
  const colors = new Float32Array(count * 3);
  const range = Math.max(maxY - minY, 0.001);

  const c = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const y = pos.getY(i);
    const t = THREE.MathUtils.clamp((y - minY) / range, 0, 1);

    if (t < 0.20) {
      c.copy(baseColor).lerp(deepColor, t / 0.20);
    } else if (t < 0.55) {
      c.copy(deepColor).lerp(midColor, (t - 0.20) / 0.35);
    } else if (t < 0.85) {
      c.copy(midColor).lerp(lightColor, (t - 0.55) / 0.30);
    } else {
      c.copy(lightColor).lerp(tipColor, (t - 0.85) / 0.15);
    }

    colors[i * 3 + 0] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/** Applies uniform vertex color */
function applyUniformColor(geo: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
  const count = geo.attributes['position']!.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3 + 0] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/**
 * Creates a natural 6-sided hexagonal quartz crystal spire with bevelled pyramidal tip.
 * Mimics authentic geological quartz/amethyst crystal morphology.
 */
function createSingleSpire(
  radius: number,
  height: number,
  tipHeight: number,
  baseColor = COLOR_HOST_ROCK,
  deepColor = COLOR_AMETHYST_DEEP,
  midColor = COLOR_AMETHYST_MID,
  lightColor = COLOR_AMETHYST_LILAC,
  tipColor = COLOR_CRYSTAL_HOT,
): THREE.BufferGeometry {
  const segments = 6; // Authentic hexagonal quartz prism
  const body = new THREE.CylinderGeometry(radius * 0.94, radius, height, segments, 1, false);
  body.translate(0, height * 0.5, 0);

  const tip = new THREE.ConeGeometry(radius * 0.94, tipHeight, segments, 1, false);
  tip.translate(0, height + tipHeight * 0.5, 0);

  const parts = [body, tip];
  const merged = mergeCrystalParts(parts);
  applyCrystalGradient(merged, baseColor, deepColor, midColor, lightColor, tipColor, 0, height + tipHeight);
  return merged;
}

/**
 * Archetype 1: Natural Multi-Spire Amethyst Geode Cluster (Reference Picture & TARGET_07–08)
 * A natural grouping of 9 to 14 hexagonal crystal columns growing out of a faceted matrix rock shelf.
 */
export function createCrystalClusterGeometry(seed = 101): THREE.BufferGeometry {
  const rng = mulberry32(seed);
  const parts: THREE.BufferGeometry[] = [];

  // 1. Faceted host rock matrix base shelf
  const baseRock = new THREE.DodecahedronGeometry(1.5, 0);
  baseRock.scale(1.7, 0.42, 1.5);
  baseRock.translate(0, 0.16, 0);
  baseRock.computeVertexNormals();
  applyUniformColor(baseRock, COLOR_HOST_ROCK);
  parts.push(baseRock);

  // 2. Central dominant crystal spire (tallest point)
  const mainRadius = 0.38 + rng() * 0.10;
  const mainHeight = 2.4 + rng() * 0.7;
  const mainTip = 0.65 + rng() * 0.25;
  const mainSpire = createSingleSpire(mainRadius, mainHeight, mainTip);
  mainSpire.rotateX((rng() - 0.5) * 0.12);
  mainSpire.rotateZ((rng() - 0.5) * 0.12);
  mainSpire.translate((rng() - 0.5) * 0.2, 0.25, (rng() - 0.5) * 0.2);
  parts.push(mainSpire);

  // 3. Medium companion spires (7 to 10 spires radiating outward organically)
  const spireCount = 8 + Math.floor(rng() * 4);
  for (let i = 0; i < spireCount; i++) {
    const angle = (i / spireCount) * Math.PI * 2 + (rng() - 0.5) * 0.35;
    const dist = 0.45 + rng() * 0.55;
    const r = 0.18 + rng() * 0.14;
    const h = 1.1 + rng() * 1.2;
    const th = 0.35 + rng() * 0.3;

    // Lean outward away from center (10° to 26°)
    const leanAngle = 0.16 + rng() * 0.28;

    const spire = createSingleSpire(r, h, th);
    spire.rotateZ(leanAngle);
    spire.rotateY(angle);
    spire.translate(Math.cos(angle) * dist, 0.22, Math.sin(angle) * dist);
    parts.push(spire);
  }

  // 4. Druse micro-crystals clustered around the base
  const druseCount = 6 + Math.floor(rng() * 4);
  for (let d = 0; d < druseCount; d++) {
    const angle = (d / druseCount) * Math.PI * 2 + (rng() - 0.5) * 0.5;
    const dist = 0.85 + rng() * 0.45;
    const r = 0.08 + rng() * 0.07;
    const h = 0.45 + rng() * 0.45;
    const th = 0.18 + rng() * 0.15;

    const druse = createSingleSpire(r, h, th, COLOR_HOST_ROCK, COLOR_AMETHYST_DEEP, COLOR_AMETHYST_MID, COLOR_CRYSTAL_CYAN, COLOR_CRYSTAL_HOT);
    druse.rotateZ(0.3 + rng() * 0.25);
    druse.rotateY(angle);
    druse.translate(Math.cos(angle) * dist, 0.18, Math.sin(angle) * dist);
    parts.push(druse);
  }

  return mergeCrystalParts(parts);
}

/**
 * Archetype 2: Natural Cavern Rock Archway with Embedded Amethyst Veins
 * A grand natural stone arch framing the cavern walls and ceiling with generous central clearance (r > 4.4m).
 * Zero inward teeth — 100% open central flight corridor!
 */
export function createCrystallineGatewayGeometry(seed = 202): THREE.BufferGeometry {
  const rng = mulberry32(seed);
  const parts: THREE.BufferGeometry[] = [];
  const outerR = 5.8;
  const innerR = 4.4; // Wide central clearance: camera has 4.4m radius of empty space!
  const depth = 1.6;

  // 1. Natural faceted stone arch ring (vaulted upper arch and side pillars)
  const archRing = new THREE.TorusGeometry((outerR + innerR) * 0.5, (outerR - innerR) * 0.5, 8, 16, Math.PI);
  archRing.rotateZ(-Math.PI * 0.5); // Orient as an upright arch overhead
  archRing.computeVertexNormals();
  applyUniformColor(archRing, COLOR_HOST_ROCK);
  parts.push(archRing);

  // 2. Crystal geode outcroppings along the outer shoulders of the arch
  const shoulderAngles = [-0.75, -0.45, 0.45, 0.75];
  for (const ang of shoulderAngles) {
    const clusterH = 1.2 + rng() * 0.8;
    const clusterR = 0.28 + rng() * 0.12;

    const crystal = createSingleSpire(clusterR, clusterH, clusterH * 0.45);
    // Point outward along arch contour
    crystal.rotateZ(ang);
    crystal.translate(Math.sin(ang) * (outerR - 0.2), Math.cos(ang) * (outerR - 0.2), (rng() - 0.5) * depth * 0.3);
    parts.push(crystal);
  }

  // 3. Faceted rock buttresses anchoring the base of the arch
  const leftBase = new THREE.DodecahedronGeometry(1.2, 0);
  leftBase.scale(1.3, 2.2, 1.4);
  leftBase.translate(-innerR - 0.5, -1.8, 0);
  leftBase.computeVertexNormals();
  applyUniformColor(leftBase, COLOR_HOST_ROCK);
  parts.push(leftBase);

  const rightBase = new THREE.DodecahedronGeometry(1.2, 0);
  rightBase.scale(1.3, 2.2, 1.4);
  rightBase.translate(innerR + 0.5, -1.8, 0);
  rightBase.computeVertexNormals();
  applyUniformColor(rightBase, COLOR_HOST_ROCK);
  parts.push(rightBase);

  return mergeCrystalParts(parts);
}

/**
 * Archetype 3: Luminous Hexagonal Gemstone Prisms
 * Refined, organic crystal prisms with soft bevels (not spiky diamond octahedra).
 */
export function createPrismaticShardGeometry(seed = 303): THREE.BufferGeometry {
  const rng = mulberry32(seed);

  // Hexagonal bipyramidal gem with bevelled facet symmetry
  const radius = 0.35 + rng() * 0.15;
  const height = 0.9 + rng() * 0.5;
  const tipH = 0.4 + rng() * 0.2;

  const body = new THREE.CylinderGeometry(radius * 0.92, radius, height, 6, 1, false);
  const topTip = new THREE.ConeGeometry(radius * 0.92, tipH, 6, 1, false);
  topTip.translate(0, height * 0.5 + tipH * 0.5, 0);

  const botTip = new THREE.ConeGeometry(radius, tipH * 0.8, 6, 1, false);
  botTip.rotateX(Math.PI);
  botTip.translate(0, -height * 0.5 - tipH * 0.4, 0);

  const parts = [body, topTip, botTip];
  const merged = mergeCrystalParts(parts);

  applyCrystalGradient(
    merged,
    COLOR_AMETHYST_DEEP,
    COLOR_AMETHYST_MID,
    COLOR_AMETHYST_LILAC,
    COLOR_CRYSTAL_CYAN,
    COLOR_CRYSTAL_HOT,
    -height,
    height,
  );

  return merged;
}

/**
 * Archetype 4: Ceiling Quartz Stalactite Needle Cluster
 * Slender hanging crystal needles growing downward from cavern roof (Reference Picture).
 */
export function createCrystalStalactiteGeometry(seed = 404): THREE.BufferGeometry {
  const rng = mulberry32(seed);
  const parts: THREE.BufferGeometry[] = [];

  // 1. Matrix rock mount plate on the ceiling
  const basePlate = new THREE.DodecahedronGeometry(0.85, 0);
  basePlate.scale(1.4, 0.35, 1.4);
  basePlate.computeVertexNormals();
  applyUniformColor(basePlate, COLOR_HOST_ROCK);
  parts.push(basePlate);

  // 2. Central hanging quartz needle pointing downward
  const centralSpire = createSingleSpire(0.24, 2.2, 0.75);
  centralSpire.rotateX(Math.PI); // Point down
  centralSpire.translate(0, -0.15, 0);
  parts.push(centralSpire);

  // 3. 4 to 6 Shorter companion needles radiating downward
  const companions = 4 + Math.floor(rng() * 3);
  for (let c = 0; c < companions; c++) {
    const angle = (c / companions) * Math.PI * 2 + (rng() - 0.5) * 0.4;
    const r = 0.12 + rng() * 0.08;
    const h = 0.9 + rng() * 1.0;
    const th = 0.3 + rng() * 0.25;
    const dist = 0.26 + rng() * 0.24;

    const needle = createSingleSpire(r, h, th);
    needle.rotateX(Math.PI);
    needle.rotateZ((rng() - 0.5) * 0.16);
    needle.translate(Math.cos(angle) * dist, -0.12, Math.sin(angle) * dist);
    parts.push(needle);
  }

  return mergeCrystalParts(parts);
}
