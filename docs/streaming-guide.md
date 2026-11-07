# OBS Studio & TikTok Live Broadcast Streaming Guide

This guide provides step-by-step instructions for streaming **Live 3D Studio** into **OBS Studio**, **Streamlabs**, or **TikTok Live Studio** with optimal portrait performance and clean audio routing.

---

## 1. Canvas & Portrait Output Resolution

Live 3D Studio is engineered from the ground up for **9:16 vertical video**.

1. In OBS Studio, open **Settings → Video**.
2. Set **Base (Canvas) Resolution** to either:
   - `720x1280` (Standard HD Portrait — recommended for lower GPU load and 60 FPS stability)
   - `1080x1920` (Full HD Portrait — recommended for dedicated GPUs)
3. Set **Output (Scaled) Resolution** to match your Base Canvas (`720x1280` or `1080x1920`).
4. Set **Common FPS Values** to `30` or `60`.

---

## 2. Ingesting Visuals into OBS

### Method A: Browser Source (Recommended)

1. In OBS, click **+** under **Sources** and select **Browser**.
2. Name the source `3D Visual Background`.
3. Configure the source properties:
   - **URL**: `http://localhost:3001/` (production) or `http://localhost:5173/` (dev)
   - **Width**: `720` (or `1080`)
   - **Height**: `1280` (or `1920`)
   - **Custom CSS**:
     ```css
     body { background-color: #000; margin: 0; overflow: hidden; }
     ```
   - **Shutdown source when not visible**: Unchecked (keeps render loop and WebGL state alive during scene switches).
   - **Refresh browser when scene becomes active**: Unchecked.
4. Click **Interact** on the browser source once to click the **"Enter Live Studio"** start button. This unlocks Web Audio and initiates the Three.js pipeline.
5. In OBS **Settings → Advanced**, verify **"Enable Browser Source Hardware Acceleration"** is enabled.

### Method B: Window Capture

If your OBS browser source lacks WebGL 2.0 extension support on your OS:
1. Open Chrome, Edge, or Brave in a dedicated window.
2. Navigate to `http://localhost:3001/` and press F11 or use Window Snapping to set portrait dimensions.
3. In OBS, add a **Window Capture** source targeting the browser window.
4. Set **Capture Method** to `Windows 10 / macOS Screen Capture` for hardware-accelerated 60 FPS capture.

---

## 3. Audio Routing & Double-Monitoring Prevention

> [!IMPORTANT]
> **Single-Owner Audio Architecture**:
> To guarantee that audio never echoes or duplicates, audio playback only occurs on the **Display surface** (`/`).
> The **Operator Control Panel** (`/control`) is strictly silent and never initializes an `AudioContext`.

### Recommended Audio Setup

#### Option 1: "Control Audio via OBS" (Direct Ingest)
1. In the OBS Browser Source properties, check **"Control audio via OBS"**.
2. In the OBS **Audio Mixer**, you will now see `3D Visual Background`.
3. Click the gear icon on the source → **Advanced Audio Properties**:
   - Set **Audio Monitoring** to **Monitor and Output** (so you can hear it in your headphones while viewers hear it on stream).
   - Verify your microphone source is separate and not capturing headphone spill.

#### Option 2: Desktop Audio Loopback
1. Leave "Control audio via OBS" unchecked. The browser outputs sound to your default system audio device.
2. In OBS, capture **Desktop Audio**.
3. **DO NOT** enable both Desktop Audio and Browser Source audio simultaneously, or your stream will broadcast a doubled echo.

### Audio Limiter & Leveling
The Live 3D Studio engine features an internal `DynamicsCompressorNode` (-6 dB threshold, 8:1 ratio, 3ms attack) that prevents digital clipping. In OBS:
- Keep the studio audio meter peaking between **-6 dB and -3 dB** (yellow zone).
- Set your microphone to duck or balance comfortably over the ambient pad drone.

---

## 4. Operator Setup During Live Broadcasts

- **Display Surface**: Stays maximized or hidden inside the OBS capture pipeline on `http://localhost:3001/`.
- **Operator Control Panel**: Open in a standard browser tab on your second monitor or tablet:
  `http://localhost:3001/control`
- Use the control panel to:
  - Switch scenes (Crystal Tunnel, Aurora Passage, Cosmic Garden)
  - Select color palettes and adjust transition duration
  - Fine-tune travel speed, rotation, displacement, and bloom
  - Control audio mode (Procedural synth vs Playlist) and volume
  - Trigger simulated test events or voting rounds
  - Activate **Emergency Interactions Disable** if chat spam occurs

---

## 5. Long-Duration Soak Testing & Stability

- **Memory Leak Prevention**: All Three.js geometries, materials, shader programs, and render targets are explicitly disposed when switching scenes (`oldScene.dispose()`).
- **WebGL Context Loss Recovery**: If the OS GPU driver resets or hibernates, the display surface automatically intercepts `webglcontextlost`, pauses rendering, and gracefully reconstructs the WebGL context on `webglcontextrestored`.
- **24-Hour Soak Run**: For long marathon streams (e.g. lo-fi ambient channels), leave the display running with diagnostic overlay visible (press backtick \` to toggle). FPS should remain stable at your target (30/60 FPS) without increasing memory footprints.
