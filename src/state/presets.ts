/**
 * state/presets.ts
 * Milestone B — Preset system.
 *
 * Provides built-in art-directed presets, schema validation via Zod,
 * version migration support (v1), and import/export capabilities.
 */
import { z } from 'zod';
import type { Preset, SceneName, PaletteId, VisualParams } from './types';
import { DEFAULT_VISUAL } from './types';

export const VisualParamsSchema = z.object({
  travelSpeed:      z.number().min(0).max(2),
  rotationSpeed:    z.number().min(0).max(1),
  displacementAmp:  z.number().min(0).max(1),
  twistAmount:      z.number().min(0).max(3),
  particleDensity:  z.union([z.literal(0), z.literal(1), z.literal(2)]),
  bloomStrength:    z.number().min(0).max(3),
  bloomRadius:      z.number().min(0).max(1),
  bloomThreshold:   z.number().min(0).max(1),
  exposure:         z.number().min(0.1).max(3),
  renderScale:      z.number().min(0.5).max(1),
  fpsTarget:        z.union([z.literal(30), z.literal(60)]),
  toneMapping:      z.enum(['agx', 'aces']).optional(),
  vignetteStrength: z.number().min(0).max(1).optional(),
  grainIntensity:   z.number().min(0).max(0.1).optional(),
  qualityPreset:    z.enum(['low', 'medium', 'high', 'ultra']).optional(),
});

export const PresetSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(64),
  scene: z.enum(['tunnel', 'aurora', 'garden', 'city']),
  palette: z.enum(['blue-violet', 'magenta-plum', 'teal-cyan', 'emerald-blue', 'warm-amber', 'soft-pastel']),
  visual: VisualParamsSchema,
  transitionDurationMs: z.number().min(500).max(15000),
});

export const BUILT_IN_PRESETS: Record<string, Preset> = {
  'neon-mirror-city': {
    version: 1,
    name: 'Neon Mirror City',
    scene: 'city',
    palette: 'blue-violet',
    visual: { ...DEFAULT_VISUAL, travelSpeed: 0.38, displacementAmp: 0.45, twistAmount: 0.65, bloomStrength: 0.80, bloomThreshold: 0.60 },
    transitionDurationMs: 4000,
  },
  'cyber-magenta-chasm': {
    version: 1,
    name: 'Cyber Magenta Chasm',
    scene: 'city',
    palette: 'magenta-plum',
    visual: { ...DEFAULT_VISUAL, travelSpeed: 0.42, displacementAmp: 0.48, twistAmount: 0.70, bloomStrength: 0.85, bloomThreshold: 0.60 },
    transitionDurationMs: 4000,
  },
  'deep-crystal-void': {
    version: 1,
    name: 'Deep Crystal Void',
    scene: 'tunnel',
    palette: 'blue-violet',
    visual: { ...DEFAULT_VISUAL, travelSpeed: 0.38, displacementAmp: 0.35, bloomStrength: 0.75 },
    transitionDurationMs: 4000,
  },
  'neon-plum-odyssey': {
    version: 1,
    name: 'Neon Plum Odyssey',
    scene: 'tunnel',
    palette: 'magenta-plum',
    visual: { ...DEFAULT_VISUAL, travelSpeed: 0.45, displacementAmp: 0.40, bloomStrength: 0.85 },
    transitionDurationMs: 4000,
  },
  'emerald-aurora': {
    version: 1,
    name: 'Emerald Aurora',
    scene: 'aurora',
    palette: 'emerald-blue',
    visual: { ...DEFAULT_VISUAL, travelSpeed: 0.30, displacementAmp: 0.45, bloomStrength: 0.70 },
    transitionDurationMs: 5000,
  },
  'cyber-borealis': {
    version: 1,
    name: 'Cyber Borealis',
    scene: 'aurora',
    palette: 'teal-cyan',
    visual: { ...DEFAULT_VISUAL, travelSpeed: 0.35, displacementAmp: 0.50, bloomStrength: 0.80 },
    transitionDurationMs: 5000,
  },
  'cosmic-sanctuary': {
    version: 1,
    name: 'Cosmic Sanctuary',
    scene: 'garden',
    palette: 'warm-amber',
    visual: { ...DEFAULT_VISUAL, travelSpeed: 0.25, displacementAmp: 0.35, bloomStrength: 0.65 },
    transitionDurationMs: 4500,
  },
  'pastel-blossom': {
    version: 1,
    name: 'Pastel Blossom',
    scene: 'garden',
    palette: 'soft-pastel',
    visual: { ...DEFAULT_VISUAL, travelSpeed: 0.28, displacementAmp: 0.30, bloomStrength: 0.60 },
    transitionDurationMs: 4500,
  },
};

/** Validate and import JSON preset string */
export function importPresetJson(jsonStr: string): { success: true; preset: Preset } | { success: false; error: string } {
  try {
    const raw = JSON.parse(jsonStr);
    const parsed = PresetSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ') };
    }
    return { success: true, preset: parsed.data };
  } catch (err) {
    return { success: false, error: 'Invalid JSON format' };
  }
}

/** Export preset to formatted JSON string */
export function exportPresetJson(preset: Preset): string {
  return JSON.stringify(preset, null, 2);
}

/** Serialize multiple presets to JSON string */
export function serializePresets(presets: Record<string, Preset>): string {
  return JSON.stringify(presets, null, 2);
}

/** Deserialize and validate multiple presets from JSON string */
export function deserializePresets(jsonStr: string): Record<string, Preset> | null {
  try {
    const raw = JSON.parse(jsonStr);
    if (typeof raw !== 'object' || raw === null) return null;
    const result: Record<string, Preset> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const parsed = PresetSchema.safeParse(v);
      if (parsed.success) {
        result[k] = parsed.data;
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}
