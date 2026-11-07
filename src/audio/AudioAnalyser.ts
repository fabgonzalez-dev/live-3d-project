/**
 * audio/AudioAnalyser.ts
 * Phase 7 — Unified Music-Reactive Visual Analysis Engine (§14, §20).
 *
 * Extracts:
 * - low (bass, 20–250 Hz) with dynamic bassScale boost
 * - mid (250–2000 Hz, musical lead & chord body)
 * - high (2–16 kHz, sparkle, percussion & shimmer)
 * - loudness (RMS overall perceptual volume)
 * - beat (transient rhythmic pulse, sharp attack + exponential falloff)
 * - onset (boolean transient trigger for single frame)
 * - longTermEnergy (macro dynamic tracker with tau ~ 8.0s)
 * - reactivity (master sensitivity multiplier 0..2)
 *
 * Implements organic temporal attack/release smoothing and non-reactive fallback.
 */

export interface AudioFeatures {
  low: number;             // 0..1 (bass energy)
  mid: number;             // 0..1 (mid energy)
  high: number;            // 0..1 (high energy)
  loudness: number;        // 0..1 (perceptual RMS volume)
  beat: number;            // 0..1 (decaying rhythmic pulse)
  onset: boolean;          // true on frame of beat trigger
  longTermEnergy: number;  // 0..1 (macro musical density, tau ~ 8s)
  reactivity: number;      // 0..2 (master scaling factor)
}

// Backward-compatible alias for existing scene interfaces
export type AudioBands = AudioFeatures;

export class AudioAnalyser {
  private analyser: AnalyserNode;
  private dataArray: Uint8Array<ArrayBuffer>;
  private sampleRate: number;

  private smoothed: AudioFeatures = {
    low: 0,
    mid: 0,
    high: 0,
    loudness: 0,
    beat: 0,
    onset: false,
    longTermEnergy: 0,
    reactivity: 1.0,
  };

  private readonly ATTACK = 0.35;
  private readonly RELEASE = 0.08;

  // Onset & beat tracking
  private energyHistory: number[] = [];
  private readonly HISTORY_SIZE = 36;
  private lastBeatTime = 0;
  private beatDecay = 0;
  private longTermAccumulator = 0;

  // Sensitivity controls
  private reactivityIntensity = 1.0;
  private bassScale = 1.0;
  private beatPulseEnabled = true;

  constructor(ctx: AudioContext, sourceNode: AudioNode) {
    this.sampleRate = ctx.sampleRate;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.6;
    this.dataArray = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));

    sourceNode.connect(this.analyser);
  }

  setReactivityParams(params: {
    reactivityIntensity?: number;
    bassScale?: number;
    beatPulseEnabled?: boolean;
  }): void {
    if (params.reactivityIntensity !== undefined) {
      this.reactivityIntensity = Math.max(0, Math.min(2.0, params.reactivityIntensity));
    }
    if (params.bassScale !== undefined) {
      this.bassScale = Math.max(0, Math.min(2.0, params.bassScale));
    }
    if (params.beatPulseEnabled !== undefined) {
      this.beatPulseEnabled = params.beatPulseEnabled;
    }
  }

  getReactivityParams(): {
    reactivityIntensity: number;
    bassScale: number;
    beatPulseEnabled: boolean;
  } {
    return {
      reactivityIntensity: this.reactivityIntensity,
      bassScale: this.bassScale,
      beatPulseEnabled: this.beatPulseEnabled,
    };
  }

  update(dt: number = 0.016): AudioFeatures {
    this.analyser.getByteFrequencyData(this.dataArray);
    const binCount = this.analyser.frequencyBinCount;
    const nyquist = this.sampleRate / 2;
    const hzPerBin = nyquist / binCount;

    let lowSum = 0, lowCount = 0;
    let midSum = 0, midCount = 0;
    let highSum = 0, highCount = 0;
    let totalSum = 0;

    for (let i = 0; i < binCount; i++) {
      const freq = i * hzPerBin;
      const val = this.dataArray[i]! / 255.0; // 0..1
      totalSum += val;

      if (freq >= 20 && freq < 250) {
        lowSum += val;
        lowCount++;
      } else if (freq >= 250 && freq < 2000) {
        midSum += val;
        midCount++;
      } else if (freq >= 2000 && freq <= 16000) {
        highSum += val;
        highCount++;
      }
    }

    const rawLow = Math.min(1.0, (lowCount > 0 ? lowSum / lowCount : 0) * this.bassScale);
    const rawMid = Math.min(1.0, midCount > 0 ? midSum / midCount : 0);
    const rawHigh = Math.min(1.0, highCount > 0 ? highSum / highCount : 0);
    const rawLoudness = Math.min(1.0, binCount > 0 ? totalSum / binCount : 0);

    // ── Onset & Beat Tracker ─────────────────────────────────────
    this.energyHistory.push(rawLow);
    if (this.energyHistory.length > this.HISTORY_SIZE) {
      this.energyHistory.shift();
    }

    let histSum = 0;
    for (let i = 0; i < this.energyHistory.length; i++) {
      histSum += this.energyHistory[i]!;
    }
    const avgLow = this.energyHistory.length > 0 ? histSum / this.energyHistory.length : 0;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const timeSinceLastBeat = now - this.lastBeatTime;
    let onset = false;

    if (
      this.beatPulseEnabled &&
      this.reactivityIntensity > 0.05 &&
      timeSinceLastBeat > 210 && // minimum interval between beats (~285 BPM max)
      rawLow > 0.10 &&
      rawLow > avgLow * 1.30 + 0.035
    ) {
      onset = true;
      this.lastBeatTime = now;
      this.beatDecay = Math.min(1.0, rawLow * 1.4);
    } else {
      // Exponential falloff for natural breathing pulse
      this.beatDecay = Math.max(0, this.beatDecay * Math.exp(-dt * 6.5));
    }

    // ── Long-term macro energy (tau ~ 8.0s) ──────────────────────
    const longTermAlpha = Math.min(1.0, dt / 8.0);
    this.longTermAccumulator += (rawLoudness - this.longTermAccumulator) * longTermAlpha;

    // ── Attack/Release smoothing with master reactivity scaling ─
    const scale = this.reactivityIntensity;
    const targetLow = rawLow * scale;
    const targetMid = rawMid * scale;
    const targetHigh = rawHigh * scale;
    const targetLoudness = rawLoudness * scale;

    this.smoothed.low = this._smooth(this.smoothed.low, targetLow);
    this.smoothed.mid = this._smooth(this.smoothed.mid, targetMid);
    this.smoothed.high = this._smooth(this.smoothed.high, targetHigh);
    this.smoothed.loudness = this._smooth(this.smoothed.loudness, targetLoudness);
    this.smoothed.beat = Math.min(1.0, this.beatDecay * scale);
    this.smoothed.onset = onset;
    this.smoothed.longTermEnergy = Math.min(1.0, this.longTermAccumulator * scale);
    this.smoothed.reactivity = scale;

    return { ...this.smoothed };
  }

  private _smooth(prev: number, target: number): number {
    const alpha = target > prev ? this.ATTACK : this.RELEASE;
    return prev + (target - prev) * alpha;
  }
}
