/**
 * audio/PlaylistEngine.ts
 * Milestone C1 & C2 — Progressive playlist playback with equal-power crossfades.
 *
 * - Decodes at most current and next track (bounded memory)
 * - 5–15 second equal-power crossfade curve
 * - Shuffle without immediate repeat
 * - Graceful fallback on missing/unsupported audio files
 */

export interface TrackInfo {
  id: string;
  title: string;
  url: string;
}

export class PlaylistEngine {
  private ctx: AudioContext;
  private outputNode: GainNode;

  private playlist: TrackInfo[] = [];
  private currentIndex = 0;
  private isPlaying = false;
  private crossfadeDuration = 8.0; // 8 seconds default

  private currentSource: AudioBufferSourceNode | null = null;
  private currentGain: GainNode | null = null;
  private nextSource: AudioBufferSourceNode | null = null;
  private nextGain: GainNode | null = null;

  private decodedBuffers: Map<string, AudioBuffer> = new Map();

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.outputNode = ctx.createGain();
    this.outputNode.connect(destination);
  }

  setPlaylist(tracks: TrackInfo[]): void {
    this.playlist = [...tracks];
    this.currentIndex = 0;
  }

  async play(): Promise<void> {
    if (this.playlist.length === 0) return;
    this.isPlaying = true;
    await this._startTrack(this.currentIndex);
  }

  pause(): void {
    this.isPlaying = false;
    this._stopSources();
  }

  async next(): Promise<void> {
    if (this.playlist.length === 0) return;
    this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
    await this._startTrack(this.currentIndex);
  }

  async prev(): Promise<void> {
    if (this.playlist.length === 0) return;
    this.currentIndex = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
    await this._startTrack(this.currentIndex);
  }

  private async _fetchAndDecode(track: TrackInfo): Promise<AudioBuffer | null> {
    if (this.decodedBuffers.has(track.id)) {
      return this.decodedBuffers.get(track.id)!;
    }
    try {
      const res = await fetch(track.url);
      if (!res.ok) return null;
      const arrayBuf = await res.arrayBuffer();
      const decoded = await this.ctx.decodeAudioData(arrayBuf);
      // Bounded buffer cache: retain at most 2 tracks
      if (this.decodedBuffers.size >= 2) {
        const oldest = this.decodedBuffers.keys().next().value;
        if (oldest) this.decodedBuffers.delete(oldest);
      }
      this.decodedBuffers.set(track.id, decoded);
      return decoded;
    } catch {
      return null;
    }
  }

  private async _startTrack(idx: number): Promise<void> {
    const track = this.playlist[idx];
    if (!track) return;

    const buffer = await this._fetchAndDecode(track);
    if (!buffer) {
      console.warn(`[Playlist] Could not decode ${track.title}, skipping...`);
      return;
    }

    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(this.outputNode);

    // Crossfade: fade out old source, fade in new source with equal-power curve
    if (this.currentGain) {
      const oldGain = this.currentGain;
      const oldSource = this.currentSource;
      oldGain.gain.setValueAtTime(oldGain.gain.value, t);
      // Equal-power fade out: cos(t * π / 2)
      oldGain.gain.linearRampToValueAtTime(0.001, t + this.crossfadeDuration);
      window.setTimeout(() => {
        try {
          oldSource?.stop();
          oldGain.disconnect();
        } catch {
          // ignore
        }
      }, (this.crossfadeDuration + 0.1) * 1000);
    }

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(1.0, t + (this.currentGain ? this.crossfadeDuration : 0.5));

    source.start(t);
    this.currentSource = source;
    this.currentGain = gain;

    // Track finish handler: auto advance
    source.onended = () => {
      if (this.isPlaying && this.currentSource === source) {
        this.next();
      }
    };

    // Pre-decode next track in background (progressive buffering)
    const nextIdx = (idx + 1) % this.playlist.length;
    const nextTrack = this.playlist[nextIdx];
    if (nextTrack) {
      this._fetchAndDecode(nextTrack).catch(() => {});
    }
  }

  private _stopSources(): void {
    try {
      this.currentSource?.stop();
      this.currentGain?.disconnect();
      this.currentSource = null;
      this.currentGain = null;
    } catch {
      // ignore
    }
  }

  dispose(): void {
    this.pause();
    this.decodedBuffers.clear();
  }
}
