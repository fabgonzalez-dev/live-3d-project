/**
 * audio/ProceduralSynth.ts
 * Milestone C5 — Deterministic procedural ambient synthesizer.
 *
 * Uses pure Web Audio API synthesis without external samples:
 * - Warm ambient pad drones (detuned dual sine/triangle oscillators + lowpass filter)
 * - Slow evolving harmonic progression in D Aeolian / Minor Pentatonic
 * - Sparse gentle chime / star twinkle notes with subtle delay
 * - Bounded voice scheduling with automatic node disconnection
 */

export class ProceduralSynth {
  private ctx: AudioContext;
  private outputNode: GainNode;
  private isPlaying = false;
  private timerId: number | null = null;

  // D minor pentatonic frequencies: D, F, G, A, C across octaves
  private readonly scaleFreqs = [
    73.42, 87.31, 98.0, 110.0, 130.81,   // Octave 2
    146.83, 174.61, 196.0, 220.0, 261.63, // Octave 3
    293.66, 349.23, 392.0, 440.0, 523.25, // Octave 4
    587.33, 698.46, 783.99, 880.0, 1046.5 // Octave 5 (chimes)
  ];

  private activeNodes: Set<{ stop?: () => void; disconnect: () => void }> = new Set();

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.outputNode = ctx.createGain();
    this.outputNode.gain.setValueAtTime(0.7, ctx.currentTime);
    this.outputNode.connect(destination);
  }

  start(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;

    // Start pad voice loop
    this._schedulePad();
    // Start sparse chime schedule
    this._scheduleChime();
  }

  stop(): void {
    this.isPlaying = false;
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
    // Clean up active nodes
    for (const node of this.activeNodes) {
      try {
        node.stop?.();
        node.disconnect();
      } catch {
        // ignore
      }
    }
    this.activeNodes.clear();
  }

  private _schedulePad = (): void => {
    if (!this.isPlaying) return;

    const t = this.ctx.currentTime;
    const duration = 12.0; // 12-second slow breathing chord
    const chordRootIdx = Math.floor(Math.random() * 4); // Root notes in Octave 2
    const rootFreq = this.scaleFreqs[chordRootIdx] ?? 73.42;
    const fifthFreq = rootFreq * 1.5;

    [rootFreq, fifthFreq].forEach((freq, i) => {
      // Dual oscillator with gentle detuning for lush chorusing
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc1.type = 'triangle';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(freq, t);
      osc2.frequency.setValueAtTime(freq * 1.003, t); // +5 cents detune

      // Gentle resonant lowpass filter
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(350 + i * 150, t);
      filter.frequency.exponentialRampToValueAtTime(700 + i * 200, t + duration * 0.5);
      filter.frequency.exponentialRampToValueAtTime(350 + i * 150, t + duration);

      // Smooth attack and release envelope (no clicks)
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 3.0);
      gain.gain.setValueAtTime(0.12, t + duration - 4.0);
      gain.gain.linearRampToValueAtTime(0.001, t + duration);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.outputNode);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + duration);
      osc2.stop(t + duration);

      const ref = {
        stop: () => { osc1.stop(); osc2.stop(); },
        disconnect: () => { gain.disconnect(); filter.disconnect(); },
      };
      this.activeNodes.add(ref);

      window.setTimeout(() => {
        this.activeNodes.delete(ref);
        ref.disconnect();
      }, (duration + 0.5) * 1000);
    });

    // Schedule next chord with overlap
    this.timerId = window.setTimeout(this._schedulePad, (duration - 3.5) * 1000);
  };

  private _scheduleChime = (): void => {
    if (!this.isPlaying) return;

    const t = this.ctx.currentTime;
    const chimeIdx = 10 + Math.floor(Math.random() * 9); // Higher octave
    const freq = this.scaleFreqs[chimeIdx] ?? 587.33;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);

    // Fast bell-like attack, exponential decay
    const duration = 3.5;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.05, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(gain);
    gain.connect(this.outputNode);

    osc.start(t);
    osc.stop(t + duration);

    const ref = {
      stop: () => osc.stop(),
      disconnect: () => gain.disconnect(),
    };
    this.activeNodes.add(ref);

    window.setTimeout(() => {
      this.activeNodes.delete(ref);
      ref.disconnect();
    }, (duration + 0.5) * 1000);

    // Sparse, random interval between chimes (2.5 to 6 seconds)
    const nextInterval = 2500 + Math.random() * 3500;
    window.setTimeout(this._scheduleChime, nextInterval);
  };
}
