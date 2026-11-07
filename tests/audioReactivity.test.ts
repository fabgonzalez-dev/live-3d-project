import { describe, it, expect, vi } from 'vitest';
import { AudioAnalyser } from '../src/audio/AudioAnalyser';
import { AudioEngine } from '../src/audio/AudioEngine';
import { DEFAULT_STATE } from '../src/state/types';

function createMockAudioEnvironment(sampleRate = 44100) {
  let mockFrequencyData = new Uint8Array(256);

  const mockAnalyser = {
    fftSize: 512,
    smoothingTimeConstant: 0.6,
    frequencyBinCount: 256,
    getByteFrequencyData: vi.fn((arr: Uint8Array) => {
      arr.set(mockFrequencyData);
    }),
  };

  const mockContext = {
    sampleRate,
    createAnalyser: vi.fn(() => mockAnalyser),
  } as unknown as AudioContext;

  const mockSource = {
    connect: vi.fn(),
  } as unknown as AudioNode;

  return {
    mockContext,
    mockSource,
    mockAnalyser,
    setMockFrequencies: (data: number[]) => {
      mockFrequencyData = new Uint8Array(256);
      data.forEach((val, idx) => {
        if (idx < 256) mockFrequencyData[idx] = val;
      });
    },
  };
}

describe('Phase 7: Music Reactivity Engine', () => {
  it('initializes AudioAnalyser with default reactivity parameters and clamps bounds', () => {
    const { mockContext, mockSource } = createMockAudioEnvironment();
    const analyser = new AudioAnalyser(mockContext, mockSource);

    expect(analyser.getReactivityParams()).toEqual({
      reactivityIntensity: 1.0,
      bassScale: 1.0,
      beatPulseEnabled: true,
    });

    // Test parameter clamping
    analyser.setReactivityParams({
      reactivityIntensity: 3.5, // clamps to 2.0
      bassScale: -0.5,         // clamps to 0.0
      beatPulseEnabled: false,
    });

    expect(analyser.getReactivityParams()).toEqual({
      reactivityIntensity: 2.0,
      bassScale: 0.0,
      beatPulseEnabled: false,
    });
  });

  it('computes low, mid, high, and loudness bands from frequency bins', () => {
    const { mockContext, mockSource, setMockFrequencies } = createMockAudioEnvironment(44100);
    const analyser = new AudioAnalyser(mockContext, mockSource);

    // hzPerBin = 22050 / 256 = 86.13 Hz
    // Bin 1: ~86 Hz (low: 20..250 Hz)
    // Bin 5: ~430 Hz (mid: 250..2000 Hz)
    // Bin 35: ~3014 Hz (high: 2000..16000 Hz)
    const testData = new Array(256).fill(0);
    testData[1] = 255;
    testData[5] = 128;
    testData[35] = 200;
    setMockFrequencies(testData);

    const bands = analyser.update(0.016);

    expect(bands.reactivity).toBe(1.0);
    expect(bands.low).toBeGreaterThan(0);
    expect(bands.mid).toBeGreaterThan(0);
    expect(bands.high).toBeGreaterThan(0);
    expect(bands.loudness).toBeGreaterThan(0);
  });

  it('triggers onset and beat decay when transient bass hits occur', () => {
    const { mockContext, mockSource, setMockFrequencies } = createMockAudioEnvironment(44100);
    const analyser = new AudioAnalyser(mockContext, mockSource);

    // Warm up history with baseline silence
    for (let i = 0; i < 20; i++) {
      analyser.update(0.016);
    }

    // Heavy bass transient at bin 1 (~86 Hz)
    const heavyBass = new Array(256).fill(0);
    heavyBass[1] = 255;
    heavyBass[2] = 240;
    setMockFrequencies(heavyBass);

    const beatHit = analyser.update(0.016);
    expect(beatHit.onset).toBe(true);
    expect(beatHit.beat).toBeGreaterThan(0.5);

    // Silence next frame, beat should decay smoothly
    setMockFrequencies(new Array(256).fill(0));
    const postBeat = analyser.update(0.05);
    expect(postBeat.onset).toBe(false);
    expect(postBeat.beat).toBeLessThan(beatHit.beat);
  });

  it('provides safe non-reactive zero fallbacks when AudioEngine is uninitialized or paused', () => {
    const audioEngine = new AudioEngine();

    const bands = audioEngine.update(0.016);
    expect(bands).toEqual({
      low: 0,
      mid: 0,
      high: 0,
      loudness: 0,
      beat: 0,
      onset: false,
      longTermEnergy: 0,
      reactivity: 1.0,
    });
  });

  it('AudioEngine correctly applies reactivity state updates', () => {
    const audioEngine = new AudioEngine();

    audioEngine.applyState({
      reactivityIntensity: 1.65,
      bassScale: 1.4,
      beatPulseEnabled: false,
    });

    const state = audioEngine.getState();
    expect(state.reactivityIntensity).toBe(1.65);
    expect(state.bassScale).toBe(1.4);
    expect(state.beatPulseEnabled).toBe(false);

    // The uninitialized update will reflect the new reactivity multiplier
    const bands = audioEngine.update(0.016);
    expect(bands.reactivity).toBe(1.65);
  });

  it('DEFAULT_STATE provides complete valid audio reactivity defaults', () => {
    expect(DEFAULT_STATE.audio.reactivityIntensity).toBe(1.0);
    expect(DEFAULT_STATE.audio.bassScale).toBe(1.0);
    expect(DEFAULT_STATE.audio.beatPulseEnabled).toBe(true);
  });
});

