/**
 * scenes/CrystalTunnelScene.ts
 * Flagship Visual: Natural Amethyst Crystal Cavern Sanctuary (Reference Picture & improvements.md §9).
 *
 * Implements:
 * - Natural multi-spire amethyst geode clusters (6-sided hexagonal quartz columns with bevelled tips)
 * - Organic arched cavern cathedral geometry with rock ledges and reflective crystalline riverbed floor
 * - Grand natural rock archways framing overhead vault with embedded amethyst veins
 * - Hanging quartz stalactite clusters along upper ceiling, framing the view
 * - Volumetric lavender & celestial god-rays beaming down through ceiling crevices
 * - Guaranteed camera-safe clearance corridor (minimum 5.5m clear span) — ZERO collisions
 * - 2,200 sparkling diamond crystal dust motes with soft bokeh and gentle drift
 * - Zero per-frame memory allocation (pre-allocated Object3D dummy and typed arrays)
 */

import * as THREE from 'three';
import type { SceneLifecycle } from './SceneLifecycle';
import type { VisualParams, PaletteDefinition } from '../state/types';
import type { AudioBands } from '../audio/AudioAnalyser';
import { DEFAULT_VISUAL } from '../state/types';
import { PALETTES } from '../state/palettes';

import tunnelVert from '../shaders/tunnelVertex.glsl?raw';
import tunnelFrag from '../shaders/tunnelFragment.glsl?raw';
import particleVert from '../shaders/particleVertex.glsl?raw';
import particleFrag from '../shaders/particleFragment.glsl?raw';

import {
  createCrystalClusterGeometry,
  createCrystallineGatewayGeometry,
  createPrismaticShardGeometry,
  createCrystalStalactiteGeometry,
} from '../procedural/CrystalClusterGenerator';

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

/** Creates soft gradient texture for volumetric god-ray light shafts */
function createLightShaftTexture(): THREE.Texture {
  if (typeof document === 'undefined') return new THREE.Texture();
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.00, 'rgba(255, 255, 255, 0.0)');
  grad.addColorStop(0.12, 'rgba(235, 215, 255, 0.40)');
  grad.addColorStop(0.40, 'rgba(192, 132, 252, 0.65)');
  grad.addColorStop(0.75, 'rgba(126, 34, 206, 0.20)');
  grad.addColorStop(1.00, 'rgba(0, 0, 0, 0.0)');

  const horizGrad = ctx.createLinearGradient(0, 0, 256, 0);
  horizGrad.addColorStop(0.0, 'rgba(0,0,0,0.0)');
  horizGrad.addColorStop(0.3, 'rgba(255,255,255,1.0)');
  horizGrad.addColorStop(0.7, 'rgba(255,255,255,1.0)');
  horizGrad.addColorStop(1.0, 'rgba(0,0,0,0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 512);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = horizGrad;
  ctx.fillRect(0, 0, 256, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  return texture;
}

const GATEWAY_COUNT    = 8;   // Natural rock arch ribs framing cavern vault
const CLUSTER_COUNT    = 44;  // Multi-spire amethyst geode clusters on rock banks
const STALACTITE_COUNT = 24;  // Hanging quartz stalactites on upper ceiling
const SHARD_COUNT      = 24;  // Luminous gem prisms embedded on wall alcoves
const TOTAL_SPAN       = 112.0;

export class CrystalTunnelScene implements SceneLifecycle {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  // Arched Cavern Shell
  private tunnelMesh!: THREE.Mesh;
  private tunnelMaterial!: THREE.ShaderMaterial;

  // Reflective Iridescent Crystalline Riverbed Floor
  private floorMesh!: THREE.Mesh;
  private floorMaterial!: THREE.MeshStandardMaterial;

  // Primary: Natural Cavern Rock Arch Ribs
  private gatewayMesh!: THREE.InstancedMesh;
  private gatewayMaterial!: THREE.MeshStandardMaterial;
  private gatewayZ = new Float32Array(GATEWAY_COUNT);

  // Secondary: Multi-Spire Amethyst Geode Clusters on Side Rock Banks
  private clusterMesh!: THREE.InstancedMesh;
  private clusterMaterial!: THREE.MeshStandardMaterial;
  private clusterX = new Float32Array(CLUSTER_COUNT);
  private clusterY = new Float32Array(CLUSTER_COUNT);
  private clusterZ = new Float32Array(CLUSTER_COUNT);
  private clusterRotX = new Float32Array(CLUSTER_COUNT);
  private clusterRotY = new Float32Array(CLUSTER_COUNT);
  private clusterRotZ = new Float32Array(CLUSTER_COUNT);
  private clusterScale = new Float32Array(CLUSTER_COUNT);

  // Tertiary 1: Hanging Quartz Stalactite Clusters
  private stalactiteMesh!: THREE.InstancedMesh;
  private stalactiteMaterial!: THREE.MeshStandardMaterial;
  private stalactiteX = new Float32Array(STALACTITE_COUNT);
  private stalactiteY = new Float32Array(STALACTITE_COUNT);
  private stalactiteZ = new Float32Array(STALACTITE_COUNT);
  private stalactiteScale = new Float32Array(STALACTITE_COUNT);

  // Tertiary 2: Luminous Gemstone Prisms on Cavern Walls
  private shardMesh!: THREE.InstancedMesh;
  private shardMaterial!: THREE.MeshStandardMaterial;
  private shardX = new Float32Array(SHARD_COUNT);
  private shardY = new Float32Array(SHARD_COUNT);
  private shardZ = new Float32Array(SHARD_COUNT);
  private shardRotX = new Float32Array(SHARD_COUNT);
  private shardRotY = new Float32Array(SHARD_COUNT);
  private shardRotZ = new Float32Array(SHARD_COUNT);
  private shardSpinX = new Float32Array(SHARD_COUNT);
  private shardSpinY = new Float32Array(SHARD_COUNT);
  private shardScale = new Float32Array(SHARD_COUNT);

  // Volumetric God-Rays (Lavender Light Shafts)
  private godRayGroup = new THREE.Group();
  private godRayMaterial!: THREE.MeshBasicMaterial;
  private godRayTexture!: THREE.Texture;

  // Sparkling Diamond Crystal Dust
  private particleSystem!: THREE.Points;
  private particleMaterial!: THREE.ShaderMaterial;
  private particleGeo!: THREE.BufferGeometry;

  // Lighting
  private ambientLight!: THREE.AmbientLight;
  private cameraLight!: THREE.PointLight;
  private leftCavernLight!: THREE.PointLight;
  private rightCavernLight!: THREE.PointLight;
  private deepCavernLight!: THREE.PointLight;
  private dirLight!: THREE.DirectionalLight;

  // Reusable dummy for zero per-frame allocation
  private readonly dummy = new THREE.Object3D();

  private params: VisualParams;
  private palette: PaletteDefinition;
  private travelOffset = 0;
  private effectGlow = 0.0;
  private smoothedSpeedBoost = 1.0;

  constructor(params?: VisualParams, paletteId?: string) {
    this.params = params ?? { ...DEFAULT_VISUAL };
    this.palette = PALETTES[paletteId ?? 'blue-violet'] ?? PALETTES['blue-violet']!;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060410); // Deep velvety night/amethyst void
    this.scene.fog = new THREE.FogExp2(0x060410, 0.014);

    // Natural 72° FOV for deep, majestic cavern perspective
    this.camera = new THREE.PerspectiveCamera(72, typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.77, 0.1, 150);
    this.camera.position.set(0, -0.15, 2.0);
    this.camera.lookAt(0, -0.15, -45);
  }

  initialize(): void {
    this._setupLighting();
    this._buildTunnelBackdrop();
    this._buildReflectiveFloor();
    this._buildCrystalGateways();
    this._buildCrystalClusters();
    this._buildStalactites();
    this._buildFloatingShards();
    this._buildVolumetricGodRays();
    this._buildParticles();
  }

  private _setupLighting(): void {
    // Ambient: deep charcoal-violet, preserving rich shadows
    this.ambientLight = new THREE.AmbientLight(0x0a0718, 0.85);

    // Dynamic point light tracking camera: cool diamond-white fill
    this.cameraLight = new THREE.PointLight(0xf5f3ff, 1.2, 24, 1.6);
    this.cameraLight.position.set(0, 0.2, 1.5);

    // Left and right cavern accent lights: illuminating amethyst facet clusters
    this.leftCavernLight = new THREE.PointLight(0xc084fc, 3.6, 42, 1.3);
    this.leftCavernLight.position.set(-3.8, 0.4, -14);

    this.rightCavernLight = new THREE.PointLight(0xa855f7, 3.6, 42, 1.3);
    this.rightCavernLight.position.set(3.8, 0.4, -28);

    // Deep cavern light: soft celestial periwinkle/cyan glow at horizon
    this.deepCavernLight = new THREE.PointLight(0x67e8f9, 3.5, 65, 1.2);
    this.deepCavernLight.position.set(0, 1.2, -65);

    // Directional light from above-left simulating celestial shaft illumination
    this.dirLight = new THREE.DirectionalLight(0xe9d5ff, 1.6);
    this.dirLight.position.set(-5, 12, 4);

    this.scene.add(this.ambientLight);
    this.scene.add(this.cameraLight);
    this.scene.add(this.leftCavernLight);
    this.scene.add(this.rightCavernLight);
    this.scene.add(this.deepCavernLight);
    this.scene.add(this.dirLight);
  }

  private _buildTunnelBackdrop(): void {
    // Sculpted organic arched cavern vault (32 radial segments, 96 height rings)
    const geo = new THREE.CylinderGeometry(5.6, 5.6, 140, 32, 96, true);
    geo.scale(-1, 1, 1);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, -60);

    // Deform cylinder into cathedral cavern arch:
    // Flatten lower region into broad rock riverbed, vault upper arch overhead
    const pos = geo.attributes['position']!;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      const z = pos.getZ(i);

      if (y < -1.2) {
        // Broad, flat cavern riverbed floor
        y = -2.55 + (y + 1.2) * 0.12;
        x *= 1.22;
      } else {
        // Gothic arched cathedral ceiling vault
        y = y * 1.12 + 0.35;
        x *= 1.04;
      }
      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();

    this.tunnelMaterial = new THREE.ShaderMaterial({
      vertexShader: tunnelVert,
      fragmentShader: tunnelFrag,
      side: THREE.DoubleSide,
      uniforms: {
        uTime:               { value: 0 },
        uTravelOffset:       { value: 0 },
        uDisplacementAmp:    { value: Math.min(this.params.displacementAmp, 0.45) },
        uTwistAmount:        { value: 0.0 }, // Keep natural cavern stable and upright (no spinning)
        uPatternScale:       { value: 1.2 },
        uFlowSpeed:          { value: 0.35 },
        uHighlightSharpness: { value: 48.0 },
        uEmissiveIntensity:  { value: 1.4 },
        uWallBase:           { value: new THREE.Vector3(...this.palette.wallBase) },
        uWallEmissive:       { value: new THREE.Vector3(...this.palette.wallEmissive) },
        uHighlight:          { value: new THREE.Vector3(...this.palette.highlight) },
        uFogNear:            { value: new THREE.Vector3(...this.palette.fog) },
        uFogFar:             { value: new THREE.Vector3(...this.palette.fogFar) },
      },
    });

    this.tunnelMesh = new THREE.Mesh(geo, this.tunnelMaterial);
    this.scene.add(this.tunnelMesh);
  }

  private _buildReflectiveFloor(): void {
    // Glossy crystalline riverbed floor capturing soft reflections & caustics
    const floorGeo = new THREE.PlaneGeometry(7.2, 140, 16, 64);
    floorGeo.rotateX(-Math.PI / 2);
    floorGeo.translate(0, -2.52, -60);
    floorGeo.computeVertexNormals();

    this.floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x180f2d,
      roughness: 0.14,
      metalness: 0.25,
      emissive: 0x241042,
      emissiveIntensity: 0.45,
    });

    this.floorMesh = new THREE.Mesh(floorGeo, this.floorMaterial);
    this.scene.add(this.floorMesh);
  }

  private _buildCrystalGateways(): void {
    // Grand natural rock arches framing the overhead cavern vault (clearance radius > 4.4m)
    const geo = createCrystallineGatewayGeometry(202);

    this.gatewayMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.70,
      metalness: 0.12,
      vertexColors: true,
      emissive: 0x1f0e38,
      emissiveIntensity: 0.35,
      flatShading: true,
      toneMapped: false,
    });

    this.gatewayMesh = new THREE.InstancedMesh(geo, this.gatewayMaterial, GATEWAY_COUNT);
    this.gatewayMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let i = 0; i < GATEWAY_COUNT; i++) {
      const z = 4.0 - (i / GATEWAY_COUNT) * TOTAL_SPAN;
      this.gatewayZ[i] = z;

      this.dummy.position.set(0, 0, z);
      this.dummy.rotation.set(0, 0, 0); // Stationary rock ribs — no dizzying rotation
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.gatewayMesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.gatewayMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.gatewayMesh);
  }

  private _buildCrystalClusters(): void {
    // Natural multi-spire amethyst geode clusters rooted on the LEFT and RIGHT rock banks
    const geo = createCrystalClusterGeometry(101);

    this.clusterMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.18,
      metalness: 0.08, // Dielectric gemstone with natural internal translucence
      vertexColors: true,
      emissive: 0x3b0764, // Deep royal purple internal luminescence
      emissiveIntensity: 0.55,
      flatShading: true,
      toneMapped: false,
    });

    this.clusterMesh = new THREE.InstancedMesh(geo, this.clusterMaterial, CLUSTER_COUNT);
    this.clusterMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const rng = mulberry32(101);

    for (let i = 0; i < CLUSTER_COUNT; i++) {
      const isLeft = i % 2 === 0;
      const isShoulder = i % 5 === 0; // Some clusters on upper rock shoulders

      let x = 0;
      let y = -2.35;
      let rotX = (rng() - 0.5) * 0.18;
      let rotY = (rng() - 0.5) * 0.35;
      let rotZ = 0;

      if (isShoulder) {
        // Upper cavern shoulders framing ceiling arch
        x = (isLeft ? -1 : 1) * (4.2 + rng() * 0.6);
        y = 3.2 + rng() * 0.8;
        rotZ = (isLeft ? 1 : -1) * (0.8 + rng() * 0.3);
      } else {
        // Left & right riverbed banks (guaranteed |x| >= 3.6m — center corridor 100% CLEAR!)
        x = (isLeft ? -1 : 1) * (3.8 + rng() * 0.8);
        y = -2.35 + (rng() - 0.5) * 0.2;
        // Lean gently inward toward the center light
        rotZ = (isLeft ? -1 : 1) * (0.16 + rng() * 0.16);
      }

      const z = 4.0 - (i / CLUSTER_COUNT) * TOTAL_SPAN;
      const s = 1.0 + rng() * 0.65;

      this.clusterX[i] = x;
      this.clusterY[i] = y;
      this.clusterZ[i] = z;
      this.clusterRotX[i] = rotX;
      this.clusterRotY[i] = rotY;
      this.clusterRotZ[i] = rotZ;
      this.clusterScale[i] = s;

      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(rotX, rotY, rotZ);
      this.dummy.scale.set(s, s, s);
      this.dummy.updateMatrix();
      this.clusterMesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.clusterMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.clusterMesh);
  }

  private _buildStalactites(): void {
    // Hanging quartz stalactite clusters on upper ceiling vault (y >= 4.6m)
    const geo = createCrystalStalactiteGeometry(404);

    this.stalactiteMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.16,
      metalness: 0.06,
      vertexColors: true,
      emissive: 0x4c1d95,
      emissiveIntensity: 0.45,
      flatShading: true,
      toneMapped: false,
    });

    this.stalactiteMesh = new THREE.InstancedMesh(geo, this.stalactiteMaterial, STALACTITE_COUNT);
    this.stalactiteMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const rng = mulberry32(505);

    for (let k = 0; k < STALACTITE_COUNT; k++) {
      const x = (rng() - 0.5) * 3.4;
      const y = 4.8 + (rng() - 0.5) * 0.3; // High on ceiling — over 2.5m above camera
      const z = 4.0 - (k / STALACTITE_COUNT) * TOTAL_SPAN;
      const s = 0.9 + rng() * 0.55;

      this.stalactiteX[k] = x;
      this.stalactiteY[k] = y;
      this.stalactiteZ[k] = z;
      this.stalactiteScale[k] = s;

      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set((rng() - 0.5) * 0.12, (rng() - 0.5) * 0.25, (rng() - 0.5) * 0.12);
      this.dummy.scale.set(s, s, s);
      this.dummy.updateMatrix();
      this.stalactiteMesh.setMatrixAt(k, this.dummy.matrix);
    }

    this.stalactiteMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.stalactiteMesh);
  }

  private _buildFloatingShards(): void {
    // Luminous gemstone prisms in wall alcoves (guaranteed |x| >= 3.8m or y >= 3.4m)
    const geo = createPrismaticShardGeometry(303);

    this.shardMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.12,
      metalness: 0.05,
      vertexColors: true,
      emissive: 0x6b21a8,
      emissiveIntensity: 0.70,
      flatShading: true,
      toneMapped: false,
    });

    this.shardMesh = new THREE.InstancedMesh(geo, this.shardMaterial, SHARD_COUNT);
    this.shardMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const rng = mulberry32(777);

    for (let i = 0; i < SHARD_COUNT; i++) {
      const isLeft = i % 2 === 0;
      const x = (isLeft ? -1 : 1) * (3.8 + rng() * 1.0);
      const y = 0.5 + rng() * 3.2; // Hovering near cavern walls
      const z = 4.0 - (i / SHARD_COUNT) * TOTAL_SPAN;

      const rX = rng() * Math.PI * 2;
      const rY = rng() * Math.PI * 2;
      const rZ = rng() * Math.PI * 2;
      const spdX = (rng() - 0.5) * 0.3;
      const spdY = (rng() - 0.5) * 0.3;
      const s = 0.6 + rng() * 0.45;

      this.shardX[i] = x;
      this.shardY[i] = y;
      this.shardZ[i] = z;
      this.shardRotX[i] = rX;
      this.shardRotY[i] = rY;
      this.shardRotZ[i] = rZ;
      this.shardSpinX[i] = spdX;
      this.shardSpinY[i] = spdY;
      this.shardScale[i] = s;

      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(rX, rY, rZ);
      this.dummy.scale.set(s, s, s);
      this.dummy.updateMatrix();
      this.shardMesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.shardMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.shardMesh);
  }

  private _buildVolumetricGodRays(): void {
    this.godRayTexture = createLightShaftTexture();
    this.godRayMaterial = new THREE.MeshBasicMaterial({
      map: this.godRayTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      opacity: 0.16,
    });

    // Angled volumetric light shafts pouring down from ceiling fissures
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.PlaneGeometry(8.0, 32.0);
      geo.translate(0, 14.0, 0);

      const mesh = new THREE.Mesh(geo, this.godRayMaterial);
      const angle = -0.28 + (i - 2.5) * 0.09;
      mesh.position.set((i - 2.5) * 3.6, 0.0, -22.0 - i * 16.0);
      mesh.rotation.x = -0.32;
      mesh.rotation.y = angle;
      mesh.rotation.z = 0.10;

      this.godRayGroup.add(mesh);
    }
    this.scene.add(this.godRayGroup);
  }

  private _buildParticles(): void {
    const budget = 2200;
    const rng = mulberry32(42);

    const positions  = new Float32Array(budget * 3);
    const sizes      = new Float32Array(budget);
    const phases     = new Float32Array(budget);
    const brightness = new Float32Array(budget);
    const layers     = new Float32Array(budget);
    const drifts     = new Float32Array(budget * 3);

    for (let i = 0; i < budget; i++) {
      const angle = rng() * Math.PI * 2;
      const radius = 1.8 + rng() * 3.6;
      const depth = -rng() * 110.0;

      positions[i * 3 + 0] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * (radius * 0.7);
      positions[i * 3 + 2] = depth;

      sizes[i] = 1.0 + rng() * 1.8;
      phases[i] = rng() * Math.PI * 2;
      brightness[i] = 0.45 + rng() * 0.55;
      layers[i] = rng() < 0.35 ? 0 : 1;

      drifts[i * 3 + 0] = (rng() - 0.5) * 0.002;
      drifts[i * 3 + 1] = (rng() - 0.5) * 0.002;
      drifts[i * 3 + 2] = 0.006 + rng() * 0.012;
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
        uPointSizeMax:  { value: 40.0 },
        uParticleColor: { value: new THREE.Vector3(...this.palette.particle) },
      },
    });

    this.particleGeo = geo;
    this.particleMaterial = mat;
    this.particleSystem = new THREE.Points(geo, mat);
    this.scene.add(this.particleSystem);
  }

  update(dt: number, elapsed: number, audio?: AudioBands): void {
    // ── Meditative Cavern Cruising Velocity (~4.8 units/sec) ────
    const rawBoost = audio ? 1.0 + audio.low * 0.16 + audio.longTermEnergy * 0.12 : 1.0;
    this.smoothedSpeedBoost += (rawBoost - this.smoothedSpeedBoost) * Math.min(1.0, dt * 2.5);

    const cruiseSpeed = (3.4 + this.params.travelSpeed * 3.8) * this.smoothedSpeedBoost;
    const forwardDist = cruiseSpeed * dt;

    // 1. Scroll cavern backdrop shader
    this.travelOffset = (this.travelOffset + forwardDist * 0.007) % 1;

    // Smooth decay of gift effect luminance swell (T ~ 2.5s)
    if (this.effectGlow > 0.0) {
      this.effectGlow = Math.max(0.0, this.effectGlow - dt * 0.45);
    }
    const swell = Math.sin(this.effectGlow * Math.PI) * 0.55;

    const tu = this.tunnelMaterial.uniforms;
    tu['uTime']!.value = elapsed;
    tu['uTravelOffset']!.value = this.travelOffset;
    tu['uDisplacementAmp']!.value = Math.min(this.params.displacementAmp, 0.45);

    // Gently pulse god-rays with breathing cycle (T ~ 12s) and musical low end
    const godRayPulse = 0.14 + Math.sin(elapsed * 0.52) * 0.04 + (audio ? audio.low * 0.03 + audio.beat * 0.025 : 0) + swell * 0.08;
    this.godRayMaterial.opacity = godRayPulse;

    if (audio) {
      tu['uEmissiveIntensity']!.value = 1.4 + audio.low * 0.40 + audio.beat * 0.35 + audio.longTermEnergy * 0.20 + swell * 0.6;
      tu['uHighlightSharpness']!.value = 48.0 + audio.high * 28.0;
      this.cameraLight.intensity = 1.3 + audio.low * 0.35 + audio.beat * 0.30 + swell * 0.7;
      this.leftCavernLight.intensity = 3.6 + audio.low * 0.9 + audio.beat * 0.4 + swell * 1.2;
      this.rightCavernLight.intensity = 3.6 + audio.mid * 0.9 + swell * 1.2;
      this.deepCavernLight.intensity = 3.8 + audio.high * 1.0 + audio.beat * 0.4 + swell * 1.2;
    } else {
      tu['uEmissiveIntensity']!.value = 1.4 + swell * 0.6;
      tu['uHighlightSharpness']!.value = 48.0;
      this.cameraLight.intensity = 1.3 + swell * 0.7;
      this.leftCavernLight.intensity = 3.6 + swell * 1.2;
      this.rightCavernLight.intensity = 3.6 + swell * 1.2;
      this.deepCavernLight.intensity = 3.8 + swell * 1.2;
    }

    this.leftCavernLight.position.z = this.camera.position.z - 14.0;
    this.rightCavernLight.position.z = this.camera.position.z - 28.0;

    // 2. Cavern Rock Arch Ribs (Stationary orientation — sliding forward)
    for (let a = 0; a < GATEWAY_COUNT; a++) {
      let az = (this.gatewayZ[a] ?? -108) + forwardDist;
      if (az > 4.0) {
        az -= TOTAL_SPAN;
      }
      this.gatewayZ[a] = az;

      this.dummy.position.set(0, 0, az);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.gatewayMesh.setMatrixAt(a, this.dummy.matrix);
    }
    this.gatewayMesh.instanceMatrix.needsUpdate = true;

    // 3. Side Rock Bank Amethyst Clusters
    for (let s = 0; s < CLUSTER_COUNT; s++) {
      let sz = (this.clusterZ[s] ?? -108) + forwardDist;
      if (sz > 4.0) {
        sz -= TOTAL_SPAN;
      }
      this.clusterZ[s] = sz;

      const sx = this.clusterX[s] ?? 0;
      const sy = this.clusterY[s] ?? -2.35;
      const rx = this.clusterRotX[s] ?? 0;
      const ry = this.clusterRotY[s] ?? 0;
      const rz = this.clusterRotZ[s] ?? 0;
      const sc = this.clusterScale[s] ?? 1.0;

      this.dummy.position.set(sx, sy, sz);
      this.dummy.rotation.set(rx, ry, rz);
      this.dummy.scale.set(sc, sc, sc);
      this.dummy.updateMatrix();
      this.clusterMesh.setMatrixAt(s, this.dummy.matrix);
    }
    this.clusterMesh.instanceMatrix.needsUpdate = true;

    // 4. Ceiling Quartz Stalactites
    for (let k = 0; k < STALACTITE_COUNT; k++) {
      let kz = (this.stalactiteZ[k] ?? -108) + forwardDist;
      if (kz > 4.0) {
        kz -= TOTAL_SPAN;
      }
      this.stalactiteZ[k] = kz;

      const kx = this.stalactiteX[k] ?? 0;
      const ky = this.stalactiteY[k] ?? 4.8;
      const sc = this.stalactiteScale[k] ?? 1.0;

      this.dummy.position.set(kx, ky, kz);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(sc, sc, sc);
      this.dummy.updateMatrix();
      this.stalactiteMesh.setMatrixAt(k, this.dummy.matrix);
    }
    this.stalactiteMesh.instanceMatrix.needsUpdate = true;

    // 5. Luminous Gem Prisms (Slow gentle floating tumble near walls)
    for (let g = 0; g < SHARD_COUNT; g++) {
      let gz = (this.shardZ[g] ?? -108) + forwardDist;
      if (gz > 4.0) {
        gz -= TOTAL_SPAN;
      }
      this.shardZ[g] = gz;

      const sx = this.shardX[g] ?? 4.0;
      const sy = this.shardY[g] ?? 1.0;

      const rx = (this.shardRotX[g] ?? 0) + (this.shardSpinX[g] ?? 0.2) * dt;
      const ry = (this.shardRotY[g] ?? 0) + (this.shardSpinY[g] ?? 0.2) * dt;
      const rz = (this.shardRotZ[g] ?? 0) + dt * 0.12;
      this.shardRotX[g] = rx;
      this.shardRotY[g] = ry;
      this.shardRotZ[g] = rz;

      const sc = this.shardScale[g] ?? 1.0;

      this.dummy.position.set(sx, sy, gz);
      this.dummy.rotation.set(rx, ry, rz);
      this.dummy.scale.set(sc, sc, sc);
      this.dummy.updateMatrix();
      this.shardMesh.setMatrixAt(g, this.dummy.matrix);
    }
    this.shardMesh.instanceMatrix.needsUpdate = true;

    // 6. Particles
    this.particleMaterial.uniforms['uTime']!.value = elapsed;

    // 7. Camera Motion: Serene, meditative gliding along open central avenue
    const camX = Math.sin(elapsed * 0.08) * 0.14;
    const camY = -0.15 + Math.cos(elapsed * 0.06) * 0.09;
    this.camera.position.x = camX;
    this.camera.position.y = camY;
    this.camera.rotation.z = Math.sin(elapsed * 0.05) * 0.012;
    this.camera.lookAt(camX * 0.25, -0.15, -45);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  applyPalette(palette: PaletteDefinition, t: number, prev?: PaletteDefinition): void {
    this.palette = palette;
    const lerp = (a: [number, number, number], b: [number, number, number]) => lerpVec3(a, b, t);
    const from = prev ?? palette;

    const tu = this.tunnelMaterial.uniforms;
    tu['uWallBase']!.value     = lerp(from.wallBase,     palette.wallBase);
    tu['uWallEmissive']!.value = lerp(from.wallEmissive, palette.wallEmissive);
    tu['uHighlight']!.value    = lerp(from.highlight,    palette.highlight);
    tu['uFogNear']!.value      = lerp(from.fog,          palette.fog);
    tu['uFogFar']!.value       = lerp(from.fogFar,       palette.fogFar);

    this.particleMaterial.uniforms['uParticleColor']!.value = lerp(from.particle, palette.particle);

    const curHighlight = lerp(from.highlight, palette.highlight);
    this.deepCavernLight.color.setRGB(curHighlight.x, curHighlight.y, curHighlight.z);
  }

  applyVisualParams(params: VisualParams): void {
    this.params = params;
  }

  triggerEffect(effectName: string): void {
    if (effectName === 'sparkle_wave' || effectName === 'constellation_flash') {
      this.effectGlow = 1.0;
    }
  }

  dispose(): void {
    this.tunnelMesh.geometry.dispose();
    this.tunnelMaterial.dispose();

    this.floorMesh.geometry.dispose();
    this.floorMaterial.dispose();

    this.gatewayMesh.geometry.dispose();
    this.gatewayMaterial.dispose();

    this.clusterMesh.geometry.dispose();
    this.clusterMaterial.dispose();

    this.stalactiteMesh.geometry.dispose();
    this.stalactiteMaterial.dispose();

    this.shardMesh.geometry.dispose();
    this.shardMaterial.dispose();

    this.godRayTexture.dispose();
    this.godRayMaterial.dispose();
    for (const child of this.godRayGroup.children) {
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    }

    this.particleGeo.dispose();
    this.particleMaterial.dispose();

    this.scene.clear();
  }
}
