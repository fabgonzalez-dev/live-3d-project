# Setup & Installation Guide

This document details prerequisites, environment setup, and running procedures for **Live 3D Studio**.

---

## 1. Prerequisites

- **Node.js**: v18.0.0 or later (v20+ recommended)
- **Package Manager**: npm v9+ (or pnpm / yarn)
- **Browser / Display**: Any modern Chromium or WebKit browser with WebGL 2.0 and Web Audio API support (Chrome, Edge, Brave, Safari 16+)
- **GPU Hardware**: Dedicated or integrated GPU with support for WebGL extensions (`EXT_color_buffer_float`, `OES_texture_float_linear`). Tested on Apple Silicon (M1/M2/M3) and NVIDIA RTX series.

---

## 2. Installation

Clone or open the repository workspace and install project dependencies:

```bash
cd live_3d_project
npm install
```

---

## 3. Configuration & Environment Variables

Copy the example environment configuration:

```bash
cp .env.example .env
```

| Variable | Default | Description |
| :--- | :--- | :--- |
| `SERVER_PORT` | `3001` | Local port for Express and WebSocket server |
| `WS_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3001` | Comma-delimited list of allowed loopback HTTP origins |
| `NODE_ENV` | `development` | Runtime environment (`development` or `production`) |

---

## 4. Running the Project

### Option A: Development Mode (Hot Reloading)

Starts the authoritative backend server (`tsx watch server/index.ts`) and Vite client dev server concurrently:

```bash
npm run dev
```

- **Broadcast Display Output**: [http://localhost:5173/](http://localhost:5173/)
- **Operator Control Panel**: [http://localhost:5173/control.html](http://localhost:5173/control.html)
- **Authoritative Backend**: `ws://localhost:3001/ws`

### Option B: Production Mode (Serving Pre-built Bundle)

Build the optimized production assets and serve directly from the standalone Node server:

```bash
# 1. Typecheck and build production bundle into dist/
npm run build

# 2. Start authoritative standalone server
npm run serve
```

- **Broadcast Display Output**: [http://localhost:3001/](http://localhost:3001/)
- **Operator Control Panel**: [http://localhost:3001/control](http://localhost:3001/control)

---

## 5. Verification & Tests

To run the complete automated test suite (including Event Engine, Voting Engine, Gift Effects, and Presets):

```bash
# Run Vitest test suite once
npm test

# Run Vitest in interactive watch mode
npm run test:watch

# Run TypeScript static type checking
npm run typecheck
```
