/**
 * rendering/CinematicPostShader.ts
 * Three.js ShaderPass definition for cinematic post-processing (vignette, dither, grading).
 */

import * as THREE from 'three';
import cinematicFrag from '../shaders/cinematicPost.glsl?raw';

export const CinematicPostShader = {
  name: 'CinematicPostShader',
  uniforms: {
    tDiffuse:             { value: null as THREE.Texture | null },
    uResolution:          { value: new THREE.Vector2(720, 1280) },
    uTime:                { value: 0 },
    uVignetteStrength:    { value: 0.35 },
    uVignetteRadius:      { value: 0.85 },
    uGrainIntensity:      { value: 0.002 }, // Stream-optimized: preserves smooth gradients without H.264 macroblocking
    uChromaticAberration: { value: 0.0018 },
    uContrast:            { value: 1.05 },
    uSaturation:          { value: 1.08 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: cinematicFrag,
};
