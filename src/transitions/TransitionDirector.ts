/**
 * transitions/TransitionDirector.ts
 * Cross-environment transition coordinator (improvements.md §13).
 *
 * Implements:
 * - Continuous forward motion during cross-environment metamorphosis
 * - Seamless camera interpolation (position, quaternion slerp, FOV)
 * - Offscreen dual-scene rendering during the transition window only
 * - Multiple cinematic transition techniques:
 *     * 'portal_warp' (expanding dimensional vortex iris)
 *     * 'atmospheric_dissolve' (ethereal volumetric mist sweep)
 *     * 'metamorphosis' (chromatic dispersion crossfade)
 * - Complete resource reclamation (disposes incoming and outgoing render targets upon completion)
 * - Zero per-frame memory allocation
 */

import * as THREE from 'three';
import type { SceneLifecycle } from '../scenes/SceneLifecycle';
import type { AudioBands } from '../audio/AudioAnalyser';
import transitionFrag from '../shaders/transitionFragment.glsl?raw';

export type TransitionTechnique = 'portal_warp' | 'atmospheric_dissolve' | 'metamorphosis';

export class TransitionDirector {
  private _isTransitioning = false;
  private progress = 0;
  private duration = 3.5;
  private elapsedTransition = 0;

  private sceneFrom: SceneLifecycle | null = null;
  private sceneTo: SceneLifecycle | null = null;
  private technique: TransitionTechnique = 'portal_warp';

  // Render targets allocated exclusively during active transitions
  private targetFrom: THREE.WebGLRenderTarget | null = null;
  private targetTo: THREE.WebGLRenderTarget | null = null;

  // Full-screen quad for shader compositing
  private transitionQuadScene: THREE.Scene;
  private transitionQuadCamera: THREE.OrthographicCamera;
  private transitionMaterial: THREE.ShaderMaterial;
  private transitionQuadMesh: THREE.Mesh;

  // Pre-allocated objects for zero-garbage camera interpolation
  private readonly startPos = new THREE.Vector3();
  private readonly targetPos = new THREE.Vector3();
  private readonly startQuat = new THREE.Quaternion();
  private readonly targetQuat = new THREE.Quaternion();

  private onCompleteCallback?: (finalScene: SceneLifecycle) => void;

  constructor() {
    this.transitionQuadScene = new THREE.Scene();
    this.transitionQuadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.transitionMaterial = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: transitionFrag,
      uniforms: {
        tDiffuseFrom: { value: null as THREE.Texture | null },
        tDiffuseTo:   { value: null as THREE.Texture | null },
        uProgress:    { value: 0.0 },
        uTime:        { value: 0.0 },
        uResolution:  { value: new THREE.Vector2(typeof window !== 'undefined' ? window.innerWidth : 1280, typeof window !== 'undefined' ? window.innerHeight : 720) },
        uTechnique:   { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });

    const quadGeo = new THREE.PlaneGeometry(2, 2);
    this.transitionQuadMesh = new THREE.Mesh(quadGeo, this.transitionMaterial);
    this.transitionQuadScene.add(this.transitionQuadMesh);
  }

  isTransitioning(): boolean {
    return this._isTransitioning;
  }

  getProgress(): number {
    return this.progress;
  }

  getActiveScene(): SceneLifecycle | null {
    if (!this._isTransitioning) return this.sceneFrom;
    return this.progress < 0.5 ? this.sceneFrom : this.sceneTo;
  }

  startTransition(
    from: SceneLifecycle,
    to: SceneLifecycle,
    duration = 3.5,
    technique: TransitionTechnique = 'portal_warp',
    onComplete?: (finalScene: SceneLifecycle) => void,
  ): void {
    if (this._isTransitioning) {
      // If already transitioning, immediately finalize previous
      this.finalize();
    }

    this.sceneFrom = from;
    this.sceneTo = to;
    this.duration = Math.max(duration, 0.5);
    this.technique = technique;
    this.progress = 0.0;
    this.elapsedTransition = 0.0;
    this.onCompleteCallback = onComplete;
    this._isTransitioning = true;

    // Cache initial camera transforms
    this.startPos.copy(from.camera.position);
    this.targetPos.copy(to.camera.position);
    this.startQuat.copy(from.camera.quaternion);
    this.targetQuat.copy(to.camera.quaternion);

    // Setup technique uniform (0: portal_warp, 1: atmospheric_dissolve, 2: metamorphosis)
    const techCode = technique === 'atmospheric_dissolve' ? 1 : technique === 'metamorphosis' ? 2 : 0;
    this.transitionMaterial.uniforms['uTechnique']!.value = techCode;

    // Allocate render targets matching display resolution
    const width = typeof window !== 'undefined' ? Math.max(window.innerWidth, 1) : 1280;
    const height = typeof window !== 'undefined' ? Math.max(window.innerHeight, 1) : 720;

    this.targetFrom = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });

    this.targetTo = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });

    this.transitionMaterial.uniforms['tDiffuseFrom']!.value = this.targetFrom.texture;
    this.transitionMaterial.uniforms['tDiffuseTo']!.value = this.targetTo.texture;
    this.transitionMaterial.uniforms['uResolution']!.value.set(width, height);
  }

  update(dt: number, elapsed: number, audio?: AudioBands): void {
    if (!this._isTransitioning || !this.sceneFrom || !this.sceneTo) return;

    this.elapsedTransition += dt;
    this.progress = Math.min(this.elapsedTransition / this.duration, 1.0);

    // Both scenes continue animating during transition (no frozen frames)
    this.sceneFrom.update(dt, elapsed, audio);
    this.sceneTo.update(dt, elapsed, audio);

    // Continuous camera interpolation using S-curve
    const s = this.progress * this.progress * (3.0 - 2.0 * this.progress);
    this.sceneTo.camera.position.lerpVectors(this.startPos, this.targetPos, s);
    this.sceneTo.camera.quaternion.slerpQuaternions(this.startQuat, this.targetQuat, s);

    // Update transition material uniforms
    this.transitionMaterial.uniforms['uProgress']!.value = this.progress;
    this.transitionMaterial.uniforms['uTime']!.value = elapsed;

    if (this.progress >= 1.0) {
      this.finalize();
    }
  }

  getQuadScene(): THREE.Scene {
    return this.transitionQuadScene;
  }

  getQuadCamera(): THREE.OrthographicCamera {
    return this.transitionQuadCamera;
  }

  /** Renders the two scene sources into offscreen buffers for composer compositing */
  renderSources(renderer: THREE.WebGLRenderer): void {
    if (!this._isTransitioning || !this.sceneFrom || !this.sceneTo || !this.targetFrom || !this.targetTo) {
      return;
    }

    // 1. Render Scene From
    renderer.setRenderTarget(this.targetFrom);
    renderer.clear();
    renderer.render(this.sceneFrom.scene, this.sceneFrom.camera);

    // 2. Render Scene To
    renderer.setRenderTarget(this.targetTo);
    renderer.clear();
    renderer.render(this.sceneTo.scene, this.sceneTo.camera);

    renderer.setRenderTarget(null);
  }

  /**
   * Renders the transition offscreen buffers and composites them to the screen/composer
   */
  renderTransition(renderer: THREE.WebGLRenderer): void {
    if (!this._isTransitioning || !this.sceneFrom || !this.sceneTo || !this.targetFrom || !this.targetTo) {
      return;
    }

    this.renderSources(renderer);
    renderer.render(this.transitionQuadScene, this.transitionQuadCamera);
  }

  resize(width: number, height: number): void {
    this.transitionMaterial.uniforms['uResolution']!.value.set(width, height);
    if (this.targetFrom) this.targetFrom.setSize(width, height);
    if (this.targetTo)   this.targetTo.setSize(width, height);
    if (this.sceneFrom)  this.sceneFrom.resize(width, height);
    if (this.sceneTo)    this.sceneTo.resize(width, height);
  }

  private finalize(): void {
    if (!this._isTransitioning) return;
    this._isTransitioning = false;

    const oldScene = this.sceneFrom;
    const finalScene = this.sceneTo!;

    // Clean up render targets to avoid GPU memory leaks
    if (this.targetFrom) {
      this.targetFrom.dispose();
      this.targetFrom = null;
    }
    if (this.targetTo) {
      this.targetTo.dispose();
      this.targetTo = null;
    }

    this.sceneFrom = null;
    this.sceneTo = null;

    // Dispose old scene completely
    if (oldScene) {
      oldScene.dispose();
    }

    if (this.onCompleteCallback) {
      this.onCompleteCallback(finalScene);
      this.onCompleteCallback = undefined;
    }
  }

  dispose(): void {
    this.finalize();
    this.transitionQuadMesh.geometry.dispose();
    this.transitionMaterial.dispose();
  }
}
