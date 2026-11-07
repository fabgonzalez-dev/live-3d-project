/**
 * scenes/CosmicGardenScene.ts
 * Cosmic Garden — The Enchanted Megalith Portal Forest (TARGET_01–02).
 *
 * Implements:
 * - Ancient carved stone rune megalith portals with beveled rims, top keystone gem,
 *   embedded dual glowing power orbs, and moss overgrown crests.
 * - Ethereal swirling inner vortex membranes emitting radiant dimensional backlight.
 * - 4 distinct procedural ancient fantasy tree archetypes:
 *   Grandfather Trees (buttress roots, twisting limbs), Elder Twisted Trees,
 *   Canopy Pillar Trees, and Mossy Boulders.
 * - Rolling mossy terrain with sunken stone-step pathway and natural forest knolls.
 * - Volumetric sunbeam light shafts streaming through the forest canopy.
 * - 2,500 warm glowing firefly & spore particles drifting organically in 3D space.
 * - Mathematically continuous infinite streaming (zero pop/jitter).
 * - Zero per-frame memory allocation.
 */

import * as THREE from 'three';
import type { SceneLifecycle } from './SceneLifecycle';
import type { VisualParams, PaletteDefinition } from '../state/types';
import type { AudioBands } from '../audio/AudioAnalyser';
import { DEFAULT_VISUAL } from '../state/types';
import { PALETTES } from '../state/palettes';
import {
  createCarvedRunePortalGeometry,
  createAncientGrandfatherTreeGeometry,
  createElderTwistedTreeGeometry,
  createCanopyPillarTreeGeometry,
  createMossyBoulderGeometry,
  createAncientStoneStepGeometry,
} from '../procedural/AncientForestGenerator';

import vortexVert from '../shaders/portalVortexVertex.glsl?raw';
import vortexFrag from '../shaders/portalVortexFragment.glsl?raw';
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
  grad.addColorStop(0.15, 'rgba(240, 215, 255, 0.45)');
  grad.addColorStop(0.45, 'rgba(215, 185, 255, 0.75)');
  grad.addColorStop(0.80, 'rgba(180, 140, 240, 0.25)');
  grad.addColorStop(1.00, 'rgba(0, 0, 0, 0.0)');

  // Lateral softening
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

const FOREST_LENGTH = 190.0;
const PORTAL_COUNT = 5;       // Spaced every 38 meters
const STEP_COUNT = 55;         // Winding flagstone steps
const GRANDFATHER_COUNT = 28;  // Massive trees with buttress roots
const ELDER_COUNT = 32;        // Bending twisted trees
const PILLAR_COUNT = 40;       // Tall background canopy pillars
const BOULDER_COUNT = 36;      // Moss-covered rocks along path banks
const LOTUS_COUNT = 36;        // Bioluminescent ground blossoms

export class CosmicGardenScene implements SceneLifecycle {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  // Travel distance
  private travelZ = 0;

  // Rolling Mossy Forest Floor
  private groundMesh!: THREE.Mesh;
  private groundGeo!: THREE.BufferGeometry;
  private groundMaterial!: THREE.MeshStandardMaterial;

  // Ancient Carved Stone Rune Portals & Vortex Membranes
  private portalMesh!: THREE.InstancedMesh;
  private portalMaterial!: THREE.MeshStandardMaterial;
  private portalZ0 = new Float32Array(PORTAL_COUNT);
  private vortexMeshes: THREE.Mesh[] = [];
  private vortexMaterials: THREE.ShaderMaterial[] = [];
  private vortexGeos: THREE.BufferGeometry[] = [];

  // Ancient Pathway Stone Steps
  private stepMesh!: THREE.InstancedMesh;
  private stepMaterial!: THREE.MeshStandardMaterial;
  private stepZ0 = new Float32Array(STEP_COUNT);

  // Procedural Ancient Trees (Instanced & Vertex-Colored)
  private grandfatherMesh!: THREE.InstancedMesh;
  private grandfatherZ0 = new Float32Array(GRANDFATHER_COUNT);
  private grandfatherLat = new Float32Array(GRANDFATHER_COUNT);
  private grandfatherScale = new Float32Array(GRANDFATHER_COUNT);
  private grandfatherRotY = new Float32Array(GRANDFATHER_COUNT);

  private elderMesh!: THREE.InstancedMesh;
  private elderZ0 = new Float32Array(ELDER_COUNT);
  private elderLat = new Float32Array(ELDER_COUNT);
  private elderScale = new Float32Array(ELDER_COUNT);
  private elderRotY = new Float32Array(ELDER_COUNT);

  private pillarMesh!: THREE.InstancedMesh;
  private pillarZ0 = new Float32Array(PILLAR_COUNT);
  private pillarLat = new Float32Array(PILLAR_COUNT);
  private pillarScale = new Float32Array(PILLAR_COUNT);
  private pillarRotY = new Float32Array(PILLAR_COUNT);

  private treeMaterial!: THREE.MeshStandardMaterial;

  // Mossy Boulders
  private boulderMesh!: THREE.InstancedMesh;
  private boulderMaterial!: THREE.MeshStandardMaterial;
  private boulderZ0 = new Float32Array(BOULDER_COUNT);
  private boulderLat = new Float32Array(BOULDER_COUNT);
  private boulderScale = new Float32Array(BOULDER_COUNT);
  private boulderRotY = new Float32Array(BOULDER_COUNT);

  // Bioluminescent Lotus Ground Blossoms
  private lotusMesh!: THREE.InstancedMesh;
  private lotusMaterial!: THREE.MeshStandardMaterial;
  private lotusZ0 = new Float32Array(LOTUS_COUNT);
  private lotusLat = new Float32Array(LOTUS_COUNT);

  // Volumetric Sunbeam Light Shafts
  private godRayGroup = new THREE.Group();
  private godRayMaterial!: THREE.MeshBasicMaterial;
  private godRayTexture!: THREE.Texture;

  // Fireflies & Spores
  private spores!: THREE.Points;
  private sporeGeo!: THREE.BufferGeometry;
  private sporeMaterial!: THREE.ShaderMaterial;
  private sporeTime = 0;

  // Lighting
  private ambientLight!: THREE.AmbientLight;
  private pathLantern!: THREE.PointLight;
  private canopySunlight!: THREE.DirectionalLight;
  private portalGlowLights: THREE.PointLight[] = [];

  // Reusable dummy for zero per-frame allocation
  private readonly dummy = new THREE.Object3D();

  private params: VisualParams;
  private palette: PaletteDefinition;

  constructor(params?: VisualParams, paletteId?: string) {
    this.params = params ?? { ...DEFAULT_VISUAL };
    this.palette = PALETTES[paletteId ?? 'warm-amber'] ?? PALETTES['warm-amber']!;

    this.scene = new THREE.Scene();
    // Misty nocturnal violet/plum forest backdrop matching TARGET_01–02
    this.scene.background = new THREE.Color(0x0e0618);
    this.scene.fog = new THREE.FogExp2(0x11071c, 0.0095);

    // Natural 72° FOV for serene walking perspective
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 240);
    this.camera.position.set(0, 1.75, 0);
  }

  initialize(): void {
    this._setupLighting();
    this._buildRollingGround();
    this._buildStoneSteps();
    this._buildAncientPortals();
    this._buildHorizonGatewayGlow();
    this._buildAncientForest();
    this._buildMossyBoulders();
    this._buildLotusBlossoms();
    this._buildVolumetricGodRays();
    this._buildFireflies();
  }

  private _setupLighting(): void {
    // Richer ambient fill so stone carvings, tree bark, and moss have visible form
    this.ambientLight = new THREE.AmbientLight(0x3a2550, 2.4);

    // Forward path lantern illuminating stone steps and moss
    this.pathLantern = new THREE.PointLight(0xfffaed, 3.8, 48, 1.1);
    this.pathLantern.position.set(0, 1.8, 1.2);

    // Front-angled moonlight illuminating carved megalith faces and grandfather tree roots
    this.canopySunlight = new THREE.DirectionalLight(0xe9d5ff, 1.6);
    this.canopySunlight.position.set(-8, 22, 14);

    // Radiant portal backlight in the distance streaming forward through the opening
    const portalBacklight = new THREE.DirectionalLight(0xd8b4fe, 1.4);
    portalBacklight.position.set(0, 12, -75);

    this.scene.add(this.ambientLight);
    this.scene.add(this.pathLantern);
    this.scene.add(this.canopySunlight);
    this.scene.add(portalBacklight);

    // 2 localized portal glow lights
    for (let i = 0; i < 2; i++) {
      const pl = new THREE.PointLight(0xc084fc, 2.5, 28, 1.4);
      this.portalGlowLights.push(pl);
      this.scene.add(pl);
    }
  }

  /** Evaluates rolling mossy forest floor height */
  private _getGroundElevation(x: number, worldZ: number): number {
    const absX = Math.abs(x);
    // Sunken stone path corridor
    if (absX < 2.4) {
      return 0.04;
    }
    const bankDist = absX - 2.4;
    const bankT = Math.min(bankDist / 4.0, 1.0);
    // Rolling moss hummocks and knolls
    const knolls = Math.sin(x * 0.12 + worldZ * 0.04) * 0.75 +
                   Math.cos(x * 0.07 - worldZ * 0.06) * 0.55;
    return bankT * (0.35 + Math.max(0, knolls));
  }

  private _buildRollingGround(): void {
    const width = 110;
    const segsX = 40;
    const segsZ = 80;

    const geo = new THREE.PlaneGeometry(width, FOREST_LENGTH, segsX, segsZ);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes['position'] as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      pos.setY(i, this._getGroundElevation(vx, vz));
    }
    geo.computeVertexNormals();

    this.groundGeo = geo;
    this.groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x140b20, // Rich dark forest soil with moss undertones
      roughness: 0.92,
      metalness: 0.04,
      side: THREE.DoubleSide,
    });

    this.groundMesh = new THREE.Mesh(this.groundGeo, this.groundMaterial);
    this.groundMesh.position.set(0, 0, -FOREST_LENGTH / 2 + 10);
    this.scene.add(this.groundMesh);
  }

  private _buildStoneSteps(): void {
    const geo = createAncientStoneStepGeometry();

    this.stepMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.82,
      metalness: 0.05,
    });

    this.stepMesh = new THREE.InstancedMesh(geo, this.stepMaterial, STEP_COUNT);

    for (let i = 0; i < STEP_COUNT; i++) {
      this.stepZ0[i] = (i / STEP_COUNT) * FOREST_LENGTH;
    }
    this.scene.add(this.stepMesh);
  }

  private _buildAncientPortals(): void {
    const megalithGeo = createCarvedRunePortalGeometry(505);

    this.portalMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.70,
      metalness: 0.12,
      emissive: 0x160824,
      emissiveIntensity: 0.40,
      side: THREE.DoubleSide,
    });

    this.portalMesh = new THREE.InstancedMesh(megalithGeo, this.portalMaterial, PORTAL_COUNT);

    for (let i = 0; i < PORTAL_COUNT; i++) {
      this.portalZ0[i] = (i / PORTAL_COUNT) * FOREST_LENGTH;
    }
    this.scene.add(this.portalMesh);

    // Ethereal Swirling Vortex Membrane in each portal aperture
    const vortexGeo = new THREE.CircleGeometry(3.0, 48);

    for (let i = 0; i < PORTAL_COUNT; i++) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: vortexVert,
        fragmentShader: vortexFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: {
          uTime:       { value: 0 },
          uWaveAmp:    { value: 1.0 },
          uColorCore:  { value: new THREE.Vector3(1.0, 0.95, 1.0) }, // Luminous white-hot doorway
          uColorMid:   { value: new THREE.Vector3(...this.palette.highlight) },
          uColorRim:   { value: new THREE.Vector3(...this.palette.wallEmissive) },
          uIntensity:  { value: 0.88 },
        },
      });

      const mesh = new THREE.Mesh(vortexGeo, mat);
      mesh.position.set(0, 3.8, 0); // Positioned inside the megalith opening

      this.vortexMeshes.push(mesh);
      this.vortexMaterials.push(mat);
      this.vortexGeos.push(vortexGeo);
      this.scene.add(mesh);
    }
  }

  private _buildAncientForest(): void {
    this.treeMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.80,
      metalness: 0.05,
      emissive: 0x080410,
      emissiveIntensity: 0.30,
    });

    const rng = mulberry32(777);

    // 1. Grandfather Trees (massive buttress roots)
    const gfGeo = createAncientGrandfatherTreeGeometry(101);
    this.grandfatherMesh = new THREE.InstancedMesh(gfGeo, this.treeMaterial, GRANDFATHER_COUNT);
    for (let i = 0; i < GRANDFATHER_COUNT; i++) {
      this.grandfatherZ0[i] = ((i + rng() * 0.6) / GRANDFATHER_COUNT) * FOREST_LENGTH;
      const side = i % 2 === 0 ? 1 : -1;
      this.grandfatherLat[i] = side * (6.8 + rng() * 22.0);
      this.grandfatherScale[i] = 1.0 + rng() * 0.45;
      this.grandfatherRotY[i] = rng() * Math.PI * 2;
    }
    this.scene.add(this.grandfatherMesh);

    // 2. Elder Twisted Trees
    const elderGeo = createElderTwistedTreeGeometry(202);
    this.elderMesh = new THREE.InstancedMesh(elderGeo, this.treeMaterial, ELDER_COUNT);
    for (let i = 0; i < ELDER_COUNT; i++) {
      this.elderZ0[i] = ((i + rng() * 0.7) / ELDER_COUNT) * FOREST_LENGTH;
      const side = i % 2 === 0 ? -1 : 1;
      this.elderLat[i] = side * (5.5 + rng() * 26.0);
      this.elderScale[i] = 0.95 + rng() * 0.40;
      this.elderRotY[i] = rng() * Math.PI * 2;
    }
    this.scene.add(this.elderMesh);

    // 3. Canopy Pillar Trees (background dense woods)
    const pillarGeo = createCanopyPillarTreeGeometry(303);
    this.pillarMesh = new THREE.InstancedMesh(pillarGeo, this.treeMaterial, PILLAR_COUNT);
    for (let i = 0; i < PILLAR_COUNT; i++) {
      this.pillarZ0[i] = ((i + rng() * 0.8) / PILLAR_COUNT) * FOREST_LENGTH;
      const side = i % 2 === 0 ? 1 : -1;
      this.pillarLat[i] = side * (16.0 + rng() * 34.0);
      this.pillarScale[i] = 1.05 + rng() * 0.50;
      this.pillarRotY[i] = rng() * Math.PI * 2;
    }
    this.scene.add(this.pillarMesh);
  }

  private _buildMossyBoulders(): void {
    const boulderGeo = createMossyBoulderGeometry(404);
    this.boulderMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.04,
    });

    this.boulderMesh = new THREE.InstancedMesh(boulderGeo, this.boulderMaterial, BOULDER_COUNT);
    const rng = mulberry32(888);

    for (let i = 0; i < BOULDER_COUNT; i++) {
      this.boulderZ0[i] = ((i + rng() * 0.7) / BOULDER_COUNT) * FOREST_LENGTH;
      const side = i % 2 === 0 ? 1 : -1;
      this.boulderLat[i] = side * (3.6 + rng() * 8.5);
      this.boulderScale[i] = 0.85 + rng() * 0.65;
      this.boulderRotY[i] = rng() * Math.PI * 2;
    }
    this.scene.add(this.boulderMesh);
  }

  private _buildLotusBlossoms(): void {
    // Bioluminescent ground blossoms catching the portal radiance
    const stalk = new THREE.CylinderGeometry(0.06, 0.08, 0.25, 5);
    stalk.translate(0, 0.12, 0);
    const flower = new THREE.ConeGeometry(0.55, 0.5, 6, 1, true);
    flower.translate(0, 0.35, 0);

    const merged = new THREE.BufferGeometry();
    const sPos = stalk.toNonIndexed().attributes['position']!;
    const fPos = flower.toNonIndexed().attributes['position']!;
    const allPos = new Float32Array((sPos.count + fPos.count) * 3);
    allPos.set(sPos.array, 0);
    allPos.set(fPos.array, sPos.count * 3);
    merged.setAttribute('position', new THREE.BufferAttribute(allPos, 3));
    merged.computeVertexNormals();
    stalk.dispose();
    flower.dispose();

    this.lotusMaterial = new THREE.MeshStandardMaterial({
      color: 0x1f082e,
      emissive: new THREE.Color(...this.palette.highlight),
      emissiveIntensity: 1.2,
      roughness: 0.35,
      metalness: 0.5,
    });

    this.lotusMesh = new THREE.InstancedMesh(merged, this.lotusMaterial, LOTUS_COUNT);
    const rng = mulberry32(444);

    for (let i = 0; i < LOTUS_COUNT; i++) {
      this.lotusZ0[i] = ((i + rng() * 0.6) / LOTUS_COUNT) * FOREST_LENGTH;
      const side = i % 2 === 0 ? 1 : -1;
      this.lotusLat[i] = side * (2.8 + rng() * 2.2);
    }
    this.scene.add(this.lotusMesh);
  }

  private _buildVolumetricGodRays(): void {
    this.godRayTexture = createLightShaftTexture();
    this.godRayMaterial = new THREE.MeshBasicMaterial({
      map: this.godRayTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      opacity: 0.05,
    });

    // Fan of light shafts piercing through the canopy
    for (let i = 0; i < 7; i++) {
      const geo = new THREE.PlaneGeometry(9.0, 36.0);
      geo.translate(0, 16.0, 0);

      const mesh = new THREE.Mesh(geo, this.godRayMaterial);
      const angle = -0.32 + (i - 3) * 0.08;
      mesh.position.set((i - 3) * 5.5, 0.0, -35.0 - i * 16.0);
      mesh.rotation.x = -0.38;
      mesh.rotation.y = angle;
      mesh.rotation.z = 0.12;

      this.godRayGroup.add(mesh);
    }
    this.scene.add(this.godRayGroup);
  }

  private _buildHorizonGatewayGlow(): void {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createRadialGradient(256, 256, 6, 256, 256, 250);
    grad.addColorStop(0.00, '#ffffff'); // Luminous dimensional opening
    grad.addColorStop(0.18, '#f3e8ff'); // Celestial lavender
    grad.addColorStop(0.42, 'rgba(192, 132, 252, 0.65)'); // Amethyst aura
    grad.addColorStop(0.70, 'rgba(126, 34, 206, 0.20)');
    grad.addColorStop(1.00, 'rgba(0, 0, 0, 0.0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    const texture = new THREE.CanvasTexture(canvas);
    const geo = new THREE.PlaneGeometry(60, 60);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 8.5, -165.0);
    this.scene.add(mesh);
  }

  private _buildFireflies(): void {
    const count = 2500;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const brightness = new Float32Array(count);
    const layers = new Float32Array(count);
    const drifts = new Float32Array(count * 3);

    const rng = mulberry32(999);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (rng() - 0.5) * 55;
      positions[i * 3 + 1] = 0.5 + rng() * 14;
      positions[i * 3 + 2] = -rng() * 180;

      sizes[i] = 1.2 + rng() * 2.8;
      phases[i] = rng() * Math.PI * 2;
      brightness[i] = 0.6 + rng() * 0.4;
      layers[i] = rng() < 0.3 ? 0 : 1;

      drifts[i * 3 + 0] = (rng() - 0.5) * 0.002;
      drifts[i * 3 + 1] = (rng() - 0.5) * 0.002;
      drifts[i * 3 + 2] = (rng() - 0.5) * 0.002;
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
        uPointSizeMax:  { value: 42.0 },
        uParticleColor: { value: new THREE.Vector3(...this.palette.particle) },
      },
    });

    this.sporeGeo = geo;
    this.sporeMaterial = mat;
    this.spores = new THREE.Points(geo, mat);
    this.scene.add(this.spores);
  }

  update(dt: number, elapsed: number, audio?: AudioBands): void {
    // Serene, meditative cruising velocity with gentle audio modulation
    const audioSpeedMod = audio ? (audio.low * 0.10 + audio.longTermEnergy * 0.08) : 0;
    const cruiseSpeed = 3.6 + (this.params.travelSpeed + audioSpeedMod) * 4.0;
    this.travelZ += cruiseSpeed * dt;

    // Camera movement: gentle organic wander along the enchanted pathway
    const camSwayX = Math.sin(this.travelZ * 0.045) * 0.35;
    const camBreathY = 1.75 + Math.sin(this.travelZ * 0.08) * 0.10;
    this.camera.position.set(camSwayX, camBreathY, 0);

    // Look ahead through the forest corridor toward the next oncoming megalith
    const lookAhead = 32.0;
    const targetX = Math.sin((this.travelZ + lookAhead) * 0.045) * 0.35;
    this.camera.lookAt(targetX, 2.2, -lookAhead);

    // Path lantern tracks camera position with warm musical breathing
    const lanternBoost = audio ? 1.0 + audio.mid * 0.35 + audio.low * 0.20 : 1.0;
    this.pathLantern.intensity = 3.8 * lanternBoost;
    this.pathLantern.position.set(camSwayX, camBreathY - 0.2, 0.8);

    // 1. Ancient Carved Stone Rune Portals & Vortex Membranes
    for (let i = 0; i < PORTAL_COUNT; i++) {
      const zOffset = -175.0 + ((this.portalZ0[i]! + this.travelZ) % FOREST_LENGTH);

      // Megalith arch sits firmly grounded at y = 0
      this.dummy.position.set(0, 0, zOffset);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.portalMesh.setMatrixAt(i, this.dummy.matrix);

      // Inner vortex membrane positioned at center of portal aperture
      const vm = this.vortexMeshes[i]!;
      vm.position.set(0, 3.8, zOffset);

      // Organic portal breathing on bass transients & beats
      const vortexScale = 1.0 + (audio ? audio.low * 0.12 + audio.beat * 0.08 : 0.0);
      vm.scale.set(vortexScale, vortexScale, 1.0);

      // Distance-dependent vortex visibility:
      // Glorious glowing doorway in the distance, softly fades as camera walks through arch
      const distFade = THREE.MathUtils.smoothstep(zOffset, -2.5, -12.0);
      const vMat = this.vortexMaterials[i]!;
      vMat.uniforms['uTime']!.value = elapsed;
      const bassPulse = audio ? 1.0 + audio.low * 0.38 + audio.beat * 0.25 : 1.0;
      const midPulse = audio ? 0.85 + audio.mid * 0.30 : 0.85;
      vMat.uniforms['uIntensity']!.value = midPulse * bassPulse * distFade;

      // Position portal localized point light at nearest approaching portal
      if (i < 2) {
        this.portalGlowLights[i]!.position.set(0, 3.8, zOffset);
        this.portalGlowLights[i]!.intensity = 2.4 * distFade * bassPulse;
      }
    }
    this.portalMesh.instanceMatrix.needsUpdate = true;

    // 2. Pathway Stone Steps
    for (let i = 0; i < STEP_COUNT; i++) {
      const zOffset = -175.0 + ((this.stepZ0[i]! + this.travelZ) % FOREST_LENGTH);
      this.dummy.position.set(0, 0.02, zOffset);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.stepMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.stepMesh.instanceMatrix.needsUpdate = true;

    // 3. Grandfather Trees
    for (let i = 0; i < GRANDFATHER_COUNT; i++) {
      const zOffset = -175.0 + ((this.grandfatherZ0[i]! + this.travelZ) % FOREST_LENGTH);
      const x = this.grandfatherLat[i]!;
      const y = this._getGroundElevation(x, zOffset);
      const s = this.grandfatherScale[i]!;
      const ry = this.grandfatherRotY[i]!;

      this.dummy.position.set(x, y, zOffset);
      this.dummy.rotation.set(0, ry, 0);
      this.dummy.scale.set(s, s, s);
      this.dummy.updateMatrix();
      this.grandfatherMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.grandfatherMesh.instanceMatrix.needsUpdate = true;

    // 4. Elder Twisted Trees
    for (let i = 0; i < ELDER_COUNT; i++) {
      const zOffset = -175.0 + ((this.elderZ0[i]! + this.travelZ) % FOREST_LENGTH);
      const x = this.elderLat[i]!;
      const y = this._getGroundElevation(x, zOffset);
      const s = this.elderScale[i]!;
      const ry = this.elderRotY[i]!;

      this.dummy.position.set(x, y, zOffset);
      this.dummy.rotation.set(0, ry, 0);
      this.dummy.scale.set(s, s, s);
      this.dummy.updateMatrix();
      this.elderMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.elderMesh.instanceMatrix.needsUpdate = true;

    // 5. Canopy Pillar Trees
    for (let i = 0; i < PILLAR_COUNT; i++) {
      const zOffset = -175.0 + ((this.pillarZ0[i]! + this.travelZ) % FOREST_LENGTH);
      const x = this.pillarLat[i]!;
      const y = this._getGroundElevation(x, zOffset);
      const s = this.pillarScale[i]!;
      const ry = this.pillarRotY[i]!;

      this.dummy.position.set(x, y, zOffset);
      this.dummy.rotation.set(0, ry, 0);
      this.dummy.scale.set(s, s, s);
      this.dummy.updateMatrix();
      this.pillarMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.pillarMesh.instanceMatrix.needsUpdate = true;

    // 6. Mossy Boulders
    for (let i = 0; i < BOULDER_COUNT; i++) {
      const zOffset = -175.0 + ((this.boulderZ0[i]! + this.travelZ) % FOREST_LENGTH);
      const x = this.boulderLat[i]!;
      const y = this._getGroundElevation(x, zOffset);
      const s = this.boulderScale[i]!;
      const ry = this.boulderRotY[i]!;

      this.dummy.position.set(x, y, zOffset);
      this.dummy.rotation.set(0, ry, 0);
      this.dummy.scale.set(s, s, s);
      this.dummy.updateMatrix();
      this.boulderMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.boulderMesh.instanceMatrix.needsUpdate = true;

    // 7. Lotus Blossoms
    for (let i = 0; i < LOTUS_COUNT; i++) {
      const zOffset = -175.0 + ((this.lotusZ0[i]! + this.travelZ) % FOREST_LENGTH);
      const x = this.lotusLat[i]!;
      const y = this._getGroundElevation(x, zOffset);

      this.dummy.position.set(x, y, zOffset);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.lotusMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.lotusMesh.instanceMatrix.needsUpdate = true;

    // 7. Lotus Blossoms (Subtle bioluminescent swell on mid frequencies and beats)
    const lotusGlow = 0.85 + (audio ? audio.mid * 0.45 + audio.beat * 0.35 : 0);
    this.lotusMaterial.emissiveIntensity = lotusGlow;

    // 8. Volumetric God-Rays Breathing (delicate ethereal light shafts)
    const godRayOpacity = 0.045 + Math.sin(elapsed * 0.4) * 0.015 + (audio ? audio.low * 0.02 + audio.beat * 0.015 : 0);
    this.godRayMaterial.opacity = godRayOpacity;

    // 9. Fireflies & Spores (Shimmer accelerated on high frequency air)
    this.sporeTime += dt * (1.0 + (audio ? audio.high * 1.8 : 0.0));
    this.sporeMaterial.uniforms['uTime']!.value = this.sporeTime;
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  applyPalette(palette: PaletteDefinition, t: number, prev?: PaletteDefinition): void {
    this.palette = palette;
    const from = prev ?? palette;
    const lerp = (a: [number, number, number], b: [number, number, number]) => lerpVec3(a, b, t);

    for (const vMat of this.vortexMaterials) {
      vMat.uniforms['uColorMid']!.value.copy(lerp(from.highlight, palette.highlight));
      vMat.uniforms['uColorRim']!.value.copy(lerp(from.wallEmissive, palette.wallEmissive));
    }

    this.sporeMaterial.uniforms['uParticleColor']!.value = lerp(from.particle, palette.particle);

    const curHighlight = lerp(from.highlight, palette.highlight);
    this.lotusMaterial.emissive.setRGB(curHighlight.x * 0.9, curHighlight.y * 0.9, curHighlight.z * 0.9);
    this.canopySunlight.color.setRGB(curHighlight.x, curHighlight.y, curHighlight.z);
    for (const pl of this.portalGlowLights) {
      pl.color.setRGB(curHighlight.x, curHighlight.y, curHighlight.z);
    }
  }

  applyVisualParams(params: VisualParams): void {
    this.params = params;
  }

  triggerEffect(effectName: string): void {
    if (effectName === 'sparkle_wave' || effectName === 'constellation_flash') {
      for (const vMat of this.vortexMaterials) {
        vMat.uniforms['uIntensity']!.value = 1.8;
      }
      this.canopySunlight.intensity = 4.2;
      for (const pl of this.portalGlowLights) {
        pl.intensity = 6.0;
      }
      window.setTimeout(() => {
        for (const vMat of this.vortexMaterials) {
          vMat.uniforms['uIntensity']!.value = 0.88;
        }
        this.canopySunlight.intensity = 1.5;
        for (const pl of this.portalGlowLights) {
          pl.intensity = 2.5;
        }
      }, 1600);
    }
  }

  dispose(): void {
    this.groundGeo.dispose();
    this.groundMaterial.dispose();

    this.stepMesh.geometry.dispose();
    this.stepMaterial.dispose();

    this.portalMesh.geometry.dispose();
    this.portalMaterial.dispose();

    for (const geo of this.vortexGeos) geo.dispose();
    for (const mat of this.vortexMaterials) mat.dispose();

    this.grandfatherMesh.geometry.dispose();
    this.elderMesh.geometry.dispose();
    this.pillarMesh.geometry.dispose();
    this.treeMaterial.dispose();

    this.boulderMesh.geometry.dispose();
    this.boulderMaterial.dispose();

    this.lotusMesh.geometry.dispose();
    this.lotusMaterial.dispose();

    this.godRayTexture.dispose();
    this.godRayMaterial.dispose();
    for (const child of this.godRayGroup.children) {
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    }

    this.sporeGeo.dispose();
    this.sporeMaterial.dispose();

    this.scene.clear();
  }
}
