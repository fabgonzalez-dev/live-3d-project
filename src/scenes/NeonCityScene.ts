/**
 * scenes/NeonCityScene.ts
 * Hyperdimensional Sci-Fi Architectural Tunnel (TARGET_05–06 / improvements.md §8).
 *
 * Implements:
 * - Reusable modular architectural grammar: major conduit rings, rotating aperture rings,
 *   continuous multi-rail cybernetic highway track, floating zero-g hexagonal tech panels
 * - Hierarchical geometry: primary structural rings, secondary aperture & highway track,
 *   tertiary server monoliths and floating sensor plates
 * - Three-tier animation hierarchy:
 *     * Slow: longitudinal chamber expansion/breathing & corridor translation
 *     * Medium: counter-rotating aperture shutter teeth and pulse-lit cyber track
 *     * Fast: warm amber bokeh embers, data sparks, and subtle audio modulation
 * - Controlled advanced illumination: deep negative obsidian contrast, brushed titanium glints,
 *   cyan/magenta rail highlights, and warm amber point marker accents (avoiding uniform purple wash)
 * - Zero per-frame memory allocation: pre-allocated dummy Object3D, Color, and typed arrays
 */

import * as THREE from 'three';
import type { SceneLifecycle } from './SceneLifecycle';
import type { VisualParams, PaletteDefinition } from '../state/types';
import type { AudioBands } from '../audio/AudioAnalyser';
import { DEFAULT_VISUAL } from '../state/types';
import { PALETTES } from '../state/palettes';

import cityVert from '../shaders/cityVertex.glsl?raw';
import cityFrag from '../shaders/cityFragment.glsl?raw';
import particleVert from '../shaders/particleVertex.glsl?raw';
import particleFrag from '../shaders/particleFragment.glsl?raw';

import {
  createArchitecturalConduitRingGeometry,
  createRotatingApertureRingGeometry,
  createCyberTrackSegmentGeometry,
  createFloatingTechPanelGeometry,
} from '../procedural/SciFiTunnelGenerator';

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lerpVec3(a: [number, number, number], b: [number, number, number], t: number): THREE.Vector3 {
  return new THREE.Vector3(
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  );
}

/** Generates high-contrast cyberpunk server bank / skyscraper facade texture */
function createSkyscraperTexture(): THREE.Texture {
  if (typeof document === 'undefined') {
    return new THREE.Texture();
  }
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  // Dark obsidian/metallic building facade
  ctx.fillStyle = '#05070f';
  ctx.fillRect(0, 0, 512, 512);

  // Procedural neon office windows / server rack grid
  const cols = 16;
  const rows = 32;
  const padX = 6;
  const padY = 4;
  const cellW = (512 - padX * (cols + 1)) / cols;
  const cellH = (512 - padY * (rows + 1)) / rows;

  const rng = mulberry32(777);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rng() > 0.35) {
        const x = padX + c * (cellW + padX);
        const y = padY + r * (cellH + padY);

        const type = rng();
        if (type > 0.88) {
          ctx.fillStyle = '#ffffff'; // White-hot core
        } else if (type > 0.60) {
          ctx.fillStyle = '#00f0ff'; // Electric cyber cyan
        } else if (type > 0.30) {
          ctx.fillStyle = '#f43f5e'; // Hot magenta
        } else {
          ctx.fillStyle = '#f59e0b'; // Warm amber
        }
        ctx.fillRect(x, y, cellW, cellH);
      }
    }
  }

  // Vertical cyber-conduit borders
  ctx.fillStyle = '#00f0ff';
  ctx.fillRect(0, 0, 3, 512);
  ctx.fillRect(509, 0, 3, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = true;
  return texture;
}

const MAJOR_RING_COUNT = 24;       // Spaced every 6m (total span 144m)
const APERTURE_RING_COUNT = 24;    // Interspersed with major rings, counter-rotating
const TRACK_SEGMENT_COUNT = 60;    // Continuous highway floor (2.4m * 60 = 144m)
const TECH_PANEL_COUNT = 48;       // Zero-g floating hexagonal panels
const MONOLITH_COUNT = 96;         // Peripheral server towers
const STREAK_COUNT = 100;          // Subtle starlight streaks

export class NeonCityScene implements SceneLifecycle {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  // Background cylinder hull & particle field
  private cityMesh!: THREE.Mesh;
  private cityMaterial!: THREE.ShaderMaterial;
  private particleSystem!: THREE.Points;
  private particleMaterial!: THREE.ShaderMaterial;

  // Primary Architecture: Major Conduit Rings
  private majorRingsMesh!: THREE.InstancedMesh;
  private majorRingsMaterial!: THREE.MeshStandardMaterial;

  // Secondary Architecture: Counter-Rotating Aperture Rings
  private apertureRingsMesh!: THREE.InstancedMesh;
  private apertureRingsMaterial!: THREE.MeshStandardMaterial;

  // Secondary Architecture: Multi-Rail Cyber Highway Track
  private trackMesh!: THREE.InstancedMesh;
  private trackMaterial!: THREE.MeshStandardMaterial;

  // Tertiary Architecture: Floating Hexagonal Tech Panels
  private techPanelsMesh!: THREE.InstancedMesh;
  private techPanelsMaterial!: THREE.MeshStandardMaterial;

  // Peripheral Server Monoliths
  private monolithMesh!: THREE.InstancedMesh;
  private monolithTexture!: THREE.Texture;
  private monolithMaterial!: THREE.MeshStandardMaterial;

  // Starlight streaks
  private streaksMesh!: THREE.InstancedMesh;
  private streaksMaterial!: THREE.MeshBasicMaterial;

  // Lights
  private ambientLight!: THREE.AmbientLight;
  private dirLight!: THREE.DirectionalLight;
  private cameraLight!: THREE.PointLight;

  // Pre-allocated object for zero-garbage matrix updates
  private readonly dummy = new THREE.Object3D();
  private readonly tempColor = new THREE.Color();

  // Motion arrays (TypedArrays)
  private majorRingZ = new Float32Array(MAJOR_RING_COUNT);

  private apertureRingZ = new Float32Array(APERTURE_RING_COUNT);
  private apertureSpinDir = new Float32Array(APERTURE_RING_COUNT);

  private trackSegmentZ = new Float32Array(TRACK_SEGMENT_COUNT);

  // Floating tech panels (48)
  private panelRadius = new Float32Array(TECH_PANEL_COUNT);
  private panelAngle = new Float32Array(TECH_PANEL_COUNT);
  private panelZ = new Float32Array(TECH_PANEL_COUNT);
  private panelScale = new Float32Array(TECH_PANEL_COUNT);
  private panelRotX = new Float32Array(TECH_PANEL_COUNT);
  private panelRotY = new Float32Array(TECH_PANEL_COUNT);
  private panelRotZ = new Float32Array(TECH_PANEL_COUNT);
  private panelSpinX = new Float32Array(TECH_PANEL_COUNT);
  private panelSpinY = new Float32Array(TECH_PANEL_COUNT);
  private panelSpinZ = new Float32Array(TECH_PANEL_COUNT);

  // Peripheral monoliths (96)
  private monoRadius = new Float32Array(MONOLITH_COUNT);
  private monoAngle = new Float32Array(MONOLITH_COUNT);
  private monoZ = new Float32Array(MONOLITH_COUNT);
  private monoScaleX = new Float32Array(MONOLITH_COUNT);
  private monoScaleY = new Float32Array(MONOLITH_COUNT);
  private monoScaleZ = new Float32Array(MONOLITH_COUNT);

  // Velocity streaks (100)
  private streakRadius = new Float32Array(STREAK_COUNT);
  private streakAngle = new Float32Array(STREAK_COUNT);
  private streakZ = new Float32Array(STREAK_COUNT);
  private streakSpeed = new Float32Array(STREAK_COUNT);

  private travelOffset = 0;
  private effectGlow = 0.0;
  private smoothedSpeedBoost = 1.0;
  private params: VisualParams;
  private palette: PaletteDefinition;

  constructor(
    initialParams: VisualParams = DEFAULT_VISUAL,
    paletteId: keyof typeof PALETTES = 'blue-violet',
  ) {
    this.params = { ...initialParams };
    this.palette = PALETTES[paletteId] ?? PALETTES['blue-violet']!;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020408); // Deep obsidian void
    this.scene.fog = new THREE.FogExp2(0x020408, 0.016);

    // Natural 72° FOV for deep cinematic perspective
    this.camera = new THREE.PerspectiveCamera(
      72,
      window.innerWidth / window.innerHeight,
      0.1,
      160,
    );
    // Camera is positioned slightly above the cyber highway track (y = -0.6)
    this.camera.position.set(0, -0.6, 1.0);
    this.camera.lookAt(0, -0.4, -60);
  }

  initialize(): void {
    this._setupLighting();
    this._buildCityMesh();
    this._buildArchitecturalConduitRings();
    this._buildRotatingApertureRings();
    this._buildCyberneticHighwayTrack();
    this._buildFloatingTechPanels();
    this._buildServerMonoliths();
    this._buildWarpStreaks();
    this._buildTransitParticles();
  }

  private _setupLighting(): void {
    // Ambient: deep charcoal-violet, preserving crisp shadows and negative black space
    this.ambientLight = new THREE.AmbientLight(0x0a0e1a, 0.7);

    // Directional: titanium key light raking along corridor facets
    this.dirLight = new THREE.DirectionalLight(0xdbeafe, 1.8);
    this.dirLight.position.set(2, 6, 4);

    // Dynamic point light tracking camera: warm amber/jewel accent
    this.cameraLight = new THREE.PointLight(
      new THREE.Color(0xf59e0b),
      1.2,
      30,
    );
    this.cameraLight.position.set(0, 0.0, 0.5);

    this.scene.add(this.ambientLight);
    this.scene.add(this.dirLight);
    this.scene.add(this.cameraLight);
  }

  private _buildCityMesh(): void {
    const radius = 6.8;
    const length = 150;
    const radialSegs = 48;
    const heightSegs = 120;

    const geo = new THREE.CylinderGeometry(radius, radius, length, radialSegs, heightSegs, true);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, -65);

    const mat = new THREE.ShaderMaterial({
      vertexShader: cityVert,
      fragmentShader: cityFrag,
      side: THREE.BackSide,
      uniforms: {
        uTime:               { value: 0 },
        uTravelOffset:       { value: 0 },
        uDisplacementAmp:    { value: this.params.displacementAmp },
        uTwistAmount:        { value: this.params.twistAmount },
        uEmissiveIntensity:  { value: 1.4 },
        uHighlightSharpness: { value: 64.0 },
        uWallBase:           { value: new THREE.Vector3(...this.palette.wallBase) },
        uWallEmissive:       { value: new THREE.Vector3(...this.palette.wallEmissive) },
        uHighlight:          { value: new THREE.Vector3(...this.palette.highlight) },
        uFogNear:            { value: new THREE.Vector3(...this.palette.fog) },
        uFogFar:             { value: new THREE.Vector3(...this.palette.fogFar) },
      },
    });

    this.cityMaterial = mat;
    this.cityMesh = new THREE.Mesh(geo, mat);
    this.scene.add(this.cityMesh);
  }

  private _buildArchitecturalConduitRings(): void {
    const geo = createArchitecturalConduitRingGeometry(505);
    this.majorRingsMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.28,
      metalness: 0.88,
      vertexColors: true,
      toneMapped: false,
    });

    this.majorRingsMesh = new THREE.InstancedMesh(geo, this.majorRingsMaterial, MAJOR_RING_COUNT);
    this.majorRingsMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let k = 0; k < MAJOR_RING_COUNT; k++) {
      const z = 4.0 - k * 6.0; // Spaced every 6 meters: 4, -2, -8, ... -134
      this.majorRingZ[k] = z;

      this.dummy.position.set(0, 0, z);
      this.dummy.rotation.set(0, 0, z * 0.02);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.majorRingsMesh.setMatrixAt(k, this.dummy.matrix);
    }

    this.majorRingsMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.majorRingsMesh);
  }

  private _buildRotatingApertureRings(): void {
    const geo = createRotatingApertureRingGeometry(606);
    this.apertureRingsMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.22,
      metalness: 0.92,
      vertexColors: true,
      toneMapped: false,
    });

    this.apertureRingsMesh = new THREE.InstancedMesh(geo, this.apertureRingsMaterial, APERTURE_RING_COUNT);
    this.apertureRingsMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let k = 0; k < APERTURE_RING_COUNT; k++) {
      const z = 1.0 - k * 6.0; // Offset halfway between major rings
      this.apertureRingZ[k] = z;
      this.apertureSpinDir[k] = k % 2 === 0 ? 1.0 : -1.0;

      this.dummy.position.set(0, 0, z);
      this.dummy.rotation.set(0, 0, k * 0.35);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.apertureRingsMesh.setMatrixAt(k, this.dummy.matrix);
    }

    this.apertureRingsMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.apertureRingsMesh);
  }

  private _buildCyberneticHighwayTrack(): void {
    const geo = createCyberTrackSegmentGeometry();
    this.trackMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.20,
      metalness: 0.85,
      vertexColors: true,
      toneMapped: false,
    });

    this.trackMesh = new THREE.InstancedMesh(geo, this.trackMaterial, TRACK_SEGMENT_COUNT);
    this.trackMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // 60 segments * 2.4m = 144m continuous floor
    for (let t = 0; t < TRACK_SEGMENT_COUNT; t++) {
      const z = 4.0 - t * 2.4;
      this.trackSegmentZ[t] = z;

      this.dummy.position.set(0, -2.62, z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.trackMesh.setMatrixAt(t, this.dummy.matrix);
    }

    this.trackMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.trackMesh);
  }

  private _buildFloatingTechPanels(): void {
    const geo = createFloatingTechPanelGeometry(707);
    this.techPanelsMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.18,
      metalness: 0.92,
      vertexColors: true,
      toneMapped: false,
    });

    this.techPanelsMesh = new THREE.InstancedMesh(geo, this.techPanelsMaterial, TECH_PANEL_COUNT);
    this.techPanelsMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const rng = mulberry32(888);

    for (let j = 0; j < TECH_PANEL_COUNT; j++) {
      // Position around perimeter (radius 3.4 - 4.8), avoiding track at bottom
      let a = rng() * Math.PI * 2;
      // If angle is near bottom (-y / ~ -Math.PI/2), nudge up
      if (Math.sin(a) < -0.75) {
        a += Math.PI * 0.5;
      }
      const r = 3.4 + rng() * 1.4;
      const z = 4.0 - rng() * 140.0;
      const s = 0.55 + rng() * 0.45;

      const rx = rng() * Math.PI * 2;
      const ry = rng() * Math.PI * 2;
      const rz = rng() * Math.PI * 2;

      const spx = (rng() - 0.5) * 0.6;
      const spy = (rng() - 0.5) * 0.6;
      const spz = (rng() - 0.5) * 0.6;

      this.panelRadius[j] = r;
      this.panelAngle[j] = a;
      this.panelZ[j] = z;
      this.panelScale[j] = s;
      this.panelRotX[j] = rx;
      this.panelRotY[j] = ry;
      this.panelRotZ[j] = rz;
      this.panelSpinX[j] = spx;
      this.panelSpinY[j] = spy;
      this.panelSpinZ[j] = spz;

      this.dummy.position.set(Math.cos(a) * r, Math.sin(a) * r, z);
      this.dummy.rotation.set(rx, ry, rz);
      this.dummy.scale.set(s, s, s);
      this.dummy.updateMatrix();
      this.techPanelsMesh.setMatrixAt(j, this.dummy.matrix);
    }

    this.techPanelsMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.techPanelsMesh);
  }

  private _buildServerMonoliths(): void {
    const geo = new THREE.BoxGeometry(0.9, 2.4, 3.8);
    this.monolithTexture = createSkyscraperTexture();

    this.monolithMaterial = new THREE.MeshStandardMaterial({
      map: this.monolithTexture,
      roughness: 0.22,
      metalness: 0.82,
      toneMapped: false,
    });

    this.monolithMesh = new THREE.InstancedMesh(geo, this.monolithMaterial, MONOLITH_COUNT);
    this.monolithMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const rng = mulberry32(101);

    for (let i = 0; i < MONOLITH_COUNT; i++) {
      const r = 4.8 + rng() * 1.5;
      let theta = (i / MONOLITH_COUNT) * Math.PI * 14 + rng() * 0.3;
      if (Math.sin(theta) < -0.80) theta += 0.8; // Avoid floor track

      const z = 4.0 - (i / MONOLITH_COUNT) * 140.0;
      const sx = 0.85 + rng() * 0.7;
      const sy = 0.8 + rng() * 1.1;
      const sz = 0.85 + rng() * 1.4;

      this.monoRadius[i] = r;
      this.monoAngle[i] = theta;
      this.monoZ[i] = z;
      this.monoScaleX[i] = sx;
      this.monoScaleY[i] = sy;
      this.monoScaleZ[i] = sz;

      // Instance color tinting from active palette
      const hueChoice = rng();
      if (hueChoice > 0.6) {
        this.tempColor.setRGB(this.palette.highlight[0], this.palette.highlight[1], this.palette.highlight[2]);
      } else if (hueChoice > 0.25) {
        this.tempColor.setRGB(this.palette.wallEmissive[0], this.palette.wallEmissive[1], this.palette.wallEmissive[2]);
      } else {
        this.tempColor.setRGB(0.9, 0.9, 1.0);
      }
      this.monolithMesh.setColorAt(i, this.tempColor);

      this.dummy.position.set(Math.cos(theta) * r, Math.sin(theta) * r, z);
      this.dummy.rotation.set(0, 0, theta + Math.PI / 2);
      this.dummy.scale.set(sx, sy, sz);
      this.dummy.updateMatrix();
      this.monolithMesh.setMatrixAt(i, this.dummy.matrix);
    }

    if (this.monolithMesh.instanceColor) {
      this.monolithMesh.instanceColor.needsUpdate = true;
    }
    this.monolithMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.monolithMesh);
  }

  private _buildWarpStreaks(): void {
    const geo = new THREE.CylinderGeometry(0.012, 0.012, 3.6, 4);
    geo.rotateX(Math.PI / 2);

    this.streaksMaterial = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.35,
      toneMapped: false,
    });

    this.streaksMesh = new THREE.InstancedMesh(geo, this.streaksMaterial, STREAK_COUNT);
    this.streaksMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const rng = mulberry32(555);

    for (let s = 0; s < STREAK_COUNT; s++) {
      const r = 3.6 + rng() * 2.2;
      const a = rng() * Math.PI * 2;
      const z = 4.0 - rng() * 140.0;
      const spd = 1.05 + rng() * 0.25;

      this.streakRadius[s] = r;
      this.streakAngle[s] = a;
      this.streakZ[s] = z;
      this.streakSpeed[s] = spd;

      this.dummy.position.set(Math.cos(a) * r, Math.sin(a) * r, z);
      this.dummy.rotation.set(0, 0, a);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.streaksMesh.setMatrixAt(s, this.dummy.matrix);
    }
    this.streaksMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.streaksMesh);
  }

  private _buildTransitParticles(): void {
    const budget = 1200;
    const rng = mulberry32(101);

    const positions  = new Float32Array(budget * 3);
    const sizes      = new Float32Array(budget);
    const phases     = new Float32Array(budget);
    const brightness = new Float32Array(budget);
    const layers     = new Float32Array(budget);
    const drifts     = new Float32Array(budget * 3);

    for (let i = 0; i < budget; i++) {
      // Keep clear corridor along flight path (radius 3.4 to 6.2)
      const radius = 3.4 + rng() * 2.8;
      const angle = rng() * Math.PI * 2;
      const depth = -140.0 + rng() * 144.0;

      positions[i * 3 + 0] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius;
      positions[i * 3 + 2] = depth;

      sizes[i] = 1.0 + rng() * 1.6;
      phases[i] = rng() * Math.PI * 2;
      brightness[i] = 0.4 + rng() * 0.4;
      layers[i] = 2;

      drifts[i * 3 + 0] = (rng() - 0.5) * 0.04;
      drifts[i * 3 + 1] = (rng() - 0.5) * 0.04;
      drifts[i * 3 + 2] = (rng() - 0.5) * 0.04;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',    new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize',       new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase',      new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aBrightness', new THREE.BufferAttribute(brightness, 1));
    geo.setAttribute('aLayer',      new THREE.BufferAttribute(layers, 1));
    geo.setAttribute('aDrift',      new THREE.BufferAttribute(drifts, 3));

    const mat = new THREE.ShaderMaterial({
      vertexShader: particleVert,
      fragmentShader: particleFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime:          { value: 0 },
        uPointSizeMax:  { value: 28.0 },
        uParticleColor: { value: new THREE.Vector3(...this.palette.particle) },
      },
    });

    this.particleMaterial = mat;
    this.particleSystem = new THREE.Points(geo, mat);
    this.scene.add(this.particleSystem);
  }

  update(dt: number, elapsed: number, audio?: AudioBands): void {
    // ── Meditative Forward Speed (Smooth cruising: ~5.5 - 9.0 units/sec) ──
    const rawBoost = audio ? 1.0 + audio.low * 0.10 : 1.0;
    this.smoothedSpeedBoost += (rawBoost - this.smoothedSpeedBoost) * Math.min(1.0, dt * 2.5);

    const baseSpeed = (4.5 + this.params.travelSpeed * 7.0) * this.smoothedSpeedBoost;
    const forwardDist = baseSpeed * dt;

    this.travelOffset = (this.travelOffset + forwardDist * 0.0025) % 1.0;
    const twist = this.params.twistAmount * 0.035;

    // Smooth decay of gift effect luminance swell (T ~ 2.5s)
    if (this.effectGlow > 0.0) {
      this.effectGlow = Math.max(0.0, this.effectGlow - dt * 0.45);
    }
    const swell = Math.sin(this.effectGlow * Math.PI) * 0.55;

    // ── 1. Update Primary Architecture: Major Conduit Rings ─────
    const majorRingSpan = MAJOR_RING_COUNT * 6.0; // 144m
    for (let k = 0; k < MAJOR_RING_COUNT; k++) {
      let z = (this.majorRingZ[k] ?? -140) + forwardDist;
      if (z > 4.0) {
        z -= majorRingSpan;
      }
      this.majorRingZ[k] = z;

      this.dummy.position.set(0, 0, z);
      this.dummy.rotation.set(0, 0, z * twist * 0.5);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.majorRingsMesh.setMatrixAt(k, this.dummy.matrix);
    }
    this.majorRingsMesh.instanceMatrix.needsUpdate = true;

    // ── 2. Update Secondary: Concentric Counter-Rotating Aperture Rings ──
    for (let k = 0; k < APERTURE_RING_COUNT; k++) {
      let z = (this.apertureRingZ[k] ?? -140) + forwardDist;
      if (z > 4.0) {
        z -= majorRingSpan;
      }
      this.apertureRingZ[k] = z;

      // Aperture shutter counter-rotation: smooth mechanical rotation with rhythmic beat pulse
      const dir = this.apertureSpinDir[k] ?? 1.0;
      const beatSpin = audio ? audio.beat * 0.15 + audio.mid * 0.08 : 0;
      const rot = dir * (elapsed * 0.18 + beatSpin + k * 0.25) + z * twist * 0.4;

      this.dummy.position.set(0, 0, z);
      this.dummy.rotation.set(0, 0, rot);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.apertureRingsMesh.setMatrixAt(k, this.dummy.matrix);
    }
    this.apertureRingsMesh.instanceMatrix.needsUpdate = true;

    // ── 3. Update Secondary: Multi-Rail Cybernetic Highway Track ──
    const trackSpan = TRACK_SEGMENT_COUNT * 2.4; // 144m
    for (let t = 0; t < TRACK_SEGMENT_COUNT; t++) {
      let z = (this.trackSegmentZ[t] ?? -140) + forwardDist;
      if (z > 4.0) {
        z -= trackSpan;
      }
      this.trackSegmentZ[t] = z;

      this.dummy.position.set(0, -2.62, z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.trackMesh.setMatrixAt(t, this.dummy.matrix);
    }
    this.trackMesh.instanceMatrix.needsUpdate = true;

    // ── 4. Update Tertiary: Floating Hexagonal Tech Panels ──────
    for (let j = 0; j < TECH_PANEL_COUNT; j++) {
      let pz = (this.panelZ[j] ?? -140) + forwardDist * 0.95;
      let baseAng = this.panelAngle[j] ?? 0;
      if (pz > 4.0) {
        pz -= 144.0;
        baseAng += 0.85;
        this.panelAngle[j] = baseAng;
      }
      this.panelZ[j] = pz;

      const a = baseAng + pz * twist * 0.6;
      const r = this.panelRadius[j] ?? 3.8;

      const rx = (this.panelRotX[j] ?? 0) + (this.panelSpinX[j] ?? 0.4) * dt;
      const ry = (this.panelRotY[j] ?? 0) + (this.panelSpinY[j] ?? 0.4) * dt;
      const rz = (this.panelRotZ[j] ?? 0) + (this.panelSpinZ[j] ?? 0.4) * dt;
      this.panelRotX[j] = rx;
      this.panelRotY[j] = ry;
      this.panelRotZ[j] = rz;

      const s = this.panelScale[j] ?? 0.6;

      this.dummy.position.set(Math.cos(a) * r, Math.sin(a) * r, pz);
      this.dummy.rotation.set(rx, ry, rz);
      this.dummy.scale.set(s, s, s);
      this.dummy.updateMatrix();
      this.techPanelsMesh.setMatrixAt(j, this.dummy.matrix);
    }
    this.techPanelsMesh.instanceMatrix.needsUpdate = true;

    // ── 5. Update Peripheral Server Monoliths ───────────────────
    for (let i = 0; i < MONOLITH_COUNT; i++) {
      let z = (this.monoZ[i] ?? -140) + forwardDist;
      if (z > 4.0) {
        z -= 144.0;
      }
      this.monoZ[i] = z;

      const baseAngle = this.monoAngle[i] ?? 0;
      const theta = baseAngle + z * twist;
      const r = this.monoRadius[i] ?? 5.2;
      const sx = this.monoScaleX[i] ?? 1;
      const sy = this.monoScaleY[i] ?? 1;
      const sz = this.monoScaleZ[i] ?? 1;

      this.dummy.position.set(Math.cos(theta) * r, Math.sin(theta) * r, z);
      this.dummy.rotation.set(0, 0, theta + Math.PI / 2);
      this.dummy.scale.set(sx, sy, sz);
      this.dummy.updateMatrix();
      this.monolithMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.monolithMesh.instanceMatrix.needsUpdate = true;

    // ── 6. Update Warp Streaks ──────────────────────────────────
    for (let s = 0; s < STREAK_COUNT; s++) {
      const spd = this.streakSpeed[s] ?? 1.1;
      let z = (this.streakZ[s] ?? -140) + forwardDist * spd;
      if (z > 4.0) {
        z -= 144.0;
      }
      this.streakZ[s] = z;

      const a = this.streakAngle[s] ?? 0;
      const r = this.streakRadius[s] ?? 4.0;

      this.dummy.position.set(Math.cos(a) * r, Math.sin(a) * r, z);
      this.dummy.rotation.set(0, 0, a);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.streaksMesh.setMatrixAt(s, this.dummy.matrix);
    }
    this.streaksMesh.instanceMatrix.needsUpdate = true;

    // ── 7. Shader Uniforms & Audio Modulation ───────────────────
    const cu = this.cityMaterial.uniforms;
    cu['uTime']!.value = elapsed;
    cu['uTravelOffset']!.value = this.travelOffset;
    cu['uDisplacementAmp']!.value = this.params.displacementAmp;
    cu['uTwistAmount']!.value = this.params.twistAmount;

    if (audio) {
      cu['uEmissiveIntensity']!.value = 1.4 + audio.low * 0.35 + audio.beat * 0.45 + audio.longTermEnergy * 0.25 + swell * 0.6;
      cu['uHighlightSharpness']!.value = 64.0 + audio.high * 32.0;
      this.cameraLight.intensity = 1.2 + audio.low * 0.5 + audio.beat * 0.4 + swell * 0.8;
    } else {
      cu['uEmissiveIntensity']!.value = 1.4 + swell * 0.6;
      cu['uHighlightSharpness']!.value = 64.0;
      this.cameraLight.intensity = 1.2 + swell * 0.8;
    }

    this.particleMaterial.uniforms['uTime']!.value = elapsed;

    // ── 8. Meditative Camera Sway & Subtle Banking Tilt ─────────
    const camSwayX = Math.sin(elapsed * 0.16) * 0.12;
    const camSwayY = -0.6 + Math.cos(elapsed * 0.12) * 0.08;
    this.camera.position.x = camSwayX;
    this.camera.position.y = camSwayY;
    // Gentle, silky banking tilt
    this.camera.rotation.z = Math.sin(elapsed * 0.14) * 0.022;
    this.camera.lookAt(camSwayX * 0.35, -0.4, -60);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  applyPalette(palette: PaletteDefinition, t: number, prev?: PaletteDefinition): void {
    this.palette = palette;
    const lerp = (a: [number, number, number], b: [number, number, number]) => lerpVec3(a, b, t);
    const from = prev ?? palette;

    const cu = this.cityMaterial.uniforms;
    cu['uWallBase']!.value    = lerp(from.wallBase,     palette.wallBase);
    cu['uWallEmissive']!.value= lerp(from.wallEmissive, palette.wallEmissive);
    cu['uHighlight']!.value   = lerp(from.highlight,    palette.highlight);
    cu['uFogNear']!.value     = lerp(from.fog,          palette.fog);
    cu['uFogFar']!.value      = lerp(from.fogFar,       palette.fogFar);

    this.particleMaterial.uniforms['uParticleColor']!.value = lerp(from.particle, palette.particle);

    const curHighlight = lerp(from.highlight, palette.highlight);
    this.streaksMaterial.color.setRGB(curHighlight.x, curHighlight.y, curHighlight.z);

    const curEmissive = lerp(from.wallEmissive, palette.wallEmissive);
    this.cameraLight.color.setRGB(curEmissive.x, curEmissive.y, curEmissive.z);

    // Update instance colors for monoliths
    const rng = mulberry32(101);
    for (let i = 0; i < MONOLITH_COUNT; i++) {
      const choice = rng();
      if (choice > 0.6) {
        this.tempColor.setRGB(palette.highlight[0], palette.highlight[1], palette.highlight[2]);
      } else if (choice > 0.25) {
        this.tempColor.setRGB(palette.wallEmissive[0], palette.wallEmissive[1], palette.wallEmissive[2]);
      } else {
        this.tempColor.setRGB(0.9, 0.9, 1.0);
      }
      this.monolithMesh.setColorAt(i, this.tempColor);
    }
    if (this.monolithMesh.instanceColor) {
      this.monolithMesh.instanceColor.needsUpdate = true;
    }
  }

  applyVisualParams(params: VisualParams): void {
    this.params = params;
  }

  triggerEffect(effectName: string, _params?: Record<string, unknown>): void {
    if (effectName === 'sparkle_wave' || effectName === 'constellation_flash') {
      this.effectGlow = 1.0;
    }
  }

  dispose(): void {
    this.cityMesh.geometry.dispose();
    this.cityMaterial.dispose();

    this.majorRingsMesh.geometry.dispose();
    this.majorRingsMaterial.dispose();

    this.apertureRingsMesh.geometry.dispose();
    this.apertureRingsMaterial.dispose();

    this.trackMesh.geometry.dispose();
    this.trackMaterial.dispose();

    this.techPanelsMesh.geometry.dispose();
    this.techPanelsMaterial.dispose();

    this.monolithMesh.geometry.dispose();
    this.monolithMaterial.dispose();
    if (this.monolithTexture) {
      this.monolithTexture.dispose();
    }

    this.streaksMesh.geometry.dispose();
    this.streaksMaterial.dispose();

    this.particleSystem.geometry.dispose();
    this.particleMaterial.dispose();

    this.scene.clear();
  }
}
