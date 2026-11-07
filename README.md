# Live 3D Studio — Interactive Audiovisual Broadcast Pipeline

An immersive, broadcast-grade 3D interactive graphics and audio studio tailored for **TikTok Live**, **OBS Studio**, and vertical live streaming formats (9:16 portrait).

Built with **Three.js (0.169.0)**, **WebGL 2.0**, **GLSL Shaders**, **Web Audio API**, **TypeScript**, and a decoupled authoritative **Node/WebSocket** backend.

---

## Architecture Overview

```mermaid
graph TD
    subgraph Browser Clients
        Display["Broadcast Display Surface (/)\nThree.js + PostProcessing\nSingle-Owner Web Audio Engine"]
        Control["Operator Control Panel (/control)\nInteractive Sliders & Presets\nSimulator & Diagnostics (Silent)"]
    end

    subgraph Authoritative Backend (Node / WebSocket)
        Server["Server (server/index.ts)\nLoopback Authoritative State Store"]
        EventEng["EventEngine\nBounded Queue | Dedup TTL | Rate Limiting | XSS Sanitizer"]
        VoteEng["VotingEngine\n20s Rounds | Bilingual Aliases | FIFO Tie-Break"]
        GiftEng["GiftEffectEngine\nTier Mapping | Cooldowns | Scene Triggers"]
    end

    Display <-->|ws://localhost:3001/ws\nstate_patch, diagnostics, triggers| Server
    Control <-->|ws://localhost:3001/ws\ncommands, diagnostics snapshot| Server

    Server --> EventEng
    Server --> VoteEng
    Server --> GiftEng
```

---

## Key Features

### 1. Flagship Visuals & Environments
- **Crystal Tunnel**: Authentic flat polygonal crystal facets (`dFdx`/`dFdy` screen-space derivatives), multi-angle specular glints, rich saturated blue/violet/magenta jewel tones, and a deep, velvety black vanishing point. GPU-side depth wrapped star particles.
- **Aurora Passage**: Undulating translucent curtains of northern light ribbons with vertical filaments, celestial stardust, and slow panoramic camera drifting.
- **Cosmic Garden**: Sacred geometry radial mandala blossoms, rotating constellation geometry nodes, and floating luminous spores.

### 2. Restrained Cinematic Post-Processing
- **UnrealBloomPass**: Calibrated to glow only on high-energy specular crystal glints and star cores without washing out the central void into a white haze.
- **Adaptive Quality Manager**: Dynamically tracks frame time and smoothly scales render resolution to guarantee stable 30 or 60 FPS output.
- **WebGL Context-Loss Recovery**: Automatically intercepts driver resets or OS hibernation and restores the Three.js pipeline without page refresh.

### 3. Integrated Audio Engine
- **Single-Owner Audio Architecture**: Audio plays exclusively on the Display surface. The Operator panel remains strictly silent to eliminate OBS echo loops.
- **Generative Ambient Synth**: Zero-asset procedural synthesizer using Web Audio oscillators, lowpass harmonic filters, and sparse D minor pentatonic chimes.
- **Progressive Playlist Engine**: Memory-bounded playback supporting local audio files with equal-power crossfades.
- **Audio Analyser & Visual Modulation**: 4-band real-time FFT (bass, mid, high, loudness) driving subtle tunnel emissive breathing and bloom reactivity without camera shake.
- **Broadcast Safety Limiter**: Built-in `DynamicsCompressorNode` preventing digital clipping.

### 4. Authoritative Interaction & Voting
- **Event Engine**: Bounded FIFO queue (500 events), TTL deduplication (30s), rate limiting (10 events/sec/user), and HTML entity sanitization.
- **20-Second Color Voting**: Supports English and Spanish color aliases (`blue`/`azul`, `pink`/`rosa`, `teal`/`turquesa`), 1 vote per user with instant replacement, and strict FIFO tie-breaking.
- **Gift Trigger Effects**: Maps gifts and like surges to `sparkle_wave`, `constellation_flash`, and `aurora_veil` scene triggers with cooldown protection.

---

## Quickstart

### Prerequisites
- Node.js 18+ (Node 20 recommended)
- Chromium or WebKit browser with WebGL 2.0

### Installation & Development
```bash
# Install dependencies
npm install

# Start development mode (Vite on :5173, WebSocket on :3001)
npm run dev
```

Open:
- **Display Output**: [http://localhost:5173/](http://localhost:5173/)
- **Operator Control Panel**: [http://localhost:5173/control.html](http://localhost:5173/control.html)

### Production Build & Serve
```bash
# Typecheck and build optimized bundle
npm run build

# Run standalone production server
npm run serve
```
Open:
- **Display Output**: [http://localhost:3001/](http://localhost:3001/)
- **Operator Control Panel**: [http://localhost:3001/control](http://localhost:3001/control)

### Automated Test Suite
```bash
# Run Vitest unit tests
npm test
```

---

## Documentation Links

- [Setup & Installation Guide](docs/setup.md)
- [OBS Studio & Streaming Guide](docs/streaming-guide.md)
- [Music & Audio Production Guide](docs/music-production-guide.md)

---

## Presets & State Schema

| Preset Name | Scene | Palette | Highlights |
| :--- | :--- | :--- | :--- |
| **Deep Crystal Void** | `tunnel` | `blue-violet` | Deep black center, indigo/violet facets, electric blue star cores |
| **Neon Plum Odyssey** | `tunnel` | `magenta-plum` | Saturated magenta crystal mirrors, neon purple accents |
| **Emerald Aurora** | `aurora` | `emerald-blue` | Ethereal green and cyan waving curtains |
| **Cyber Borealis** | `aurora` | `teal-cyan` | High-tech turquoise and electric cyan light ribbons |
| **Cosmic Sanctuary** | `garden` | `warm-amber` | Golden sacred geometry mandalas with amber star nodes |
| **Pastel Blossom** | `garden` | `soft-pastel` | Soft lavender and petal-rose blossoming geometry |

---

## Known Constraints & Design Guardrails
- **Three.js Version**: Locked to `0.169.0` WebGLRenderer (WebGPU code intentionally omitted for universal OBS CEF compatibility).
- **Portrait Aspect Ratio**: Optimized for 720×1280 and 1080×1920 (9:16).
- **Loopback Default**: Service binds to `127.0.0.1` by default to prevent unauthorized network access during live broadcasts.
