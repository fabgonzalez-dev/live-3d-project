/**
 * rendering/RenderingManager.ts
 * Upgraded real-time graphics pipeline:
 * - Linear color pipeline with AgX Filmic Tone Mapping (THREE.AgXToneMapping)
 * - Multi-pass EffectComposer on HalfFloatType HDR render targets
 * - Pipeline: RenderPass → UnrealBloomPass → CinematicPostPass (vignette/dither/grading) → FXAAPass → OutputPass
 * - Centralized quality preset integration via QualityManager
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { VisualParams } from '../state/types';
import { QualityManager, type QualityLevel } from './QualityManager';
import { CinematicPostShader } from './CinematicPostShader';

export interface DiagnosticsSnapshot {
  fps: number;
  frameTimeMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  qualityLevel: string;
}

export class RenderingManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly composer: EffectComposer;

  private _scene: THREE.Scene | null = null;
  private _camera: THREE.Camera | null = null;

  private renderPass: RenderPass;
  private bloomPass: UnrealBloomPass;
  private cinematicPass: ShaderPass;
  private fxaaPass: ShaderPass;
  private outputPass: OutputPass;

  private rafId = 0;
  private running = false;
  private lastTime = 0;

  private fpsSmoothed = 0;
  private frameTimeSmoothed = 0;
  private readonly SMOOTH_ALPHA = 0.1;

  readonly quality: QualityManager;

  /** External frame callbacks (scene update) */
  private updateCallbacks: Array<(dt: number, elapsed: number) => void> = [];
  private elapsed = 0;
  private baseBloomStrength = 0.75;

  constructor(canvas: HTMLCanvasElement, params: VisualParams) {
    // ── WebGLRenderer ──────────────────────────────────────────
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // Handled via FXAA post-processing pass
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
      depth: true,
    });

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Upgraded: default to AgX filmic tone mapping to prevent highlight blowout
    if (params.toneMapping === 'aces') {
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    } else {
      this.renderer.toneMapping = THREE.AgXToneMapping;
    }
    this.renderer.toneMappingExposure = params.exposure ?? 1.0;

    // ── Placeholder scene/camera until first scene attaches ──
    const placeholderScene = new THREE.Scene();
    const placeholderCamera = new THREE.PerspectiveCamera(75, 9 / 16, 0.1, 1000);

    // ── Quality Manager ───────────────────────────────────────
    this.quality = new QualityManager(this, params);

    // ── EffectComposer (HalfFloatType HDR intermediate buffer) ─
    this.composer = new EffectComposer(this.renderer);

    // 1. Base scene render
    this.renderPass = new RenderPass(placeholderScene, placeholderCamera);
    this.composer.addPass(this.renderPass);

    // 2. Selective threshold-controlled bloom
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(720, 1280),
      params.bloomStrength ?? 0.75,
      params.bloomRadius ?? 0.45,
      params.bloomThreshold ?? 0.35,
    );
    this.composer.addPass(this.bloomPass);

    // 3. Cinematic grading: vignette, film grain dither, chromatic aberration
    this.cinematicPass = new ShaderPass(CinematicPostShader);
    this.composer.addPass(this.cinematicPass);

    // 4. Anti-aliasing (FXAA)
    this.fxaaPass = new ShaderPass(FXAAShader);
    this.composer.addPass(this.fxaaPass);

    // 5. Final OutputPass: Tone mapping (AgX) + sRGB transfer
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    // Sync passes with quality manager
    this.quality.onQualityChange((profile) => {
      this.fxaaPass.enabled = profile.fxaaEnabled;
      this.bloomPass.strength = this.baseBloomStrength * profile.bloomStrengthMultiplier;
      this.bloomPass.radius = profile.bloomRadius;
    });

    // ── Resize ────────────────────────────────────────────────
    this._bindResize();
    this._resize();
  }

  /** Attach a scene and camera to the render pipeline */
  attachScene(scene: THREE.Scene, camera: THREE.Camera): void {
    this._scene = scene;
    this._camera = camera;
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
  }

  /** Register a per-frame update callback (dt in seconds) */
  addUpdateCallback(fn: (dt: number, elapsed: number) => void): void {
    this.updateCallbacks.push(fn);
  }

  removeUpdateCallback(fn: (dt: number, elapsed: number) => void): void {
    const idx = this.updateCallbacks.indexOf(fn);
    if (idx !== -1) this.updateCallbacks.splice(idx, 1);
  }

  /** Start the animation loop (call once) */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this._loop(this.lastTime);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private _loop = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this._loop);

    const rawDt = Math.min((now - this.lastTime) / 1000, 0.1); // cap large delta jumps
    this.lastTime = now;
    this.elapsed += rawDt;

    // Diagnostics smoothing
    const rawFps = rawDt > 0 ? 1 / rawDt : 0;
    this.fpsSmoothed += (rawFps - this.fpsSmoothed) * this.SMOOTH_ALPHA;
    this.frameTimeSmoothed += (rawDt * 1000 - this.frameTimeSmoothed) * this.SMOOTH_ALPHA;

    // Quality adaptation
    this.quality.update(rawDt);

    // Update post-processing uniforms
    this.cinematicPass.uniforms['uTime']!.value = this.elapsed;

    // Update all registered scene callbacks
    for (const cb of this.updateCallbacks) {
      cb(rawDt, this.elapsed);
    }

    // Render multi-pass pipeline
    this.composer.render(rawDt);
  };

  applyVisualParams(p: VisualParams): void {
    // Tone mapping selection
    if (p.toneMapping === 'aces') {
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    } else {
      this.renderer.toneMapping = THREE.AgXToneMapping;
    }
    this.renderer.toneMappingExposure = p.exposure;

    // Bloom tuning
    this.baseBloomStrength = p.bloomStrength;
    const profile = this.quality.getProfile();
    this.bloomPass.strength = p.bloomStrength * profile.bloomStrengthMultiplier;
    this.bloomPass.radius = p.bloomRadius;
    this.bloomPass.threshold = p.bloomThreshold;

    // Cinematic post parameters
    if (p.vignetteStrength !== undefined) {
      this.cinematicPass.uniforms['uVignetteStrength']!.value = p.vignetteStrength;
    }
    if (p.grainIntensity !== undefined) {
      this.cinematicPass.uniforms['uGrainIntensity']!.value = p.grainIntensity;
    }

    // Quality preset override if requested
    if (p.qualityPreset) {
      this.quality.setQualityPreset(p.qualityPreset as QualityLevel, true);
    } else {
      this.quality.applyRenderScale(p.renderScale);
    }
  }

  applyAudioLoudness(loudness: number, beat: number = 0): void {
    // Subtle bloom breath: up to +16% on peak loudness and +12% on musical beat transients
    const profile = this.quality.getProfile();
    this.bloomPass.strength =
      this.baseBloomStrength *
      profile.bloomStrengthMultiplier *
      (1.0 + Math.min(loudness, 1.0) * 0.16 + Math.min(beat, 1.0) * 0.12);
  }

  getDiagnostics(): DiagnosticsSnapshot {
    const info = this.renderer.info;
    return {
      fps: Math.round(this.fpsSmoothed),
      frameTimeMs: parseFloat(this.frameTimeSmoothed.toFixed(2)),
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      qualityLevel: this.quality.currentLevel,
    };
  }

  private _bindResize(): void {
    window.addEventListener('resize', this._resize, { passive: true });
  }

  private _resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const scale = this.quality.renderScale;
    const renderW = Math.round(w * scale);
    const renderH = Math.round(h * scale);

    // Renderer drawing buffer
    this.renderer.setSize(renderW, renderH, false);

    // Canvas CSS display size
    const canvas = this.renderer.domElement;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    // Update EffectComposer
    this.composer.setSize(renderW, renderH);

    // Update Bloom pass resolution
    this.bloomPass.resolution.set(renderW, renderH);

    // Update Cinematic pass resolution
    this.cinematicPass.uniforms['uResolution']!.value.set(renderW, renderH);

    // Update FXAA inverse resolution uniform
    const fxaaUniform = this.fxaaPass.material.uniforms['resolution'];
    if (fxaaUniform) {
      fxaaUniform.value.x = 1 / renderW;
      fxaaUniform.value.y = 1 / renderH;
    }

    // Update active camera
    if (this._camera instanceof THREE.PerspectiveCamera) {
      this._camera.aspect = w / h;
      this._camera.updateProjectionMatrix();
    }
  };

  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this._resize);
    this.bloomPass.dispose();
    this.cinematicPass.dispose();
    this.fxaaPass.dispose();
    this.outputPass.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
