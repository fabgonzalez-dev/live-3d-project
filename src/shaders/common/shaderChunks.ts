/**
 * shaders/common/shaderChunks.ts
 * Centralized registry of procedural GLSL chunks for dynamic material composition.
 */

import simplexNoiseGlsl from './simplexNoise.glsl?raw';
import fbmGlsl from './fbm.glsl?raw';
import domainWarpGlsl from './domainWarp.glsl?raw';
import voronoiGlsl from './voronoi.glsl?raw';
import fresnelGlsl from './fresnel.glsl?raw';
import sdfGlsl from './sdf.glsl?raw';
import lightingGlsl from './lighting.glsl?raw';

export const SHADER_CHUNKS = {
  simplexNoise: simplexNoiseGlsl,
  fbm: fbmGlsl,
  domainWarp: domainWarpGlsl,
  voronoi: voronoiGlsl,
  fresnel: fresnelGlsl,
  sdf: sdfGlsl,
  lighting: lightingGlsl,
} as const;

/**
 * Returns a concatenated procedural shader header containing all standard noise,
 * FBM, domain warping, Fresnel, and lighting utilities.
 */
export function getProceduralShaderCore(): string {
  return [
    '// ── PROCEDURAL SHADER CORE ──',
    simplexNoiseGlsl,
    fbmGlsl,
    domainWarpGlsl,
    voronoiGlsl,
    fresnelGlsl,
    sdfGlsl,
    lightingGlsl,
    '// ────────────────────────────\n',
  ].join('\n');
}
