/**
 * audio/AudioEngine.ts
 * Milestone C — Unified Audio Engine.
 *
 * Responsibilities:
 * - Single-owner audio state (lives strictly on the display surface).
 * - Soft-clip limiter / DynamicsCompressorNode to prevent clipping & distortion.
 * - Master volume and mute control with clickless linear ramps.
 * - Manages ProceduralSynth and PlaylistEngine sources into AudioAnalyser.
 * - Exposes real-time audio bands for visual modulation.
 */

import { AudioAnalyser, type AudioBands } from './AudioAnalyser';
import { ProceduralSynth } from './ProceduralSynth';
import { PlaylistEngine, type TrackInfo } from './PlaylistEngine';
import type { AudioState } from '../state/types';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private submixGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;

  private analyser: AudioAnalyser | null = null;
  private synth: ProceduralSynth | null = null;
  private playlist: PlaylistEngine | null = null;

  private state: AudioState = {
    playing: false,
    volume: 0.8,
    muted: false,
    currentTrack: null,
    nextTrack: null,
    mode: 'procedural',
    reactivityIntensity: 1.0,
    bassScale: 1.0,
    beatPulseEnabled: true,
  };

  private isInitialized = false;

  constructor() {}

  /**
   * Initializes Web Audio graph on explicit user gesture.
   */
  async init(): Promise<void> {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      return;
    }

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    // 1. Master Output Gain
    this.masterGain = this.ctx.createGain();
    const effectiveGain = this.state.muted ? 0 : this.state.volume;
    this.masterGain.gain.setValueAtTime(effectiveGain, this.ctx.currentTime);

    // 2. Dynamics Compressor / Soft-clip limiter (Milestone C6 broadcast safety)
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-6.0, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(12.0, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(8.0, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

    // 3. Submix bus where all sources combine before compression and analysis
    this.submixGain = this.ctx.createGain();
    this.submixGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

    // Connect: submix -> compressor -> masterGain -> destination
    this.submixGain.connect(this.compressor);
    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // 4. Connect Analyser to submix bus (post-source, pre-compression or pre-master)
    this.analyser = new AudioAnalyser(this.ctx, this.submixGain);

    // 5. Initialize Sources connected to submixGain
    this.synth = new ProceduralSynth(this.ctx, this.submixGain);
    this.playlist = new PlaylistEngine(this.ctx, this.submixGain);

    this.isInitialized = true;

    // If initial state specified playing, start selected mode
    if (this.state.playing) {
      this._startActiveSource();
    }
  }

  setPlaylistTracks(tracks: TrackInfo[]): void {
    this.playlist?.setPlaylist(tracks);
  }

  start(): void {
    this.state.playing = true;
    if (!this.isInitialized || !this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this._startActiveSource();
  }

  stop(): void {
    this.state.playing = false;
    this.synth?.stop();
    this.playlist?.pause();
  }

  setVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol));
    this.state.volume = clamped;
    if (this.masterGain && this.ctx) {
      const target = this.state.muted ? 0 : clamped;
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.05);
    }
  }

  setMuted(muted: boolean): void {
    this.state.muted = muted;
    if (this.masterGain && this.ctx) {
      const target = muted ? 0 : this.state.volume;
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.05);
    }
  }

  setMode(mode: 'procedural' | 'playlist'): void {
    if (this.state.mode === mode) return;
    this.state.mode = mode;

    if (this.state.playing && this.isInitialized) {
      if (mode === 'procedural') {
        this.playlist?.pause();
        this.synth?.start();
      } else {
        this.synth?.stop();
        this.playlist?.play().catch(() => {});
      }
    }
  }

  nextTrack(): void {
    if (this.state.mode === 'playlist') {
      this.playlist?.next().catch(() => {});
    }
  }

  prevTrack(): void {
    if (this.state.mode === 'playlist') {
      this.playlist?.prev().catch(() => {});
    }
  }

  private _startActiveSource(): void {
    if (this.state.mode === 'procedural') {
      this.playlist?.pause();
      this.synth?.start();
    } else {
      this.synth?.stop();
      this.playlist?.play().catch(() => {});
    }
  }

  /**
   * Updates frequency analyser and returns smoothed band values.
   * Safe to call every frame.
   */
  update(dt: number = 0.016): AudioBands {
    if (!this.analyser || !this.isInitialized || !this.state.playing) {
      return {
        low: 0,
        mid: 0,
        high: 0,
        loudness: 0,
        beat: 0,
        onset: false,
        longTermEnergy: 0,
        reactivity: this.state.reactivityIntensity,
      };
    }
    return this.analyser.update(dt);
  }

  getState(): AudioState {
    return { ...this.state };
  }

  applyState(audioState: Partial<AudioState>): void {
    if (audioState.volume !== undefined && audioState.volume !== this.state.volume) {
      this.setVolume(audioState.volume);
    }
    if (audioState.muted !== undefined && audioState.muted !== this.state.muted) {
      this.setMuted(audioState.muted);
    }
    if (audioState.mode !== undefined && audioState.mode !== this.state.mode) {
      this.setMode(audioState.mode);
    }
    if (audioState.reactivityIntensity !== undefined) {
      this.state.reactivityIntensity = audioState.reactivityIntensity;
    }
    if (audioState.bassScale !== undefined) {
      this.state.bassScale = audioState.bassScale;
    }
    if (audioState.beatPulseEnabled !== undefined) {
      this.state.beatPulseEnabled = audioState.beatPulseEnabled;
    }
    if (this.analyser) {
      this.analyser.setReactivityParams({
        reactivityIntensity: this.state.reactivityIntensity,
        bassScale: this.state.bassScale,
        beatPulseEnabled: this.state.beatPulseEnabled,
      });
    }
    if (audioState.playing !== undefined && audioState.playing !== this.state.playing) {
      if (audioState.playing) {
        this.start();
      } else {
        this.stop();
      }
    }
  }

  dispose(): void {
    this.stop();
    this.playlist?.dispose();
    this.masterGain?.disconnect();
    this.compressor?.disconnect();
    this.submixGain?.disconnect();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
    }
    this.ctx = null;
    this.isInitialized = false;
  }
}
