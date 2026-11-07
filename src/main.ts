/**
 * main.ts — Display surface entry point
 *
 * Owns the render loop, scene lifecycle, smooth scene transitions,
 * WebSocket state synchronization, and WebGL context-loss recovery.
 */
import { RenderingManager } from './rendering/RenderingManager';
import { CrystalTunnelScene } from './scenes/CrystalTunnelScene';
import { AuroraPassageScene } from './scenes/AuroraPassageScene';
import { CosmicGardenScene } from './scenes/CosmicGardenScene';
import { NeonCityScene } from './scenes/NeonCityScene';
import type { SceneLifecycle } from './scenes/SceneLifecycle';
import { StateStore } from './state/StateStore';
import { WsClient } from './shared/WsClient';
import { PALETTES } from './state/palettes';
import type { SceneName } from './state/types';
import { AudioEngine } from './audio/AudioEngine';
import { TransitionDirector, type TransitionTechnique } from './transitions/TransitionDirector';

// ── DOM refs ──────────────────────────────────────────────────
const canvas         = document.getElementById('main-canvas')        as HTMLCanvasElement;
const activationEl   = document.getElementById('activation-overlay') as HTMLDivElement;
const startBtn       = document.getElementById('start-btn')           as HTMLButtonElement;
const diagPanel      = document.getElementById('diag-panel')          as HTMLDivElement;
const diagFps        = document.getElementById('diag-fps')!;
const diagQuality    = document.getElementById('diag-quality')!;
const diagDrawcalls  = document.getElementById('diag-drawcalls')!;
const diagTris       = document.getElementById('diag-tris')!;
const diagConn       = document.getElementById('diag-conn')!;

// ── Audio Engine (Single-owner on /display) ────────────────────
const audioEngine = new AudioEngine();

// ── State + WebSocket ─────────────────────────────────────────
const store = new StateStore();
const wsUrl = `ws://${window.location.hostname}:3001/ws?display=1`;
const wsClient = new WsClient(wsUrl);

wsClient.onMessage((msg) => {
  if (msg.kind === 'state_snapshot') store.applySnapshot(msg.payload as never);
  if (msg.kind === 'state_patch')    store.applyPatch(msg.payload as never);
  if (msg.kind === 'audio_action') {
    if (msg['action'] === 'next') audioEngine.nextTrack();
    if (msg['action'] === 'prev') audioEngine.prevTrack();
  }
});

wsClient.onStatus((status) => {
  diagConn.textContent = `WS: ${status}`;
});

wsClient.connect();

// ── Scene Factory ─────────────────────────────────────────────
function createScene(name: SceneName, state = store.getState()): SceneLifecycle {
  switch (name) {
    case 'city':
      return new NeonCityScene(state.visual, state.palette);
    case 'aurora':
      return new AuroraPassageScene(state.visual, state.palette);
    case 'garden':
      return new CosmicGardenScene(state.visual, state.palette);
    case 'tunnel':
    default:
      return new CrystalTunnelScene(state.visual, state.palette);
  }
}

// ── Boot on user gesture ──────────────────────────────────────
startBtn.addEventListener('click', async () => {
  activationEl.classList.add('fade-out');
  setTimeout(() => activationEl.classList.add('hidden'), 700);

  // Milestone C6: Unlock audio on explicit user gesture
  try {
    await audioEngine.init();
    audioEngine.start();
    wsClient.send({
      kind: 'command',
      payload: { command: 'display_ready', params: { audioPlaying: true } },
    });
  } catch (err) {
    console.warn('[Audio] Failed to initialize AudioContext:', err);
  }

  const initialParams = store.getState().visual;
  let renderer = new RenderingManager(canvas, initialParams);
  const transitionDirector = new TransitionDirector();

  let currentSceneName: SceneName = store.getState().scene;
  let currentScene: SceneLifecycle = createScene(currentSceneName);
  currentScene.initialize();
  renderer.attachScene(currentScene.scene, currentScene.camera);

  // Prewarm initial shaders
  renderer.renderer.compile(currentScene.scene, currentScene.camera);

  // Frame update callback with audio modulation and seamless cross-environment transitions
  const frameCallback = (dt: number, elapsed: number) => {
    const audioBands = audioEngine.update(dt);

    if (transitionDirector.isTransitioning()) {
      transitionDirector.update(dt, elapsed, audioBands);
      transitionDirector.renderSources(renderer.renderer);
    } else {
      currentScene.update(dt, elapsed, audioBands);
    }

    renderer.applyAudioLoudness(audioBands.loudness, audioBands.beat);
  };
  renderer.addUpdateCallback(frameCallback);

  const resizeCallback = () => {
    currentScene.resize(window.innerWidth, window.innerHeight);
    transitionDirector.resize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', resizeCallback);

  // ── Scene Transition Handler (Seamless Metamorphosis) ─────────
  function switchScene(nextName: SceneName): void {
    if (nextName === currentSceneName) return;

    const nextScene = createScene(nextName);
    nextScene.initialize();
    nextScene.resize(window.innerWidth, window.innerHeight);

    // Apply active palette and visual parameters
    const state = store.getState();
    const pal = PALETTES[state.palette];
    if (pal) nextScene.applyPalette(pal, 1);
    nextScene.applyVisualParams(state.visual);

    // Prewarm next scene shaders on GPU
    renderer.renderer.compile(nextScene.scene, nextScene.camera);

    const oldScene = currentScene;
    currentSceneName = nextName;

    // Pick appropriate transition technique depending on destination
    let technique: TransitionTechnique = 'portal_warp';
    if (nextName === 'garden' || currentSceneName === 'garden') {
      technique = 'atmospheric_dissolve';
    } else if (nextName === 'aurora') {
      technique = 'metamorphosis';
    }

    // Attach transition quad to composer for full bloom & post-processing
    renderer.attachScene(
      transitionDirector.getQuadScene(),
      transitionDirector.getQuadCamera()
    );

    transitionDirector.startTransition(
      oldScene,
      nextScene,
      3.2,
      technique,
      (finalScene) => {
        currentScene = finalScene;
        renderer.attachScene(finalScene.scene, finalScene.camera);
      }
    );
  }

  // ── State Subscription ────────────────────────────────────────
  store.subscribe((state) => {
    // 1. Scene switch if requested
    if (state.scene !== currentSceneName) {
      switchScene(state.scene);
    }

    // 2. Palette application with smooth transition
    const pal = PALETTES[state.palette];
    if (pal) {
      const t = state.transition?.progress ?? 1;
      const prevPal = state.transition ? PALETTES[state.transition.fromPalette] : undefined;
      currentScene.applyPalette(pal, t, prevPal);
    }

    // 3. Visual parameter adjustments
    renderer.applyVisualParams(state.visual);
    currentScene.applyVisualParams(state.visual);

    // 4. Audio parameter synchronization
    audioEngine.applyState(state.audio);
  });

  // ── WebGL Context Loss Recovery (Milestone B8) ─────────────────
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    console.warn('[Display] WebGL context lost! Pausing render loop...');
    renderer.stop();
    diagConn.textContent = 'WebGL: Context Lost (recovering...)';
  }, false);

  canvas.addEventListener('webglcontextrestored', () => {
    console.info('[Display] WebGL context restored! Re-initializing pipeline...');
    renderer.dispose();
    renderer = new RenderingManager(canvas, store.getState().visual);
    currentScene.dispose();
    currentScene = createScene(currentSceneName);
    currentScene.initialize();
    renderer.attachScene(currentScene.scene, currentScene.camera);
    renderer.addUpdateCallback(frameCallback);
    renderer.start();
    diagConn.textContent = 'WebGL: Restored';
  }, false);

  // ── Diagnostics Update Loop ───────────────────────────────────
  let diagTick = 0;
  renderer.addUpdateCallback((dt) => {
    diagTick += dt;
    if (diagTick < 0.5) return;
    diagTick = 0;
    const d = renderer.getDiagnostics();
    diagFps.textContent       = `FPS: ${d.fps}`;
    diagQuality.textContent   = `Q: ${d.qualityLevel}`;
    diagDrawcalls.textContent = `DC: ${d.drawCalls}`;
    diagTris.textContent      = `▲: ${(d.triangles / 1000).toFixed(1)}k`;

    // Rebroadcast to operator control panel
    const audioState = store.getState().audio;
    wsClient.send({
      kind: 'diagnostics',
      payload: {
        ...d,
        audioState: audioState.playing
          ? `${audioState.mode === 'procedural' ? 'Synth' : 'Playlist'} (${Math.round(audioState.volume * 100)}%)`
          : 'Paused',
      },
    });
  });

  renderer.start();

  // Keyboard shortcut: toggle diagnostics with backtick
  document.addEventListener('keydown', (e) => {
    if (e.key === '`') diagPanel.classList.toggle('hidden');
  });
}, { once: true });
