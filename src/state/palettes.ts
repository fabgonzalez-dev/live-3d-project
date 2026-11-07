/**
 * state/palettes.ts
 * Six art-directed palette definitions.
 * Colors vary across walls, highlights, particles, and fog —
 * not a flat tint over every pixel.
 */
import type { PaletteDefinition } from './types';

export const PALETTES: Record<string, PaletteDefinition> = {
  'blue-violet': {
    id: 'blue-violet',
    label: 'Blue Violet',
    wallBase:     [0.04, 0.01, 0.22],   // deep indigo
    wallEmissive: [0.18, 0.04, 0.72],   // vivid violet
    highlight:    [0.55, 0.22, 1.00],   // bright lavender
    particle:     [0.72, 0.55, 1.00],   // soft lilac sparkle
    fog:          [0.06, 0.02, 0.18],   // near fog
    fogFar:       [0.00, 0.00, 0.02],   // black depth
  },
  'magenta-plum': {
    id: 'magenta-plum',
    label: 'Magenta Plum',
    wallBase:     [0.12, 0.02, 0.12],   // deep muted plum
    wallEmissive: [0.48, 0.10, 0.44],   // soft therapeutic violet-plum
    highlight:    [0.72, 0.38, 0.68],   // gentle dusty orchid
    particle:     [0.82, 0.58, 0.78],   // soft rose-mauve
    fog:          [0.10, 0.02, 0.09],
    fogFar:       [0.01, 0.00, 0.01],
  },
  'teal-cyan': {
    id: 'teal-cyan',
    label: 'Teal Cyan',
    wallBase:     [0.00, 0.12, 0.18],   // deep teal
    wallEmissive: [0.00, 0.55, 0.72],   // vivid cyan-teal
    highlight:    [0.00, 0.88, 1.00],   // electric cyan
    particle:     [0.50, 0.96, 1.00],   // ice blue sparkle
    fog:          [0.00, 0.08, 0.12],
    fogFar:       [0.00, 0.01, 0.03],
  },
  'emerald-blue': {
    id: 'emerald-blue',
    label: 'Emerald Blue',
    wallBase:     [0.00, 0.14, 0.08],   // deep forest
    wallEmissive: [0.02, 0.62, 0.30],   // vivid emerald
    highlight:    [0.20, 1.00, 0.55],   // bright mint
    particle:     [0.55, 1.00, 0.78],   // mint sparkle
    fog:          [0.00, 0.08, 0.05],
    fogFar:       [0.00, 0.01, 0.01],
  },
  'warm-amber': {
    id: 'warm-amber',
    label: 'Warm Amber',
    wallBase:     [0.12, 0.05, 0.01],   // deep warm cedar
    wallEmissive: [0.52, 0.26, 0.04],   // soft golden candlelight
    highlight:    [0.82, 0.54, 0.18],   // warm honey glow
    particle:     [0.90, 0.72, 0.38],   // golden firefly
    fog:          [0.08, 0.03, 0.01],
    fogFar:       [0.01, 0.00, 0.00],
  },
  'soft-pastel': {
    id: 'soft-pastel',
    label: 'Soft Pastel',
    wallBase:     [0.08, 0.08, 0.16],   // soft dark blue
    wallEmissive: [0.55, 0.40, 0.72],   // muted violet
    highlight:    [0.90, 0.72, 0.95],   // petal pink
    particle:     [0.95, 0.88, 1.00],   // white-pink sparkle
    fog:          [0.06, 0.05, 0.12],
    fogFar:       [0.01, 0.01, 0.04],
  },
};

export const PALETTE_ORDER = [
  'blue-violet',
  'magenta-plum',
  'teal-cyan',
  'emerald-blue',
  'warm-amber',
  'soft-pastel',
] as const;
