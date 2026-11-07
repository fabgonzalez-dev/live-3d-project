/**
 * state/types.ts
 * Authoritative session state shape — served by the local Node service.
 * Display receives snapshots; control panel sends validated commands.
 */

export type SceneName = 'tunnel' | 'aurora' | 'garden' | 'city';

export type PaletteId =
  | 'blue-violet'
  | 'magenta-plum'
  | 'teal-cyan'
  | 'emerald-blue'
  | 'warm-amber'
  | 'soft-pastel';

export interface PaletteDefinition {
  id: PaletteId;
  label: string;
  /** Per-component color values [r,g,b] in 0..1 linear */
  wallBase: [number, number, number];
  wallEmissive: [number, number, number];
  highlight: [number, number, number];
  particle: [number, number, number];
  fog: [number, number, number];
  fogFar: [number, number, number];
}

export interface VisualParams {
  travelSpeed: number;       // 0..2,  default 0.4
  rotationSpeed: number;     // 0..1,  default 0.08
  displacementAmp: number;   // 0..1,  default 0.35
  twistAmount: number;       // 0..3,  default 0.6
  particleDensity: 0 | 1 | 2; // 0=low 2k, 1=med 8k, 2=high 20k
  bloomStrength: number;     // 0..3,  default 0.75
  bloomRadius: number;       // 0..1,  default 0.40
  bloomThreshold: number;    // 0..1,  default 0.35
  exposure: number;          // 0.1..3, default 1.0
  renderScale: number;       // 0.5..1, default 1.0
  fpsTarget: 30 | 60;
  toneMapping?: 'agx' | 'aces';
  vignetteStrength?: number; // 0..1, default 0.35
  grainIntensity?: number;   // 0..0.1, default 0.02
  qualityPreset?: 'low' | 'medium' | 'high' | 'ultra';
}

export interface TransitionState {
  fromPalette: PaletteId;
  toPalette: PaletteId;
  progress: number;   // 0..1
  durationMs: number; // ms
  startedAt: number;  // performance.now()
}

export interface AudioState {
  playing: boolean;
  volume: number;       // 0..1
  muted: boolean;
  currentTrack: string | null;
  nextTrack: string | null;
  mode: 'playlist' | 'procedural';
  reactivityIntensity: number; // 0..2, default 1.0
  bassScale: number;          // 0..2, default 1.0
  beatPulseEnabled: boolean;  // default true
}

export interface SessionState {
  scene: SceneName;
  palette: PaletteId;
  transition: TransitionState | null;
  visual: VisualParams;
  audio: AudioState;
  interactionsEnabled: boolean;
  /** Bounded named presets, keyed by name */
  presets: Record<string, Preset>;
  /** Whether /display is active and has initialized audio */
  displayActive: boolean;
}

export interface Preset {
  version: 1;
  name: string;
  scene: SceneName;
  palette: PaletteId;
  visual: VisualParams;
  transitionDurationMs: number;
}

/** Default visual parameters (documented units, ranges, defaults) */
export const DEFAULT_VISUAL: Readonly<VisualParams> = {
  travelSpeed: 0.4,
  rotationSpeed: 0.08,
  displacementAmp: 0.35,
  twistAmount: 0.6,
  particleDensity: 1,
  bloomStrength: 0.75,
  bloomRadius: 0.4,
  bloomThreshold: 0.35,
  exposure: 1.0,
  renderScale: 1.0,
  fpsTarget: 30,
  toneMapping: 'agx',
  vignetteStrength: 0.35,
  grainIntensity: 0.02,
  qualityPreset: 'high',
};

export const DEFAULT_STATE: Readonly<SessionState> = {
  scene: 'tunnel',
  palette: 'blue-violet',
  transition: null,
  visual: DEFAULT_VISUAL,
  audio: {
    playing: false,
    volume: 0.8,
    muted: false,
    currentTrack: null,
    nextTrack: null,
    mode: 'procedural',
    reactivityIntensity: 1.0,
    bassScale: 1.0,
    beatPulseEnabled: true,
  },
  interactionsEnabled: true,
  presets: {},
  displayActive: false,
};
