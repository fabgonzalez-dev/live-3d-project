/**
 * server/index.ts
 * Local Express + WebSocket server.
 * - Serves the built app or proxies to Vite in dev
 * - Maintains authoritative session state
 * - Broadcasts state changes to all connected clients
 * - Handles operator commands and simulator events
 * - Validates all incoming commands
 * - Binds to loopback only by default
 */
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_STATE, DEFAULT_VISUAL } from '../src/state/types.js';
import type { SessionState, VisualParams, SceneName, PaletteId } from '../src/state/types.js';

import { BUILT_IN_PRESETS, PresetSchema } from '../src/state/presets.js';
import { EventEngine } from './engine/EventEngine.js';
import { VotingEngine } from './engine/VotingEngine.js';
import { GiftEffectEngine } from './engine/GiftEffectEngine.js';

const eventEngine = new EventEngine({ maxQueueSize: 500, dedupTtlMs: 30_000, rateLimitPerSec: 10 });
const votingEngine = new VotingEngine(20_000);
const giftEffectEngine = new GiftEffectEngine();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env['SERVER_PORT'] ?? '3001', 10);
const ALLOWED_ORIGINS = (process.env['WS_ALLOWED_ORIGINS'] ?? 'http://localhost:5173,http://localhost:3001')
  .split(',').map(s => s.trim());

// ── Session state ─────────────────────────────────────────────
let sessionState: SessionState = {
  ...DEFAULT_STATE,
  visual: { ...DEFAULT_VISUAL },
  presets: { ...BUILT_IN_PRESETS },
};

// ── Express app ───────────────────────────────────────────────
const app = express();
app.use(express.json());

// Serve built static files in production
const distDir = path.resolve(__dirname, '../dist');
app.use(express.static(distDir));

// Control route
app.get('/control', (_req, res) => {
  res.sendFile(path.join(distDir, 'control.html'));
});

// Display route (root)
app.get('/', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

// REST: get current state (for initial load without WebSocket)
app.get('/api/state', (_req, res) => {
  res.json(sessionState);
});

// ── HTTP server + WebSocket ───────────────────────────────────
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

const clients: Set<WebSocket> = new Set();
let displayCount = 0;

function broadcast(msg: object, exclude?: WebSocket): void {
  const text = JSON.stringify(msg);
  for (const client of clients) {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(text);
    }
  }
}

function patchState(patch: Partial<SessionState>): void {
  sessionState = { ...sessionState, ...patch };
  broadcast({ kind: 'state_patch', payload: patch });
}

// ── Command handlers ──────────────────────────────────────────
const SceneNameSchema = z.enum(['tunnel', 'aurora', 'garden', 'city']);
const PaletteIdSchema = z.enum(['blue-violet', 'magenta-plum', 'teal-cyan', 'emerald-blue', 'warm-amber', 'soft-pastel']);

const VisualParamPatchSchema = z.object({
  travelSpeed:      z.number().min(0).max(2).optional(),
  rotationSpeed:    z.number().min(0).max(1).optional(),
  displacementAmp:  z.number().min(0).max(1).optional(),
  twistAmount:      z.number().min(0).max(3).optional(),
  particleDensity:  z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  bloomStrength:    z.number().min(0).max(3).optional(),
  bloomRadius:      z.number().min(0).max(1).optional(),
  bloomThreshold:   z.number().min(0).max(1).optional(),
  exposure:         z.number().min(0.1).max(3).optional(),
  renderScale:      z.number().min(0.5).max(1).optional(),
  fpsTarget:        z.union([z.literal(30), z.literal(60)]).optional(),
  toneMapping:      z.enum(['agx', 'aces']).optional(),
  vignetteStrength: z.number().min(0).max(1).optional(),
  grainIntensity:   z.number().min(0).max(0.1).optional(),
  qualityPreset:    z.enum(['low', 'medium', 'high', 'ultra']).optional(),
}).strict();

type CommandHandler = (params: Record<string, unknown>) => void;

const commandHandlers: Record<string, CommandHandler> = {
  scene_change: (p) => {
    const r = SceneNameSchema.safeParse(p['scene']);
    if (r.success) patchState({ scene: r.data as SceneName });
  },
  palette_change: (p) => {
    const r = PaletteIdSchema.safeParse(p['palette']);
    const dur = typeof p['durationMs'] === 'number' ? Math.min(Math.max(p['durationMs'], 500), 30_000) : 5000;
    if (r.success) {
      patchState({
        palette: r.data as PaletteId,
        transition: {
          fromPalette: sessionState.palette,
          toPalette:   r.data as PaletteId,
          progress:    0,
          durationMs:  dur,
          startedAt:   Date.now(),
        },
      });
    }
  },
  set_visual: (p) => {
    const r = VisualParamPatchSchema.safeParse(p);
    if (r.success) {
      const newVisual: VisualParams = { ...sessionState.visual, ...r.data };
      patchState({ visual: newVisual });
    }
  },
  disable_interactions: () => patchState({ interactionsEnabled: false }),
  enable_interactions:  () => patchState({ interactionsEnabled: true }),
  reset_defaults: () => {
    sessionState = { ...DEFAULT_STATE, visual: { ...DEFAULT_VISUAL }, presets: sessionState.presets };
    broadcast({ kind: 'state_snapshot', payload: sessionState });
  },
  sim_event: (p) => {
    if (!sessionState.interactionsEnabled) {
      console.info('[Server] Interaction ignored (emergency interactions disabled)');
      return;
    }

    const type = (p['type'] as string) ?? 'chat';
    const userId = (p['userId'] as string) ?? 'sim-user-1';
    const displayName = (p['displayName'] as string) ?? 'Viewer';

    // 1. Ingest event through engine
    const normEvent = {
      id: `sim-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      provider: 'simulator' as const,
      receivedAt: Date.now(),
      type: type as never,
      userId,
      displayName,
      payload: p as never,
    };

    const accepted = eventEngine.ingest(normEvent);
    if (!accepted) return;

    // 2. Voting handling
    if (type === 'vote') {
      const choice = String(p['choice'] ?? '');
      if (!votingEngine.getState().isActive) {
        votingEngine.startRound(20_000);
      }
      votingEngine.vote(userId, choice);
      const tallies = votingEngine.getTallies();
      const leader = votingEngine.getLeader();
      broadcast({
        kind: 'event',
        payload: {
          ...normEvent,
          payload: { choice, tallies, leader },
        },
      });
      return;
    }

    // 3. Like handling
    if (type === 'like') {
      const count = typeof p['count'] === 'number' ? p['count'] : 1;
      const isCumulative = Boolean(p['isCumulative']);
      const delta = eventEngine.processLikes(count, isCumulative);
      const trigger = giftEffectEngine.resolveLikes(delta);
      broadcast({
        kind: 'event',
        payload: {
          ...normEvent,
          payload: { count, delta, totalLikes: eventEngine.getTotalLikes(), trigger },
        },
      });
      return;
    }

    // 4. Gift handling
    if (type === 'gift') {
      const giftName = String(p['giftName'] ?? 'Rose');
      const streak = typeof p['streak'] === 'number' ? p['streak'] : 1;
      const streakEnd = Boolean(p['isStreakEnd']);
      const trackedStreak = eventEngine.trackGiftStreak(userId, giftName, streak, streakEnd);
      const trigger = giftEffectEngine.resolveGift(giftName, trackedStreak, displayName);
      broadcast({
        kind: 'event',
        payload: {
          ...normEvent,
          payload: { giftName, streak: trackedStreak, trigger },
        },
      });
      return;
    }

    // 5. Default broadcast
    broadcast({ kind: 'event', payload: normEvent });
  },
  save_preset: (p) => {
    const name = typeof p['name'] === 'string' ? p['name'].trim() : '';
    if (name) {
      const newPreset = {
        version: 1 as const,
        name,
        scene: sessionState.scene,
        palette: sessionState.palette,
        visual: { ...sessionState.visual },
        transitionDurationMs: 4000,
      };
      const presets = { ...sessionState.presets, [name]: newPreset };
      patchState({ presets });
    }
  },
  load_preset: (p) => {
    const name = typeof p['name'] === 'string' ? p['name'] : '';
    const target = sessionState.presets[name] ?? BUILT_IN_PRESETS[name];
    if (target) {
      patchState({
        scene: target.scene,
        palette: target.palette,
        visual: { ...target.visual },
      });
    }
  },
  import_presets: (p) => {
    const raw = p['presets'];
    if (typeof raw === 'object' && raw !== null) {
      const merged = { ...sessionState.presets };
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        const parsed = PresetSchema.safeParse(v);
        if (parsed.success) {
          merged[k] = parsed.data;
        }
      }
      patchState({ presets: merged });
    }
  },
  sim_burst: (p) => {
    const count = Math.min(typeof p['count'] === 'number' ? p['count'] : 10, 1000);
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        broadcast({
          kind: 'event',
          payload: {
            id: `burst-${i}-${Date.now()}`,
            provider: 'simulator',
            receivedAt: Date.now(),
            type: 'chat',
            displayName: `User${i}`,
            payload: { text: `Test message ${i}`, isCommand: false },
          },
        });
      }, i * 5);
    }
  },
  audio_play: () => {
    patchState({ audio: { ...sessionState.audio, playing: true } });
  },
  audio_pause: () => {
    patchState({ audio: { ...sessionState.audio, playing: false } });
  },
  audio_set_volume: (p) => {
    const vol = typeof p['volume'] === 'number' ? Math.max(0, Math.min(1, p['volume'])) : 0.8;
    patchState({ audio: { ...sessionState.audio, volume: vol } });
  },
  audio_set_mute: (p) => {
    const muted = Boolean(p['muted']);
    patchState({ audio: { ...sessionState.audio, muted } });
  },
  audio_set_mode: (p) => {
    const mode = p['mode'] === 'playlist' ? 'playlist' : 'procedural';
    patchState({ audio: { ...sessionState.audio, mode } });
  },
  audio_set_reactivity: (p) => {
    const intensity = typeof p['reactivityIntensity'] === 'number'
      ? Math.max(0, Math.min(2, p['reactivityIntensity']))
      : sessionState.audio.reactivityIntensity;
    const bassScale = typeof p['bassScale'] === 'number'
      ? Math.max(0, Math.min(2, p['bassScale']))
      : sessionState.audio.bassScale;
    const beatPulse = typeof p['beatPulseEnabled'] === 'boolean'
      ? p['beatPulseEnabled']
      : sessionState.audio.beatPulseEnabled;
    patchState({
      audio: {
        ...sessionState.audio,
        reactivityIntensity: intensity,
        bassScale,
        beatPulseEnabled: beatPulse,
      },
    });
  },
  audio_next: () => {
    broadcast({ kind: 'audio_action', action: 'next' });
  },
  audio_prev: () => {
    broadcast({ kind: 'audio_action', action: 'prev' });
  },
  display_ready: (p) => {
    sessionState.displayActive = true;
    if (p['audioPlaying']) {
      sessionState.audio.playing = true;
    }
    broadcast({ kind: 'state_patch', payload: { displayActive: true, audio: sessionState.audio } });
  },
};
wss.on('connection', (ws, req) => {
  // Origin check (loopback only by default)
  const origin = req.headers.origin ?? '';
  if (ALLOWED_ORIGINS.length > 0 && !ALLOWED_ORIGINS.includes(origin)) {
    ws.close(1008, 'Origin not allowed');
    return;
  }

  clients.add(ws);
  const isDisplay = req.url?.includes('display=1') ?? false;
  if (isDisplay) {
    displayCount++;
    if (displayCount > 1) {
      ws.send(JSON.stringify({
        kind: 'error',
        payload: { message: `Warning: ${displayCount} display instances detected. Disable audio on extras.` },
      }));
    }
  }

  // Send current state as snapshot to new client
  ws.send(JSON.stringify({ kind: 'state_snapshot', payload: sessionState }));

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.kind === 'command') {
        const { command, params } = msg.payload ?? {};
        const handler = commandHandlers[command as string];
        if (handler && typeof params === 'object' && params !== null) {
          handler(params as Record<string, unknown>);
        }
      }
      if (msg.kind === 'diagnostics') {
        const d = { ...(msg.payload ?? {}), queueSize: eventEngine.getQueueSize() };
        broadcast({ kind: 'diagnostics', payload: d }, ws);
      }
    } catch {
      // malformed — ignore
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    if (isDisplay) displayCount = Math.max(0, displayCount - 1);
  });

  ws.on('error', () => clients.delete(ws));
});

// ── Palette transition & Voting ticker ───────────────────────
setInterval(() => {
  // 1. Palette transition progression
  if (sessionState.transition) {
    const { startedAt, durationMs } = sessionState.transition;
    const elapsed = Date.now() - startedAt;
    const t = Math.min(elapsed / durationMs, 1);
    const transition = t >= 1 ? null : { ...sessionState.transition, progress: t };
    if (t >= 1) {
      patchState({ transition: null });
    } else {
      patchState({ transition });
    }
  }

  // 2. Voting round completion resolution
  const vState = votingEngine.getState();
  if (vState.isActive && Date.now() - vState.roundStartTime >= vState.durationMs) {
    const winner = votingEngine.endRound();
    if (winner && winner !== sessionState.palette) {
      console.info(`[Voting] Round complete! Winning palette: ${winner}`);
      patchState({
        palette: winner,
        transition: {
          fromPalette: sessionState.palette,
          toPalette: winner,
          progress: 0,
          durationMs: 4000,
          startedAt: Date.now(),
        },
      });
    }
  }
}, 16); // ~60hz ticker

// ── Diagnostics broadcast ─────────────────────────────────────
// Display sends diagnostics every 500ms; server rebroadcasts to control panels
// (wired in Milestone B; placeholder interval here)

// ── Start ─────────────────────────────────────────────────────
httpServer.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🎨 Live 3D Studio server running`);
  console.log(`   Display:  http://localhost:${PORT}/`);
  console.log(`   Control:  http://localhost:${PORT}/control`);
  console.log(`   WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`\n   In dev mode, Vite serves on port 5173`);
  console.log(`   Open http://localhost:5173 for display\n`);
});
