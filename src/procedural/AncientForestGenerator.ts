/**
 * procedural/AncientForestGenerator.ts
 * Procedural generation of ancient fantasy forest assets matching TARGET_01–02_forest.png:
 * - Carved Stone Rune Portal Megalith Archways with rune grooves, top keystone gem,
 *   and power orb sockets.
 * - Ancient Grandfather Trees with massive flared buttress roots, twisting trunks,
 *   and tiered organic foliage clouds.
 * - Elder Twisted Trees with asymmetric branch spread.
 * - Tall forest canopy pillar trees forming dense backdrops.
 * - Moss-covered faceted boulders and ancient stone pathway steps.
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

// Color palettes for vertex painting
const BARK_SHADOW  = new THREE.Color(0x1a120c);   // Deep dark bark crevice
const BARK_MID     = new THREE.Color(0x2e1f14);   // Weathered ancient bark
const BARK_MOSS    = new THREE.Color(0x3f4f1d);   // Moss growing on trunk
const FOLIAGE_DEEP = new THREE.Color(0x281238);   // Mystical deep plum / indigo
const FOLIAGE_MID  = new THREE.Color(0x5b236e);   // Rich purple canopy
const FOLIAGE_TIP  = new THREE.Color(0x9d4edd);   // Radiant lavender / magenta tips
const STONE_BASE   = new THREE.Color(0x2d2238);   // Ancient carved purple-grey stone
const STONE_MOSS   = new THREE.Color(0x425b24);   // Lush moss over stone
const STONE_RUNE   = new THREE.Color(0xc084fc);   // Glowing rune groove highlight

/** Applies vertex colors based on height, normal, and component type */
function applyForestVertexColors(
  geo: THREE.BufferGeometry,
  type: 'bark' | 'foliage' | 'stone' | 'moss',
  seed = 42,
): THREE.BufferGeometry {
  const pos = geo.attributes['position'] as THREE.BufferAttribute;
  const norm = geo.attributes['normal'] as THREE.BufferAttribute;
  const count = pos.count;
  const colors = new Float32Array(count * 3);
  const rng = mulberry32(seed);

  for (let i = 0; i < count; i++) {
    const ny = norm ? norm.getY(i) : 0;
    const y = pos.getY(i);

    let c = new THREE.Color();
    if (type === 'bark') {
      const mossBlend = Math.max(0, Math.min(1, (1.8 - y) * 0.45 + (rng() - 0.5) * 0.2));
      const bark = BARK_SHADOW.clone().lerp(BARK_MID, 0.4 + rng() * 0.5);
      c = bark.lerp(BARK_MOSS, mossBlend);
    } else if (type === 'foliage') {
      const topT = Math.max(0, Math.min(1, ny * 0.7 + rng() * 0.3));
      c = FOLIAGE_DEEP.clone().lerp(FOLIAGE_MID, 0.5 + (rng() - 0.5) * 0.3);
      c.lerp(FOLIAGE_TIP, topT * 0.85);
    } else if (type === 'stone') {
      const mossCover = Math.max(0, Math.min(1, (ny - 0.2) * 1.4 + (rng() - 0.5) * 0.25));
      c = STONE_BASE.clone().lerp(STONE_MOSS, mossCover);
    } else {
      c = STONE_MOSS.clone().lerp(new THREE.Color(0x557a2b), rng() * 0.5);
    }

    colors[i * 3 + 0] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/** Merges geometries safely by normalizing all to non-indexed and matching attributes */
function mergeForestParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const normalized: THREE.BufferGeometry[] = [];
  for (const p of parts) {
    const nonIndexed = p.index ? p.toNonIndexed() : p.clone();
    if (!nonIndexed.attributes['normal']) nonIndexed.computeVertexNormals();
    if (!nonIndexed.attributes['color']) {
      const colors = new Float32Array(nonIndexed.attributes['position']!.count * 3);
      colors.fill(0.6);
      nonIndexed.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    // Remove optional UVs to avoid attribute count/type mismatch during merge
    if (nonIndexed.attributes['uv']) nonIndexed.deleteAttribute('uv');
    if (nonIndexed.attributes['uv1']) nonIndexed.deleteAttribute('uv1');

    normalized.push(nonIndexed);
    p.dispose();
  }

  const merged = BufferGeometryUtils.mergeGeometries(normalized, false);
  for (const n of normalized) n.dispose();
  return merged ?? new THREE.BufferGeometry();
}

/**
 * Creates the ornate ancient carved stone rune portal archway (TARGET_01–02).
 */
export function createCarvedRunePortalGeometry(seed = 505): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const rng = mulberry32(seed);

  const outerR = 4.2;
  const innerR = 3.0;
  const depth = 0.95;
  const segments = 32;

  // 1. Segmented Megalith Stone Arch Ring
  const archGeo = new THREE.CylinderGeometry(outerR, outerR, depth, segments, 1, true);
  archGeo.rotateX(Math.PI / 2);
  archGeo.computeVertexNormals();
  applyForestVertexColors(archGeo, 'stone', seed);
  parts.push(archGeo);

  // Inner tunnel rim
  const innerArch = new THREE.CylinderGeometry(innerR, innerR, depth, segments, 1, true);
  innerArch.rotateX(Math.PI / 2);
  innerArch.computeVertexNormals();
  applyForestVertexColors(innerArch, 'stone', seed + 1);
  parts.push(innerArch);

  // Front face beveled ring
  const frontRing = new THREE.RingGeometry(innerR, outerR, segments, 2);
  frontRing.translate(0, 0, depth * 0.5);
  frontRing.computeVertexNormals();
  applyForestVertexColors(frontRing, 'stone', seed + 2);
  parts.push(frontRing);

  // Back face beveled ring
  const backRing = new THREE.RingGeometry(innerR, outerR, segments, 2);
  backRing.rotateY(Math.PI);
  backRing.translate(0, 0, -depth * 0.5);
  backRing.computeVertexNormals();
  applyForestVertexColors(backRing, 'stone', seed + 3);
  parts.push(backRing);

  // 2. Ornate Top Keystone / Diamond Gem Crest
  const gemGeo = new THREE.OctahedronGeometry(0.55, 0);
  gemGeo.scale(0.8, 1.4, 0.7);
  gemGeo.translate(0, outerR + 0.35, depth * 0.45);
  gemGeo.computeVertexNormals();
  const gemColors = new Float32Array(gemGeo.attributes['position']!.count * 3);
  for (let i = 0; i < gemColors.length; i += 3) {
    gemColors[i + 0] = STONE_RUNE.r;
    gemColors[i + 1] = STONE_RUNE.g;
    gemColors[i + 2] = STONE_RUNE.b;
  }
  gemGeo.setAttribute('color', new THREE.BufferAttribute(gemColors, 3));
  parts.push(gemGeo);

  // Keystone stone housing mount
  const mountGeo = new THREE.BoxGeometry(1.4, 0.9, depth * 1.15);
  mountGeo.translate(0, outerR + 0.15, 0);
  mountGeo.computeVertexNormals();
  applyForestVertexColors(mountGeo, 'stone', seed + 4);
  parts.push(mountGeo);

  // 3. Dual Left and Right Energy Orb Socket Pedestals
  const angle = Math.PI * 0.18;
  const socketRadius = (innerR + outerR) * 0.5;

  for (const side of [-1, 1]) {
    const sx = Math.cos(angle) * socketRadius * side;
    const sy = Math.sin(angle) * socketRadius;

    // Stone socket ring
    const socketHousing = new THREE.TorusGeometry(0.65, 0.22, 7, 14);
    socketHousing.translate(sx, sy, depth * 0.48);
    socketHousing.computeVertexNormals();
    applyForestVertexColors(socketHousing, 'stone', seed + 5 + side);
    parts.push(socketHousing);

    // Glowing Power Orb Sphere
    const orb = new THREE.SphereGeometry(0.42, 10, 8);
    orb.translate(sx, sy, depth * 0.52);
    const orbColors = new Float32Array(orb.attributes['position']!.count * 3);
    for (let k = 0; k < orbColors.length; k += 3) {
      orbColors[k + 0] = 0.85; // Brilliant magenta/amethyst
      orbColors[k + 1] = 0.35;
      orbColors[k + 2] = 1.00;
    }
    orb.setAttribute('color', new THREE.BufferAttribute(orbColors, 3));
    parts.push(orb);
  }

  // 4. Moss clumps over the top arch curvature
  for (let m = 0; m < 8; m++) {
    const ma = Math.PI * 0.5 + (m - 3.5) * 0.16 + (rng() - 0.5) * 0.08;
    const mx = Math.cos(ma) * (outerR + 0.15);
    const my = Math.sin(ma) * (outerR + 0.15);
    const mossBlob = new THREE.DodecahedronGeometry(0.45 + rng() * 0.25, 1);
    mossBlob.scale(1.2, 0.6, 1.4);
    mossBlob.translate(mx, my, (rng() - 0.5) * 0.3);
    mossBlob.computeVertexNormals();
    applyForestVertexColors(mossBlob, 'moss', seed + 20 + m);
    parts.push(mossBlob);
  }

  // 5. Base Megalith Foundation Plinths
  for (const side of [-1, 1]) {
    const basePillar = new THREE.BoxGeometry(1.6, 2.2, depth * 1.35);
    basePillar.translate(side * (innerR + 0.7), 0.5, 0);
    basePillar.computeVertexNormals();
    applyForestVertexColors(basePillar, 'stone', seed + 30 + side);
    parts.push(basePillar);
  }

  return mergeForestParts(parts);
}

/**
 * Ancient Grandfather Tree (~14m tall)
 */
export function createAncientGrandfatherTreeGeometry(seed = 101): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const rng = mulberry32(seed);

  // 1. Massive flared base trunk
  const trunkBase = new THREE.CylinderGeometry(0.75, 1.65, 3.2, 8);
  trunkBase.translate(0, 1.6, 0);
  trunkBase.computeVertexNormals();
  applyForestVertexColors(trunkBase, 'bark', seed);
  parts.push(trunkBase);

  // 4 Organic Buttress Roots spreading outward
  for (let r = 0; r < 4; r++) {
    const ra = (r / 4) * Math.PI * 2 + (rng() - 0.5) * 0.3;
    const root = new THREE.ConeGeometry(0.55, 3.0, 6);
    root.rotateZ(Math.PI * 0.42);
    root.rotateY(ra);
    root.translate(Math.cos(ra) * 1.8, 0.3, Math.sin(ra) * 1.8);
    root.computeVertexNormals();
    applyForestVertexColors(root, 'bark', seed + 10 + r);
    parts.push(root);
  }

  // 2. Middle trunk with twisting lean
  const trunkMid = new THREE.CylinderGeometry(0.55, 0.75, 4.2, 7);
  trunkMid.rotateZ(0.08);
  trunkMid.translate(0.2, 4.8, 0);
  trunkMid.computeVertexNormals();
  applyForestVertexColors(trunkMid, 'bark', seed + 1);
  parts.push(trunkMid);

  // 3. Upper trunk branching out
  const trunkUpper = new THREE.CylinderGeometry(0.38, 0.55, 3.8, 6);
  trunkUpper.rotateZ(-0.06);
  trunkUpper.translate(0.05, 8.2, 0);
  trunkUpper.computeVertexNormals();
  applyForestVertexColors(trunkUpper, 'bark', seed + 2);
  parts.push(trunkUpper);

  // 4. Large spreading organic limb boughs
  const branchAngles = [0.4, 1.8, 3.3, 4.9];
  for (let b = 0; b < branchAngles.length; b++) {
    const ba = branchAngles[b]! + (rng() - 0.5) * 0.4;
    const limb = new THREE.CylinderGeometry(0.18, 0.32, 3.6, 5);
    limb.rotateZ(0.65);
    limb.rotateY(ba);
    limb.translate(Math.cos(ba) * 1.4, 9.2 + b * 0.7, Math.sin(ba) * 1.4);
    limb.computeVertexNormals();
    applyForestVertexColors(limb, 'bark', seed + 20 + b);
    parts.push(limb);

    // Dense organic foliage cloud at end of limb
    const cloud = new THREE.DodecahedronGeometry(2.1 + rng() * 0.8, 1);
    cloud.scale(1.4, 0.8, 1.3);
    cloud.translate(Math.cos(ba) * 3.2, 10.4 + b * 0.9, Math.sin(ba) * 3.2);
    cloud.computeVertexNormals();
    applyForestVertexColors(cloud, 'foliage', seed + 30 + b);
    parts.push(cloud);
  }

  // 5. Crown foliage canopy
  const crownCloud1 = new THREE.DodecahedronGeometry(2.8, 1);
  crownCloud1.scale(1.5, 0.9, 1.4);
  crownCloud1.translate(0.1, 12.8, 0);
  crownCloud1.computeVertexNormals();
  applyForestVertexColors(crownCloud1, 'foliage', seed + 40);
  parts.push(crownCloud1);

  const crownCloud2 = new THREE.DodecahedronGeometry(2.0, 1);
  crownCloud2.scale(1.2, 0.8, 1.1);
  crownCloud2.translate(-0.8, 14.2, 0.4);
  crownCloud2.computeVertexNormals();
  applyForestVertexColors(crownCloud2, 'foliage', seed + 41);
  parts.push(crownCloud2);

  return mergeForestParts(parts);
}

/**
 * Elder Twisted Tree (~10m tall)
 */
export function createElderTwistedTreeGeometry(seed = 202): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Twisted segmented trunk
  const seg1 = new THREE.CylinderGeometry(0.55, 0.95, 2.8, 7);
  seg1.rotateZ(0.14);
  seg1.translate(0.2, 1.4, 0);
  seg1.computeVertexNormals();
  applyForestVertexColors(seg1, 'bark', seed);
  parts.push(seg1);

  const seg2 = new THREE.CylinderGeometry(0.38, 0.55, 3.4, 6);
  seg2.rotateZ(-0.16);
  seg2.translate(-0.15, 4.0, 0);
  seg2.computeVertexNormals();
  applyForestVertexColors(seg2, 'bark', seed + 1);
  parts.push(seg2);

  const seg3 = new THREE.CylinderGeometry(0.22, 0.38, 3.0, 5);
  seg3.rotateZ(0.12);
  seg3.translate(0.35, 6.8, 0);
  seg3.computeVertexNormals();
  applyForestVertexColors(seg3, 'bark', seed + 2);
  parts.push(seg3);

  // Spreading foliage tiers
  const cloud1 = new THREE.DodecahedronGeometry(2.2, 1);
  cloud1.scale(1.5, 0.7, 1.3);
  cloud1.translate(-1.4, 5.6, 0.2);
  cloud1.computeVertexNormals();
  applyForestVertexColors(cloud1, 'foliage', seed + 10);
  parts.push(cloud1);

  const cloud2 = new THREE.DodecahedronGeometry(2.5, 1);
  cloud2.scale(1.6, 0.8, 1.4);
  cloud2.translate(1.2, 7.8, -0.3);
  cloud2.computeVertexNormals();
  applyForestVertexColors(cloud2, 'foliage', seed + 11);
  parts.push(cloud2);

  const cloud3 = new THREE.DodecahedronGeometry(2.0, 1);
  cloud3.scale(1.3, 0.75, 1.2);
  cloud3.translate(0.1, 9.6, 0.2);
  cloud3.computeVertexNormals();
  applyForestVertexColors(cloud3, 'foliage', seed + 12);
  parts.push(cloud3);

  return mergeForestParts(parts);
}

/**
 * Slender Forest Canopy Pillar (~13m tall)
 */
export function createCanopyPillarTreeGeometry(seed = 303): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const rng = mulberry32(seed);

  const trunk = new THREE.CylinderGeometry(0.28, 0.65, 9.5, 6);
  trunk.translate(0, 4.75, 0);
  trunk.computeVertexNormals();
  applyForestVertexColors(trunk, 'bark', seed);
  parts.push(trunk);

  // High canopy foliage cluster
  const canopy1 = new THREE.DodecahedronGeometry(2.2 + rng() * 0.6, 1);
  canopy1.scale(1.3, 1.1, 1.3);
  canopy1.translate(0, 9.8, 0);
  canopy1.computeVertexNormals();
  applyForestVertexColors(canopy1, 'foliage', seed + 1);
  parts.push(canopy1);

  const canopy2 = new THREE.DodecahedronGeometry(1.7 + rng() * 0.4, 1);
  canopy2.scale(1.1, 1.0, 1.1);
  canopy2.translate(0, 12.0, 0);
  canopy2.computeVertexNormals();
  applyForestVertexColors(canopy2, 'foliage', seed + 2);
  parts.push(canopy2);

  return mergeForestParts(parts);
}

/**
 * Moss-covered Ancient Boulders
 */
export function createMossyBoulderGeometry(seed = 404): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const rng = mulberry32(seed);

  const boulder1 = new THREE.DodecahedronGeometry(0.85 + rng() * 0.45, 1);
  boulder1.scale(1.3, 0.75, 1.1);
  boulder1.translate(0, 0.45, 0);
  boulder1.computeVertexNormals();
  applyForestVertexColors(boulder1, 'stone', seed);
  parts.push(boulder1);

  const boulder2 = new THREE.DodecahedronGeometry(0.55 + rng() * 0.35, 1);
  boulder2.scale(1.1, 0.65, 0.9);
  boulder2.translate(0.7, 0.3, 0.4);
  boulder2.computeVertexNormals();
  applyForestVertexColors(boulder2, 'stone', seed + 1);
  parts.push(boulder2);

  return mergeForestParts(parts);
}

/**
 * Ancient Pathway Stone Steps & Flagstones
 */
export function createAncientStoneStepGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  const step = new THREE.BoxGeometry(4.6, 0.22, 1.4);
  step.translate(0, 0.11, 0);
  step.computeVertexNormals();
  applyForestVertexColors(step, 'stone', 606);
  parts.push(step);

  for (const s of [-1, 1]) {
    const curb = new THREE.DodecahedronGeometry(0.42, 1);
    curb.scale(1.2, 0.5, 1.4);
    curb.translate(s * 2.5, 0.16, 0);
    curb.computeVertexNormals();
    applyForestVertexColors(curb, 'moss', 607 + s);
    parts.push(curb);
  }

  return mergeForestParts(parts);
}
