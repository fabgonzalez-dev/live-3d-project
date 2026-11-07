import { describe, it, expect } from 'vitest';
import { BUILT_IN_PRESETS, PresetSchema, serializePresets, deserializePresets } from '../src/state/presets';

describe('Presets', () => {
  it('validates all built-in presets against PresetSchema', () => {
    const keys = Object.keys(BUILT_IN_PRESETS);
    expect(keys.length).toBeGreaterThanOrEqual(6);

    for (const key of keys) {
      const preset = BUILT_IN_PRESETS[key]!;
      const result = PresetSchema.safeParse(preset);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe(preset.name);
        expect(result.data.visual.exposure).toBeGreaterThan(0);
        expect(result.data.visual.renderScale).toBeGreaterThanOrEqual(0.5);
      }
    }
  });

  it('serializes and deserializes presets safely', () => {
    const json = serializePresets(BUILT_IN_PRESETS);
    const roundTripped = deserializePresets(json);
    expect(roundTripped).not.toBeNull();
    expect(Object.keys(roundTripped!)).toEqual(Object.keys(BUILT_IN_PRESETS));
  });

  it('rejects invalid visual parameter values', () => {
    const invalidPreset = {
      version: 1,
      name: 'Bad Preset',
      scene: 'tunnel',
      palette: 'blue-violet',
      visual: {
        travelSpeed: -5, // Invalid negative speed
        rotationSpeed: 0.1,
        displacementAmp: 0.35,
        twistAmount: 0.6,
        particleDensity: 1,
        bloomStrength: 10, // Invalid, exceeds max 3
        bloomRadius: 0.4,
        bloomThreshold: 0.5,
        exposure: 1.0,
        renderScale: 1.0,
        fpsTarget: 30,
      },
      transitionDurationMs: 4000,
    };

    const result = PresetSchema.safeParse(invalidPreset);
    expect(result.success).toBe(false);
  });
});
