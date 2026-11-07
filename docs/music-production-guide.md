# Music & Audio Production Guide for Live 3D Broadcasts

This guide provides guidelines for curating, generating, and mastering ambient audio tracks for the Live 3D Studio broadcast pipeline.

---

## 1. Offline AI Music Generation Workflow

To guarantee 100% copyright safety and avoid automated Content ID muting on TikTok Live, follow this offline generation process:

### Recommended AI Audio Engines
1. **Stable Audio 2.0 / AudioCraft**:
   - Ideal for purely instrumental, generative ambient drones, evolving pads, and rhythmic textures without vocals.
   - Outputs uncompressed WAV/FLAC with clean frequency response down to 30 Hz.
2. **Suno / Udio (Instrumental Only)**:
   - When generating, **always check "Instrumental"**. Any generated pseudo-vocal syllables or singing voices risk automated voice/lyric copyright fingerprint false positives.
   - Specify structural prompt tags: `[Ambient]`, `[Evolving Pad]`, `[Meditation]`, `[No Drums]`, `[Instrumental]`.

### Post-Processing & Mastering Checklist
Before placing audio files into the public playlist folder (`public/audio/`):
- **Sample Rate & Bit Depth**: 48,000 Hz, 16-bit or 24-bit stereo WAV or 320 kbps MP3/AAC.
- **True Peak Limiting**: Normalize to **-1.0 dBFS True Peak** to avoid inter-sample clipping during TikTok's AAC transcoding.
- **Integrated Loudness**: Target **-16 LUFS** (ITU-R BS.1770-4). This matches TikTok and OBS broadcast standards and prevents platform auto-ducking.
- **High-Pass Filter**: Steep 24 dB/octave high-pass filter at **25 Hz** to remove inaudible sub-sonic rumble that wastes amplifier headroom.
- **Stereo Width**: Keep frequencies below **120 Hz centered in mono** to maintain punch and avoid phase cancellation on mobile device speakers.

---

## 2. Production Briefs by Scene

### Scene 1: Crystal Tunnel
- **Vibe**: Hypnotic, crystalline, infinite forward motion, deep negative space.
- **Harmonic Center**: D Minor (D Aeolian) or C# Minor.
- **Tempo**: 60–70 BPM (or free-time ambient pulse).
- **Instrumentation**:
  - Deep sine/sub-bass drone (40–80 Hz) with gentle 1/4-note amplitude sidechain modulation.
  - Granular glass chimes, bell harmonics, and celesta-like sparkles (2–8 kHz) with stereo ping-pong delay.
  - Warm analog lowpass-filtered pad (Juno-106 / Prophet-5 style) providing slow breathing chord beds.
- **Example AI Prompt**:
  > *"Deep hypnotic crystalline ambient pad, sub bass drone in D minor, sparkling glass bell arpeggios, infinite cavern reverb, warm analog filter sweeps, slow meditative tempo 65 bpm, no drums, instrumental only, pristine audio quality"*

### Scene 2: Aurora Passage
- **Vibe**: Ethereal, vast, weightless, celestial ribbons of light.
- **Harmonic Center**: F# Major / Eb Lydian (bright, wonder-filled, non-resolving).
- **Tempo**: 50–60 BPM (floating, unmetered).
- **Instrumentation**:
  - Slow bowed string swells (violins/cellos processed through massive shimmer reverbs).
  - Soft tape-saturated synth flutes and airy choral pads (wordless vowel pads).
  - Very sparse, delicate high-frequency star glints (> 5 kHz).
- **Example AI Prompt**:
  > *"Ethereal northern lights cinematic ambient, slow breathing orchestral string swells, shimmering vocal choir wash, vast spatial reverb, F sharp major celestial drone, 55 bpm, peaceful, instrumental, pristine high end"*

### Scene 3: Cosmic Garden
- **Vibe**: Organic, blossoming, rhythmic sacred geometry, warm and centering.
- **Harmonic Center**: A Minor / C Major (Pentatonic / Dorian).
- **Tempo**: 75–85 BPM (gentle downtempo groove).
- **Instrumentation**:
  - Kalimba, acoustic harp, and muted marimba plucks.
  - Soft brushed percussion or organic shaker pulse (subtle, never loud).
  - Resonant singing bowl drones and warm Rhodes electric piano chords.
- **Example AI Prompt**:
  > *"Organic downtempo ambient, sacred geometry mandala music, acoustic harp and kalimba plucks, warm acoustic singing bowls, gentle earthy rhythm, 80 bpm, uplifting meditative, instrumental"*

---

## 3. Seamless Loop Production Rules

1. **Zero-Crossing Slicing**: Ensure the start and end of any loop slice occur exactly at a waveform zero-crossing to prevent audible clicks.
2. **Bar & Phrase Alignment**: Cut files strictly in multiples of 16 or 32 bars to preserve musical phrase integrity.
3. **Crossfade Tails**: In your DAW (e.g. Ableton, Reaper, Audacity), split the final reverb/delay tail of the track and blend it into the opening bars with an equal-power crossfade curve.
4. **Equal-Power Web Audio Playback**: The Live 3D Studio `PlaylistEngine` implements automatic 8-second equal-power crossfades between tracks, ensuring continuous uninterrupted broadcast audio even across disparate song structures.

---

## 4. Rights, Licensing & TikTok Broadcast Safety

- **Platform Terms**: Ensure that any generative AI tool used includes full commercial broadcast rights under its subscription tier (e.g. Suno Pro/Premier, Udio Pro, Stable Audio commercial license).
- **No Derivative Works of Copyrighted Melodies**: Do not prompt with specific song titles, protected artist likenesses, or copyrighted melodies.
- **Broadcast Isolation**: The Live 3D Studio guarantees that audio only plays from the Display route (`/` or `/display`). The Operator control surface (`/control.html`) remains strictly silent to eliminate audio echo, double-monitoring, and feedback loops into OBS.
