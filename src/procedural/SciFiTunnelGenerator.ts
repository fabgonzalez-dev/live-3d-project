/**
 * procedural/SciFiTunnelGenerator.ts
 * Procedural generation of modular sci-fi architectural tunnel components (TARGET_05–06):
 * - Major Architectural Conduit Rings with heavy mechanical clamp collars and conduit pipes.
 * - Concentric Inner Rotating Aperture Rings with polygonal shutter teeth.
 * - Multi-Rail Cybernetic Highway Track with illuminated guide rails and crossbars.
 * - Floating Hexagonal Structural Tech Panels and conduit fragments.
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

// Color constants for vertex painting
const METAL_OBSIDIAN = new THREE.Color(0x0a0e17);  // Deep dark obsidian metal
const METAL_TITANIUM = new THREE.Color(0x1e293b);  // Brushed titanium collar
const NEON_CYAN      = new THREE.Color(0x00f0ff);  // Electric cyber cyan
const NEON_MAGENTA   = new THREE.Color(0xf43f5e);  // Radiant hot magenta
const NEON_AMBER     = new THREE.Color(0xf59e0b);  // Warm amber marker
const NEON_WHITE     = new THREE.Color(0xffffff);  // White-hot core

/** Normalizes and safely merges buffer geometries with matching non-indexed attributes */
function mergeSciFiParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
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

/** Applies vertex colors to geometry */
function applyVertexColor(geo: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
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
 * Archetype 1: Major Architectural Conduit Ring (~6.8m outer radius, ~1.4m depth)
 * Heavy structural ring featuring:
 * - Cylindrical main body with inner beveled lip
 * - 6 Heavy mechanical clamp collars around circumference
 * - 2 High-voltage conduit pipes encircling the outer perimeter
 * - Embedded neon strip channels (cyan & magenta)
 */
export function createArchitecturalConduitRingGeometry(seed = 505): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const outerR = 6.8;
  const innerR = 5.6;
  const depth = 1.35;
  const segments = 36;

  // 1. Main outer ring hull
  const hull = new THREE.CylinderGeometry(outerR, outerR, depth, segments, 1, true);
  hull.rotateX(Math.PI / 2);
  hull.computeVertexNormals();
  applyVertexColor(hull, METAL_OBSIDIAN);
  parts.push(hull);

  // Inner tunnel lip
  const innerLip = new THREE.CylinderGeometry(innerR, innerR, depth, segments, 1, true);
  innerLip.rotateX(Math.PI / 2);
  innerLip.computeVertexNormals();
  applyVertexColor(innerLip, METAL_OBSIDIAN);
  parts.push(innerLip);

  // Front face ring with beveled rim
  const frontRing = new THREE.RingGeometry(innerR, outerR, segments, 2);
  frontRing.translate(0, 0, depth * 0.5);
  frontRing.computeVertexNormals();
  applyVertexColor(frontRing, METAL_TITANIUM);
  parts.push(frontRing);

  // Back face ring
  const backRing = new THREE.RingGeometry(innerR, outerR, segments, 2);
  backRing.rotateY(Math.PI);
  backRing.translate(0, 0, -depth * 0.5);
  backRing.computeVertexNormals();
  applyVertexColor(backRing, METAL_TITANIUM);
  parts.push(backRing);

  // 2. Six Heavy Mechanical Clamp Collars spaced at 60°
  const collarCount = 6;
  for (let c = 0; c < collarCount; c++) {
    const angle = (c / collarCount) * Math.PI * 2;
    const collar = new THREE.BoxGeometry(0.75, 1.6, depth * 1.15);
    collar.translate(0, (innerR + outerR) * 0.5, 0);
    collar.rotateZ(angle);
    collar.computeVertexNormals();
    applyVertexColor(collar, METAL_TITANIUM);
    parts.push(collar);

    // Neon accent indicator on collar face
    const neonTab = new THREE.BoxGeometry(0.45, 0.25, 0.08);
    neonTab.translate(0, outerR - 0.25, depth * 0.58);
    neonTab.rotateZ(angle);
    neonTab.computeVertexNormals();
    applyVertexColor(neonTab, c % 2 === 0 ? NEON_CYAN : NEON_MAGENTA);
    parts.push(neonTab);
  }

  // 3. Dual High-Voltage Conduit Pipes on outer perimeter
  for (const zOff of [-depth * 0.35, depth * 0.35]) {
    const pipe = new THREE.TorusGeometry(outerR + 0.18, 0.12, 6, segments);
    pipe.translate(0, 0, zOff);
    pipe.computeVertexNormals();
    applyVertexColor(pipe, METAL_TITANIUM);
    parts.push(pipe);
  }

  // 4. Embedded Neon Inner Guide Strip Rings
  for (const zOff of [-depth * 0.45, depth * 0.45]) {
    const neonRing = new THREE.TorusGeometry(innerR + 0.06, 0.05, 5, segments);
    neonRing.translate(0, 0, zOff);
    neonRing.computeVertexNormals();
    applyVertexColor(neonRing, zOff > 0 ? NEON_CYAN : NEON_MAGENTA);
    parts.push(neonRing);
  }

  return mergeSciFiParts(parts);
}

/**
 * Archetype 2: Concentric Inner Rotating Aperture Ring (~5.4m outer radius)
 * Secondary mechanical ring with 8 polygonal shutter teeth/ribs that counter-rotate.
 */
export function createRotatingApertureRingGeometry(seed = 606): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const outerR = 5.4;
  const innerR = 4.4;
  const depth = 0.55;
  const segments = 24;

  // Thin structural carrier ring
  const carrier = new THREE.CylinderGeometry(outerR, outerR, depth, segments, 1, true);
  carrier.rotateX(Math.PI / 2);
  carrier.computeVertexNormals();
  applyVertexColor(carrier, METAL_OBSIDIAN);
  parts.push(carrier);

  // 8 Interlocking Polygonal Shutter Teeth
  const toothCount = 8;
  for (let i = 0; i < toothCount; i++) {
    const angle = (i / toothCount) * Math.PI * 2;
    // Angled trapezoidal tooth pointing inward
    const tooth = new THREE.BoxGeometry(0.85, 1.2, depth * 0.9);
    tooth.translate(0, (innerR + outerR) * 0.5 - 0.2, 0);
    tooth.rotateZ(angle + 0.12);
    tooth.computeVertexNormals();
    applyVertexColor(tooth, METAL_TITANIUM);
    parts.push(tooth);

    // Neon edge highlight on tooth tip
    const neonFin = new THREE.BoxGeometry(0.55, 0.15, depth * 0.95);
    neonFin.translate(0, innerR + 0.1, 0);
    neonFin.rotateZ(angle + 0.12);
    neonFin.computeVertexNormals();
    applyVertexColor(neonFin, NEON_CYAN);
    parts.push(neonFin);
  }

  return mergeSciFiParts(parts);
}

/**
 * Archetype 3: Multi-Rail Cybernetic Highway Track Segment (TARGET_05–06)
 * Continuous digital pathway floor (width ~3.6m, length ~2.4m):
 * - Center glowing primary power conduit rail
 * - Dual lateral neon boundary guide rails
 * - Segmented crossbars with neon stepping pads
 */
export function createCyberTrackSegmentGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const width = 3.6;
  const length = 2.4;
  const height = 0.16;

  // 1. Dark obsidian track foundation bed
  const bed = new THREE.BoxGeometry(width, height, length);
  bed.translate(0, -height * 0.5, 0);
  bed.computeVertexNormals();
  applyVertexColor(bed, METAL_OBSIDIAN);
  parts.push(bed);

  // 2. Central Primary Glowing Rail (sleek high-voltage conduit)
  const centerRail = new THREE.BoxGeometry(0.28, 0.08, length * 1.02);
  centerRail.translate(0, height * 0.5 + 0.02, 0);
  centerRail.computeVertexNormals();
  applyVertexColor(centerRail, NEON_CYAN);
  parts.push(centerRail);

  // 3. Dual Lateral Neon Boundary Rails
  for (const side of [-1, 1]) {
    const railX = side * (width * 0.5 - 0.18);
    const sideRail = new THREE.BoxGeometry(0.24, 0.10, length * 1.02);
    sideRail.translate(railX, height * 0.5 + 0.03, 0);
    sideRail.computeVertexNormals();
    applyVertexColor(sideRail, side < 0 ? NEON_CYAN : NEON_MAGENTA);
    parts.push(sideRail);
  }

  // 4. Three Illuminated Crossbars
  for (const zOffset of [-length * 0.33, 0, length * 0.33]) {
    const bar = new THREE.BoxGeometry(width * 0.88, 0.04, 0.22);
    bar.translate(0, height * 0.5 + 0.01, zOffset);
    bar.computeVertexNormals();
    applyVertexColor(bar, NEON_CYAN);
    parts.push(bar);
  }

  return mergeSciFiParts(parts);
}

/**
 * Archetype 4: Floating Hexagonal Structural Tech Panels
 * Floating zero-g modular panels orbiting along the corridor periphery.
 */
export function createFloatingTechPanelGeometry(seed = 707): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const rng = mulberry32(seed);

  // Hexagonal structural plate
  const hexPlate = new THREE.CylinderGeometry(0.95, 0.95, 0.14, 6);
  hexPlate.rotateX(Math.PI / 2);
  hexPlate.computeVertexNormals();
  applyVertexColor(hexPlate, METAL_TITANIUM);
  parts.push(hexPlate);

  // Embedded central sensor lens
  const lens = new THREE.SphereGeometry(0.35, 8, 6);
  lens.scale(1.0, 1.0, 0.5);
  lens.translate(0, 0, 0.08);
  lens.computeVertexNormals();
  applyVertexColor(lens, rng() > 0.5 ? NEON_CYAN : NEON_AMBER);
  parts.push(lens);

  // Secondary mechanical bracket
  const bracket = new THREE.BoxGeometry(0.4, 1.6, 0.18);
  bracket.rotateZ(0.35);
  bracket.computeVertexNormals();
  applyVertexColor(bracket, METAL_OBSIDIAN);
  parts.push(bracket);

  return mergeSciFiParts(parts);
}
