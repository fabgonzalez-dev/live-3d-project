import { describe, it, expect } from 'vitest';
import { QUALITY_PROFILES, type QualityLevel } from '../src/rendering/QualityManager';
import { getProceduralShaderCore, SHADER_CHUNKS } from '../src/shaders/common/shaderChunks';

describe('Quality Profiles & Configuration', () => {
  it('defines all required quality levels: low, medium, high, ultra', () => {
    const levels: QualityLevel[] = ['low', 'medium', 'high', 'ultra'];
    for (const level of levels) {
      const profile = QUALITY_PROFILES[level];
      expect(profile).toBeDefined();
      expect(profile.name).toBe(level);
      expect(profile.renderScale).toBeGreaterThanOrEqual(0.5);
      expect(profile.renderScale).toBeLessThanOrEqual(1.0);
      expect(profile.particleBudget).toBeGreaterThan(0);
    }
  });

  it('maintains strictly increasing particle and render budgets across quality tiers', () => {
    expect(QUALITY_PROFILES.low.particleBudget).toBeLessThan(QUALITY_PROFILES.medium.particleBudget);
    expect(QUALITY_PROFILES.medium.particleBudget).toBeLessThan(QUALITY_PROFILES.high.particleBudget);
    expect(QUALITY_PROFILES.high.particleBudget).toBeLessThan(QUALITY_PROFILES.ultra.particleBudget);

    expect(QUALITY_PROFILES.low.renderScale).toBeLessThanOrEqual(QUALITY_PROFILES.medium.renderScale);
    expect(QUALITY_PROFILES.medium.renderScale).toBeLessThanOrEqual(QUALITY_PROFILES.high.renderScale);
    expect(QUALITY_PROFILES.high.renderScale).toBeLessThanOrEqual(QUALITY_PROFILES.ultra.renderScale);
  });
});

describe('Procedural Shader Core Library', () => {
  it('loads all procedural shader chunks', () => {
    expect(SHADER_CHUNKS.simplexNoise).toContain('simplex2D');
    expect(SHADER_CHUNKS.simplexNoise).toContain('simplex3D');
    expect(SHADER_CHUNKS.fbm).toContain('fbm2D');
    expect(SHADER_CHUNKS.domainWarp).toContain('domainWarp2D');
    expect(SHADER_CHUNKS.voronoi).toContain('voronoi2D');
    expect(SHADER_CHUNKS.fresnel).toContain('fresnelTerm');
    expect(SHADER_CHUNKS.sdf).toContain('sdfCircle');
    expect(SHADER_CHUNKS.lighting).toContain('triangularDither');
  });

  it('produces a valid concatenated shader core bundle', () => {
    const core = getProceduralShaderCore();
    expect(core).toBeDefined();
    expect(core.length).toBeGreaterThan(500);
    expect(core).toContain('// ── PROCEDURAL SHADER CORE ──');
  });
});
