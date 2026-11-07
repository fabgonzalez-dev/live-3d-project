/**
 * scenes/AuroraPassageScene.ts
 * Aurora Passage — The Midnight Mountain Highway beneath the Northern Lights.
 *
 * Implements:
 * - Curving procedural highway along RoadSpline with double-yellow center stripes,
 *   tire ruts, and snowy asphalt shoulders.
 * - Seamless flanking snow terrain with raised plowed snowbanks (berms) and rolling hills
 *   fully anchored to the road spline (zero gaps, zero separation).
 * - Rock-solid driver POV camera tracking the right lane with smooth curvature look-ahead
 *   and orthonormal banking roll (zero jumping, zero pitch/yaw snapping).
 * - 4 distinct procedural alpine tree archetypes (Grand Pine, Gnarly Twisted Pine, Slender Fir,
 *   Roadside Snow Shrub) generated with twisting trunks, drooping bough tiers, and vertex-colored snow.
 * - Mathematically continuous infinite streaming for trees and reflector guideposts (zero pop/jitter).
 * - 5 organic, domain-warped GPU-driven aurora curtains with radiant vertical folds.
 * - Multi-tiered alpine mountain silhouettes and radiant horizon glow.
 * - Zero per-frame allocation.
 */

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import type { SceneLifecycle } from './SceneLifecycle';
import type { VisualParams, PaletteDefinition } from '../state/types';
import type { AudioBands } from '../audio/AudioAnalyser';
import { DEFAULT_VISUAL } from '../state/types';
import { PALETTES } from '../state/palettes';
import { RoadSpline } from '../procedural/RoadSpline';
import {
  createGrandAlpinePineGeometry,
  createGnarlyTwistedPineGeometry,
  createSlenderFirGeometry,
  createRoadsideSnowShrubGeometry,
} from '../procedural/AlpineTreeGenerator';

import auroraVert from '../shaders/auroraVertex.glsl?raw';
import auroraFrag from '../shaders/auroraFragment.glsl?raw';
import particleVert from '../shaders/particleVertex.glsl?raw';
import particleFrag from '../shaders/particleFragment.glsl?raw';

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

/** High-res asphalt highway canvas texture matching TARGET_03-04 */
function createHighwayTexture(): THREE.Texture {
  if (typeof document === 'undefined') return new THREE.Texture();
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  // Dark charcoal asphalt road surface
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 1024, 2048);

  // Wheel rut wear paths (darker, smoother specular tracks)
  ctx.fillStyle = '#090e1a';
  ctx.fillRect(170, 0, 200, 2048);
  ctx.fillRect(654, 0, 200, 2048);

  // Outer snow dust encroaching from shoulders
  ctx.fillStyle = 'rgba(214, 238, 248, 0.18)';
  ctx.fillRect(0, 0, 110, 2048);
  ctx.fillRect(914, 0, 110, 2048);

  // Crisp white/cyan shoulder lines
  ctx.fillStyle = '#bae6fd';
  ctx.fillRect(110, 0, 16, 2048);
  ctx.fillRect(898, 0, 16, 2048);

  // Double yellow center stripes with gap
  ctx.fillStyle = '#facc15';
  ctx.fillRect(495, 0, 14, 2048);
  ctx.fillRect(515, 0, 14, 2048);

  // Center snow dusting between tire ruts
  ctx.fillStyle = 'rgba(214, 238, 248, 0.08)';
  ctx.fillRect(430, 0, 164, 2048);

  // Surface asphalt grain noise
  const imgData = ctx.getImageData(0, 0, 1024, 2048);
  const data = imgData.data;
  const rng = mulberry32(42);
  for (let i = 0; i < data.length; i += 4) {
    const n = (rng() - 0.5) * 14;
    data[i]     = Math.max(0, Math.min(255, (data[i] ?? 0) + n));
    data[i + 1] = Math.max(0, Math.min(255, (data[i + 1] ?? 0) + n));
    data[i + 2] = Math.max(0, Math.min(255, (data[i + 2] ?? 0) + n));
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  texture.generateMipmaps = true;
  return texture;
}

/** Radiant celestial horizon glow rising through mountain pass */
function createHorizonGlowTexture(): THREE.Texture {
  if (typeof document === 'undefined') return new THREE.Texture();
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  const grad = ctx.createRadialGradient(256, 512, 6, 256, 512, 460);
  grad.addColorStop(0.00, '#ffffff'); // Radiant white-hot core
  grad.addColorStop(0.12, '#e0f2fe'); // Sky luminance
  grad.addColorStop(0.32, '#38bdf8'); // Cyan aura
  grad.addColorStop(0.55, 'rgba(14, 165, 233, 0.50)');
  grad.addColorStop(0.78, 'rgba(3, 105, 161, 0.16)');
  grad.addColorStop(1.00, 'rgba(0, 0, 0, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  return texture;
}

const ROAD_LENGTH = 180;
const ROAD_SEGMENTS = 140;
const ROAD_WIDTH = 6.8;

const TERRAIN_SEGS_Z = 70;
const TERRAIN_SEGS_X = 14;
const TERRAIN_WIDTH = 45;

const POST_COUNT = 56;
const TREE_COUNT_PER_TYPE = 40; // 4 types * 40 = 160 rich trees

export class AuroraPassageScene implements SceneLifecycle {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  // Road spline engine & travel distance
  private readonly roadSpline = new RoadSpline();
  private travelZ = 0;

  // Dynamic road ribbon
  private roadMesh!: THREE.Mesh;
  private roadGeo!: THREE.BufferGeometry;
  private roadTexture!: THREE.Texture;
  private roadMaterial!: THREE.MeshStandardMaterial;

  // Seamless flanking snow terrain meshes
  private terrainLeftMesh!: THREE.Mesh;
  private terrainLeftGeo!: THREE.BufferGeometry;
  private terrainRightMesh!: THREE.Mesh;
  private terrainRightGeo!: THREE.BufferGeometry;
  private terrainMaterial!: THREE.MeshStandardMaterial;

  // Layered background mountains & horizon glow
  private farMountainMesh!: THREE.Mesh;
  private midMountainMesh!: THREE.Mesh;
  private mountainMaterial!: THREE.MeshStandardMaterial;
  private horizonGlowMesh!: THREE.Mesh;
  private horizonGlowMat!: THREE.MeshBasicMaterial;
  private horizonGlowTexture!: THREE.Texture;

  // Roadside reflector guideposts
  private postMesh!: THREE.InstancedMesh;
  private postMaterial!: THREE.MeshBasicMaterial;
  private postZ0 = new Float32Array(POST_COUNT);
  private postSide = new Float32Array(POST_COUNT);

  // 4 Archetypes of Procedural Alpine Trees (Instanced & Vertex-Colored)
  private treeMeshes: THREE.InstancedMesh[] = [];
  private treeMaterial!: THREE.MeshStandardMaterial;
  private treeZ0: Float32Array[] = [];
  private treeLat: Float32Array[] = [];
  private treeScale: Float32Array[] = [];
  private treeRotY: Float32Array[] = [];

  // 5 Overhead Aurora Curtains
  private ribbons: THREE.Mesh[] = [];
  private ribbonMaterials: THREE.ShaderMaterial[] = [];
  private ribbonGeos: THREE.BufferGeometry[] = [];

  // Stars & Shooting Star
  private starPoints!: THREE.Points;
  private starMaterial!: THREE.ShaderMaterial;
  private starGeo!: THREE.BufferGeometry;
  private meteorMesh!: THREE.Mesh;
  private meteorMaterial!: THREE.MeshBasicMaterial;
  private meteorTime = 0;
  private starTime = 0;

  // Lighting
  private ambientLight!: THREE.AmbientLight;
  private auroraLight!: THREE.DirectionalLight;
  private headlightLeft!: THREE.PointLight;
  private headlightRight!: THREE.PointLight;

  // Reusable temporaries for zero garbage
  private readonly dummy = new THREE.Object3D();
  private readonly camUp = new THREE.Vector3();

  private params: VisualParams;
  private palette: PaletteDefinition;

  constructor(params?: VisualParams, paletteId?: string) {
    this.params = params ?? { ...DEFAULT_VISUAL };
    this.palette = PALETTES[paletteId ?? 'teal-cyan'] ?? PALETTES['teal-cyan']!;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x01030a);
    this.scene.fog = new THREE.FogExp2(0x020510, 0.0075);

    // Natural 70° FOV for mountain highway cruising
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 260);
    this.camera.position.set(0.85, 1.35, 0);
  }

  initialize(): void {
    this._setupLighting();
    this._buildSplineRoad();
    this._buildFlankingTerrain();
    this._buildHorizonGlow();
    this._buildLayeredMountains();
    this._buildReflectorPosts();
    this._buildProceduralAlpineForest();
    this._buildCurtains();
    this._buildStars();
    this._buildMeteor();
  }

  private _setupLighting(): void {
    // Ambient moonlight fill so trees and snow have visible form
    this.ambientLight = new THREE.AmbientLight(0x1a2b42, 1.7);

    // Directional aurora illumination
    this.auroraLight = new THREE.DirectionalLight(
      new THREE.Color(...this.palette.highlight),
      1.3,
    );
    this.auroraLight.position.set(0, 45, -35);

    // Vehicle headlights illuminating the roadway and snowbanks
    this.headlightLeft = new THREE.PointLight(0xfffaed, 3.6, 65, 1.1);
    this.headlightLeft.position.set(0.0, 0.85, 0.8);

    this.headlightRight = new THREE.PointLight(0xfffaed, 3.6, 65, 1.1);
    this.headlightRight.position.set(1.7, 0.85, 0.8);

    this.scene.add(this.ambientLight);
    this.scene.add(this.auroraLight);
    this.scene.add(this.headlightLeft);
    this.scene.add(this.headlightRight);
  }

  private _buildSplineRoad(): void {
    const halfW = ROAD_WIDTH * 0.5;

    const positions = new Float32Array((ROAD_SEGMENTS + 1) * 2 * 3);
    const uvs = new Float32Array((ROAD_SEGMENTS + 1) * 2 * 2);
    const indices: number[] = [];

    for (let i = 0; i <= ROAD_SEGMENTS; i++) {
      const v = i / ROAD_SEGMENTS;

      // UVs: X across road (0..1), Y along length (0..26)
      uvs[i * 4 + 0] = 0;
      uvs[i * 4 + 1] = v * 26;
      uvs[i * 4 + 2] = 1;
      uvs[i * 4 + 3] = v * 26;

      if (i < ROAD_SEGMENTS) {
        const row1 = i * 2;
        const row2 = (i + 1) * 2;
        // Upward winding order (+Y normal)
        indices.push(row1, row1 + 1, row2);
        indices.push(row1 + 1, row2 + 1, row2);
      }
    }

    this.roadGeo = new THREE.BufferGeometry();
    this.roadGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.roadGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    this.roadGeo.setIndex(indices);

    this.roadTexture = createHighwayTexture();
    this.roadMaterial = new THREE.MeshStandardMaterial({
      map: this.roadTexture,
      roughness: 0.80,
      metalness: 0.12,
      side: THREE.DoubleSide,
    });

    this.roadMesh = new THREE.Mesh(this.roadGeo, this.roadMaterial);
    this.scene.add(this.roadMesh);
  }

  private _buildFlankingTerrain(): void {
    this.terrainMaterial = new THREE.MeshStandardMaterial({
      color: 0x142338, // Cold alpine snow crust catching celestial sky
      roughness: 0.88,
      metalness: 0.04,
      side: THREE.DoubleSide,
    });

    // Helper to create grid buffer geometry for a terrain flank
    const createFlankGeo = () => {
      const vertCount = (TERRAIN_SEGS_Z + 1) * (TERRAIN_SEGS_X + 1);
      const positions = new Float32Array(vertCount * 3);
      const indices: number[] = [];

      for (let iz = 0; iz < TERRAIN_SEGS_Z; iz++) {
        for (let ix = 0; ix < TERRAIN_SEGS_X; ix++) {
          const a = iz * (TERRAIN_SEGS_X + 1) + ix;
          const b = a + 1;
          const c = (iz + 1) * (TERRAIN_SEGS_X + 1) + ix;
          const d = c + 1;
          indices.push(a, b, c);
          indices.push(b, d, c);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setIndex(indices);
      return geo;
    };

    this.terrainLeftGeo = createFlankGeo();
    this.terrainLeftMesh = new THREE.Mesh(this.terrainLeftGeo, this.terrainMaterial);
    this.scene.add(this.terrainLeftMesh);

    this.terrainRightGeo = createFlankGeo();
    this.terrainRightMesh = new THREE.Mesh(this.terrainRightGeo, this.terrainMaterial);
    this.scene.add(this.terrainRightMesh);
  }

  private _updateRoadAndTerrainGeometry(travelDist: number): void {
    const halfW = ROAD_WIDTH * 0.5;

    // 1. Update Road Ribbon
    const roadPos = this.roadGeo.attributes['position'] as THREE.BufferAttribute;
    for (let i = 0; i <= ROAD_SEGMENTS; i++) {
      const v = i / ROAD_SEGMENTS;
      const zLocal = 10 - v * ROAD_LENGTH;
      const zWorld = -travelDist + zLocal;

      const frame = this.roadSpline.getFrameAt(zWorld);

      // Left road edge (+0.03 offset to sit flush on terrain)
      const lx = frame.position.x - frame.binormal.x * halfW;
      const ly = frame.position.y - frame.binormal.y * halfW + 0.03;
      roadPos.setXYZ(i * 2 + 0, lx, ly, zLocal);

      // Right road edge
      const rx = frame.position.x + frame.binormal.x * halfW;
      const ry = frame.position.y + frame.binormal.y * halfW + 0.03;
      roadPos.setXYZ(i * 2 + 1, rx, ry, zLocal);
    }
    roadPos.needsUpdate = true;
    this.roadGeo.computeVertexNormals();

    if (this.roadTexture) {
      this.roadTexture.offset.y = (travelDist * 0.08) % 1.0;
    }

    // 2. Update Left Snow Flank (Anchored seamlessly from road edge outward)
    const leftPos = this.terrainLeftGeo.attributes['position'] as THREE.BufferAttribute;
    let ptrL = 0;
    for (let iz = 0; iz <= TERRAIN_SEGS_Z; iz++) {
      const v = iz / TERRAIN_SEGS_Z;
      const zLocal = 10 - v * ROAD_LENGTH;
      const zWorld = -travelDist + zLocal;
      const frame = this.roadSpline.getFrameAt(zWorld);

      for (let ix = 0; ix <= TERRAIN_SEGS_X; ix++) {
        const u = ix / TERRAIN_SEGS_X;
        // Non-linear distribution: dense vertices near road edge / snowbank
        const latDist = halfW - 0.15 + Math.pow(u, 1.35) * TERRAIN_WIDTH;
        const vx = frame.position.x - frame.binormal.x * latDist;
        const vy = this.roadSpline.getTerrainHeight(vx, zWorld, ROAD_WIDTH);

        leftPos.setXYZ(ptrL++, vx, vy, zLocal);
      }
    }
    leftPos.needsUpdate = true;
    this.terrainLeftGeo.computeVertexNormals();

    // 3. Update Right Snow Flank
    const rightPos = this.terrainRightGeo.attributes['position'] as THREE.BufferAttribute;
    let ptrR = 0;
    for (let iz = 0; iz <= TERRAIN_SEGS_Z; iz++) {
      const v = iz / TERRAIN_SEGS_Z;
      const zLocal = 10 - v * ROAD_LENGTH;
      const zWorld = -travelDist + zLocal;
      const frame = this.roadSpline.getFrameAt(zWorld);

      for (let ix = 0; ix <= TERRAIN_SEGS_X; ix++) {
        const u = ix / TERRAIN_SEGS_X;
        const latDist = halfW - 0.15 + Math.pow(u, 1.35) * TERRAIN_WIDTH;
        const vx = frame.position.x + frame.binormal.x * latDist;
        const vy = this.roadSpline.getTerrainHeight(vx, zWorld, ROAD_WIDTH);

        rightPos.setXYZ(ptrR++, vx, vy, zLocal);
      }
    }
    rightPos.needsUpdate = true;
    this.terrainRightGeo.computeVertexNormals();
  }

  private _buildHorizonGlow(): void {
    this.horizonGlowTexture = createHorizonGlowTexture();
    const width = 100;
    const height = 52;
    const geo = new THREE.PlaneGeometry(width, height);
    geo.translate(0, height / 2, 0);

    this.horizonGlowMat = new THREE.MeshBasicMaterial({
      map: this.horizonGlowTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    this.horizonGlowMesh = new THREE.Mesh(geo, this.horizonGlowMat);
    this.horizonGlowMesh.position.set(0, 0.2, -170);
    this.scene.add(this.horizonGlowMesh);
  }

  private _buildLayeredMountains(): void {
    this.mountainMaterial = new THREE.MeshStandardMaterial({
      color: 0x050d1a,
      roughness: 0.95,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });

    // Far alpine peaks
    const farWidth = 260;
    const farHeight = 56;
    const farGeo = new THREE.PlaneGeometry(farWidth, farHeight, 90, 20);
    const farPos = farGeo.attributes['position'] as THREE.BufferAttribute;
    const rng = mulberry32(101);

    for (let i = 0; i < farPos.count; i++) {
      const x = farPos.getX(i);
      const y = farPos.getY(i);
      const vNorm = (y + farHeight / 2) / farHeight;
      if (vNorm > 0.05) {
        const absX = Math.abs(x);
        const passFactor = Math.min(1.0, Math.pow(absX / 26.0, 1.3));
        const ridge = Math.abs(Math.sin(x * 0.065) * 9.0 + Math.sin(x * 0.15) * 4.2 + (rng() - 0.5) * 2.2);
        farPos.setY(i, y + ridge * passFactor * vNorm);
      }
    }
    farGeo.computeVertexNormals();
    this.farMountainMesh = new THREE.Mesh(farGeo, this.mountainMaterial);
    this.farMountainMesh.position.set(0, 0, -168);
    this.scene.add(this.farMountainMesh);

    // Mid mountain ridge with valley pass
    const midWidth = 220;
    const midHeight = 42;
    const midGeo = new THREE.PlaneGeometry(midWidth, midHeight, 72, 16);
    const midPos = midGeo.attributes['position'] as THREE.BufferAttribute;

    for (let i = 0; i < midPos.count; i++) {
      const x = midPos.getX(i);
      const y = midPos.getY(i);
      const vNorm = (y + midHeight / 2) / midHeight;
      if (vNorm > 0.05) {
        const absX = Math.abs(x);
        const passFactor = Math.min(1.0, Math.pow(absX / 22.0, 1.4));
        const ridge = Math.sin(x * 0.045) * 6.0 + Math.cos(x * 0.10) * 3.0;
        midPos.setY(i, y + ridge * passFactor * vNorm);
      }
    }
    midGeo.computeVertexNormals();
    this.midMountainMesh = new THREE.Mesh(midGeo, this.mountainMaterial);
    this.midMountainMesh.position.set(0, -1.2, -156);
    this.scene.add(this.midMountainMesh);
  }

  private _buildReflectorPosts(): void {
    const postGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.9, 5);
    postGeo.translate(0, 0.45, 0);

    const marker = new THREE.BoxGeometry(0.06, 0.12, 0.03);
    marker.translate(0, 0.75, 0.02);

    const merged = BufferGeometryUtils.mergeGeometries([postGeo, marker]);
    postGeo.dispose();
    marker.dispose();

    this.postMaterial = new THREE.MeshBasicMaterial({ color: 0x7dd3fc });
    this.postMesh = new THREE.InstancedMesh(merged, this.postMaterial, POST_COUNT);

    for (let i = 0; i < POST_COUNT; i++) {
      this.postZ0[i] = (i / POST_COUNT) * ROAD_LENGTH;
      this.postSide[i] = i % 2 === 0 ? 1 : -1;
    }
    this.scene.add(this.postMesh);
  }

  private _buildProceduralAlpineForest(): void {
    // Shared PBR material with vertex-colors for bark, needles, and snow
    this.treeMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.82,
      metalness: 0.04,
      emissive: 0x051a12,
      emissiveIntensity: 0.35,
    });

    // 4 distinct procedural archetypes
    const archetypes = [
      createGrandAlpinePineGeometry(101),
      createGnarlyTwistedPineGeometry(202),
      createSlenderFirGeometry(303),
      createRoadsideSnowShrubGeometry(404),
    ];

    const rng = mulberry32(888);

    for (let typeIdx = 0; typeIdx < 4; typeIdx++) {
      const geo = archetypes[typeIdx]!;
      const mesh = new THREE.InstancedMesh(geo, this.treeMaterial, TREE_COUNT_PER_TYPE);

      const z0 = new Float32Array(TREE_COUNT_PER_TYPE);
      const lat = new Float32Array(TREE_COUNT_PER_TYPE);
      const scale = new Float32Array(TREE_COUNT_PER_TYPE);
      const rotY = new Float32Array(TREE_COUNT_PER_TYPE);

      for (let i = 0; i < TREE_COUNT_PER_TYPE; i++) {
        // Staggered longitudinal base position
        z0[i] = ((i + rng() * 0.8) / TREE_COUNT_PER_TYPE) * ROAD_LENGTH;

        const side = (i + typeIdx) % 2 === 0 ? 1 : -1;

        if (typeIdx === 3) {
          // Shrubs cluster close along the snowbanks
          lat[i] = side * (4.8 + rng() * 3.5);
          scale[i] = 0.85 + rng() * 0.45;
        } else if (typeIdx === 0) {
          // Grand pines stand in majestic roadside groves
          lat[i] = side * (6.5 + rng() * 24.0);
          scale[i] = 1.05 + rng() * 0.55;
        } else if (typeIdx === 1) {
          // Gnarly twisted pines on rolling slopes
          lat[i] = side * (7.5 + rng() * 26.0);
          scale[i] = 0.95 + rng() * 0.50;
        } else {
          // Slender firs fill out the mid-to-far treeline
          lat[i] = side * (12.0 + rng() * 32.0);
          scale[i] = 1.10 + rng() * 0.60;
        }

        rotY[i] = rng() * Math.PI * 2;
      }

      this.treeMeshes.push(mesh);
      this.treeZ0.push(z0);
      this.treeLat.push(lat);
      this.treeScale.push(scale);
      this.treeRotY.push(rotY);

      this.scene.add(mesh);
    }
  }

  private _buildCurtains(): void {
    const layerCount = 5;
    const curtainWidth = 140;
    const curtainHeight = 32;

    for (let i = 0; i < layerCount; i++) {
      const geo = new THREE.PlaneGeometry(curtainWidth, curtainHeight, 90, 40);

      const count = geo.attributes['position']!.count;
      const layerAttr = new Float32Array(count);
      layerAttr.fill(i);
      geo.setAttribute('aCurtainIndex', new THREE.BufferAttribute(layerAttr, 1));

      // Serpentine curve
      const pos = geo.attributes['position'] as THREE.BufferAttribute;
      for (let j = 0; j < count; j++) {
        const x = pos.getX(j);
        pos.setZ(j, Math.sin(x * 0.065 + i * 1.35) * 6.0);
      }
      pos.needsUpdate = true;

      // Spectral ramp: emerald green base -> cyan mid -> magenta/violet crown
      const mat = new THREE.ShaderMaterial({
        vertexShader: auroraVert,
        fragmentShader: auroraFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: {
          uTime:       { value: 0 },
          uWaveSpeed:  { value: 0.16 + i * 0.03 },
          uWaveAmp:    { value: 1.5 + i * 0.22 },
          uColorBase:  { value: new THREE.Vector3(0.18, 0.85, 0.45) }, // Radiant emerald green
          uColorMid:   { value: new THREE.Vector3(0.15, 0.78, 0.95) }, // Celestial cyan
          uColorTop:   { value: new THREE.Vector3(0.82, 0.28, 0.95) }, // High-altitude violet
          uIntensity:  { value: 0.82 },
        },
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set((i % 2 === 0 ? -4.0 : 4.0), 24.0 + i * 3.2, -40 - i * 24);
      mesh.rotation.x = -0.22;
      mesh.rotation.y = (i % 2 === 0 ? 0.035 : -0.035);

      this.ribbons.push(mesh);
      this.ribbonMaterials.push(mat);
      this.ribbonGeos.push(geo);
      this.scene.add(mesh);
    }
  }

  private _buildStars(): void {
    const starCount = 2800;
    const positions = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    const phases = new Float32Array(starCount);
    const brightness = new Float32Array(starCount);
    const layers = new Float32Array(starCount);
    const drifts = new Float32Array(starCount * 3);

    const rng = mulberry32(999);
    for (let i = 0; i < starCount; i++) {
      positions[i * 3 + 0] = (rng() - 0.5) * 160;
      positions[i * 3 + 1] = 8.0 + rng() * 60;
      positions[i * 3 + 2] = -rng() * 175;

      sizes[i] = 1.0 + rng() * 2.4;
      phases[i] = rng() * Math.PI * 2;
      brightness[i] = 0.55 + rng() * 0.45;
      layers[i] = rng() < 0.25 ? 0 : 1;

      drifts[i * 3 + 0] = (rng() - 0.5) * 0.001;
      drifts[i * 3 + 1] = (rng() - 0.5) * 0.001;
      drifts[i * 3 + 2] = (rng() - 0.5) * 0.001;
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
        uPointSizeMax:  { value: 36.0 },
        uParticleColor: { value: new THREE.Vector3(...this.palette.particle) },
      },
    });

    this.starGeo = geo;
    this.starMaterial = mat;
    this.starPoints = new THREE.Points(geo, mat);
    this.scene.add(this.starPoints);
  }

  private _buildMeteor(): void {
    const meteorGeo = new THREE.CylinderGeometry(0.04, 0.005, 8.0, 4);
    meteorGeo.rotateZ(Math.PI / 4);

    this.meteorMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });

    this.meteorMesh = new THREE.Mesh(meteorGeo, this.meteorMaterial);
    this.meteorMesh.position.set(-25, 45, -75);
    this.scene.add(this.meteorMesh);
  }

  update(dt: number, elapsed: number, audio?: AudioBands): void {
    // Meditative cruising velocity with subtle long-term audio swell
    const audioSpeedMod = audio ? (audio.low * 0.12 + audio.longTermEnergy * 0.10) : 0;
    const cruiseSpeed = 4.2 + (this.params.travelSpeed + audioSpeedMod) * 4.8;
    this.travelZ += cruiseSpeed * dt;

    // 1. Update seamless road and flanking terrain geometries
    this._updateRoadAndTerrainGeometry(this.travelZ);

    // 2. Camera strictly pinned to driver right-lane POV
    const camWorldZ = -this.travelZ;
    const camFrame = this.roadSpline.getFrameAt(camWorldZ);
    const laneOffset = 0.85; // Natural right driving lane

    const camX = camFrame.position.x + camFrame.binormal.x * laneOffset;
    const camY = camFrame.position.y + 1.35; // Driver eye height
    this.camera.position.set(camX, camY, 0);

    // Look ahead down the curving right lane
    const lookAheadDist = 28.0;
    const targetWorldZ = camWorldZ - lookAheadDist;
    const targetFrame = this.roadSpline.getFrameAt(targetWorldZ);
    const targetX = targetFrame.position.x + targetFrame.binormal.x * laneOffset;
    const targetY = targetFrame.position.y + 1.25;
    const targetZ = -lookAheadDist;

    // Smooth banking roll via orthonormal camera.up
    const bankAngle = THREE.MathUtils.clamp(-camFrame.curvature * 0.22, -0.018, 0.018);
    this.camUp.set(Math.sin(bankAngle), Math.cos(bankAngle), 0).normalize();
    this.camera.up.copy(this.camUp);
    this.camera.lookAt(targetX, targetY, targetZ);

    // 3. Headlights follow camera frame with subtle musical breathing
    const headlightBoost = audio ? 1.0 + audio.low * 0.18 + audio.beat * 0.16 : 1.0;
    this.headlightLeft.intensity = 3.6 * headlightBoost;
    this.headlightRight.intensity = 3.6 * headlightBoost;
    this.headlightLeft.position.set(camX - 0.75, camY - 0.45, 0.6);
    this.headlightRight.position.set(camX + 0.75, camY - 0.45, 0.6);

    // 4. Roadside Reflector Guideposts (Continuous infinite streaming, zero pop/jitter)
    for (let k = 0; k < POST_COUNT; k++) {
      // Moves smoothly from -170m toward +10m, then wraps far ahead invisibly
      const zOffset = -170.0 + ((this.postZ0[k]! + this.travelZ) % ROAD_LENGTH);
      const worldZ = -this.travelZ + zOffset;
      const frame = this.roadSpline.getFrameAt(worldZ);
      const postX = frame.position.x + frame.binormal.x * (this.postSide[k]! * 3.65);
      const postY = frame.position.y + 0.04;

      this.dummy.position.set(postX, postY, zOffset);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.postMesh.setMatrixAt(k, this.dummy.matrix);
    }
    this.postMesh.instanceMatrix.needsUpdate = true;

    // 5. Procedural Alpine Trees (Continuous infinite streaming, zero pop/jitter)
    for (let typeIdx = 0; typeIdx < 4; typeIdx++) {
      const mesh = this.treeMeshes[typeIdx]!;
      const z0Arr = this.treeZ0[typeIdx]!;
      const latArr = this.treeLat[typeIdx]!;
      const scaleArr = this.treeScale[typeIdx]!;
      const rotYArr = this.treeRotY[typeIdx]!;

      for (let t = 0; t < TREE_COUNT_PER_TYPE; t++) {
        const zOffset = -170.0 + ((z0Arr[t]! + this.travelZ) % ROAD_LENGTH);
        const worldZ = -this.travelZ + zOffset;
        const frame = this.roadSpline.getFrameAt(worldZ);

        const treeX = frame.position.x + frame.binormal.x * latArr[t]!;
        const treeY = this.roadSpline.getTerrainHeight(treeX, worldZ, ROAD_WIDTH);
        const s = scaleArr[t]!;
        const rY = rotYArr[t]!;

        this.dummy.position.set(treeX, treeY, zOffset);
        this.dummy.rotation.set(0, rY, 0);
        this.dummy.scale.set(s, s, s);
        this.dummy.updateMatrix();
        mesh.setMatrixAt(t, this.dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    // 6. Update Sky Aurora Curtains (Organic undulating wave motion & fold brightness)
    const intensity = audio ? 0.82 + audio.mid * 0.35 + audio.longTermEnergy * 0.20 : 0.82;
    const waveBoost = audio ? 1.0 + audio.low * 0.25 + audio.beat * 0.18 : 1.0;
    const waveSpeedBoost = audio ? 1.0 + audio.mid * 0.30 : 1.0;

    for (const mat of this.ribbonMaterials) {
      mat.uniforms['uTime']!.value = elapsed;
      mat.uniforms['uWaveAmp']!.value = this.params.displacementAmp * 2.2 * waveBoost;
      mat.uniforms['uWaveSpeed']!.value = this.params.travelSpeed * 0.35 * waveSpeedBoost;
      mat.uniforms['uIntensity']!.value = intensity;
    }

    // 7. Stars & Sparkle (Scintillation speed responsive to high frequency shimmer)
    this.starTime += dt * (1.0 + (audio ? audio.high * 1.6 : 0.0));
    this.starMaterial.uniforms['uTime']!.value = this.starTime;

    // 8. Occasional Shooting Star / Meteor Streak
    this.meteorTime += dt * (audio && audio.longTermEnergy > 0.4 ? 1.3 : 1.0);
    if (this.meteorTime > 12.0) {
      const cycleT = this.meteorTime - 12.0;
      if (cycleT < 1.2) {
        const streakProg = cycleT / 1.2;
        this.meteorMesh.position.set(-30 + streakProg * 35, 48 - streakProg * 12, -80 + streakProg * 25);
        this.meteorMaterial.opacity = Math.sin(streakProg * Math.PI) * 0.85;
      } else {
        this.meteorMaterial.opacity = 0;
        this.meteorTime = 0;
      }
    }
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  applyPalette(palette: PaletteDefinition, t: number, prev?: PaletteDefinition): void {
    this.palette = palette;
    const from = prev ?? palette;
    const lerp = (a: [number, number, number], b: [number, number, number]) => lerpVec3(a, b, t);

    for (const mat of this.ribbonMaterials) {
      // Dynamic interpolation respecting spectral ramp
      const targetBase = lerp(from.highlight, palette.highlight);
      const targetMid  = lerp(from.wallEmissive, palette.wallEmissive);
      const targetTop  = lerp(from.wallBase, palette.wallBase);

      mat.uniforms['uColorBase']!.value.copy(targetBase);
      mat.uniforms['uColorMid']!.value.copy(targetMid);
      mat.uniforms['uColorTop']!.value.copy(targetTop);
    }

    this.starMaterial.uniforms['uParticleColor']!.value = lerp(from.particle, palette.particle);

    const curHighlight = lerp(from.highlight, palette.highlight);
    this.postMaterial.color.setRGB(curHighlight.x, curHighlight.y, curHighlight.z);
    this.auroraLight.color.setRGB(curHighlight.x * 0.85, curHighlight.y * 0.85, curHighlight.z * 0.85);
    this.horizonGlowMat.color.setRGB(
      0.65 + curHighlight.x * 0.35,
      0.65 + curHighlight.y * 0.35,
      0.65 + curHighlight.z * 0.35,
    );

    const curEmissive = lerp(from.wallEmissive, palette.wallEmissive);
    this.mountainMaterial.color.setRGB(
      0.03 + curEmissive.x * 0.02,
      0.04 + curEmissive.y * 0.02,
      0.08 + curEmissive.z * 0.03,
    );
  }

  applyVisualParams(params: VisualParams): void {
    this.params = params;
  }

  triggerEffect(effectName: string): void {
    if (effectName === 'sparkle_wave' || effectName === 'constellation_flash') {
      for (const mat of this.ribbonMaterials) {
        mat.uniforms['uIntensity']!.value = 1.6;
      }
      this.auroraLight.intensity = 3.8;
      window.setTimeout(() => {
        for (const mat of this.ribbonMaterials) {
          mat.uniforms['uIntensity']!.value = 0.82;
        }
        this.auroraLight.intensity = 1.3;
      }, 1600);
    }
  }

  dispose(): void {
    this.roadGeo.dispose();
    this.roadMaterial.dispose();
    if (this.roadTexture) this.roadTexture.dispose();

    this.terrainLeftGeo.dispose();
    this.terrainRightGeo.dispose();
    this.terrainMaterial.dispose();

    this.farMountainMesh.geometry.dispose();
    this.midMountainMesh.geometry.dispose();
    this.mountainMaterial.dispose();

    this.horizonGlowMesh.geometry.dispose();
    this.horizonGlowMat.dispose();
    if (this.horizonGlowTexture) this.horizonGlowTexture.dispose();

    this.postMesh.geometry.dispose();
    this.postMaterial.dispose();

    for (const mesh of this.treeMeshes) {
      mesh.geometry.dispose();
    }
    this.treeMaterial.dispose();

    for (const geo of this.ribbonGeos) geo.dispose();
    for (const mat of this.ribbonMaterials) mat.dispose();

    this.starGeo.dispose();
    this.starMaterial.dispose();

    this.meteorMesh.geometry.dispose();
    this.meteorMaterial.dispose();

    this.scene.clear();
  }
}
