/**
 * ui/control.ts — Operator control panel logic
 * Connects to the local WebSocket server, sends validated commands,
 * reflects server state to all UI controls, and manages presets.
 */
import { WsClient } from '../shared/WsClient';
import { StateStore } from '../state/StateStore';
import { PALETTES } from '../state/palettes';
import type { SceneName, PaletteId, SessionState } from '../state/types';

// ── State + WebSocket ──────────────────────────────────────────
const store = new StateStore();
const wsUrl = `ws://${window.location.hostname}:3001/ws`;
const ws = new WsClient(wsUrl);

ws.onMessage((msg) => {
  if (msg.kind === 'state_snapshot') {
    store.applySnapshot(msg.payload as never);
    syncUIWithState(store.getState());
  }
  if (msg.kind === 'state_patch') {
    store.applyPatch(msg.payload as never);
    syncUIWithState(store.getState());
  }
  if (msg.kind === 'diagnostics') {
    _updateDiagnostics(msg.payload as Record<string, unknown>);
  }
});

ws.onStatus((status) => {
  const badge = document.getElementById('ws-status')!;
  badge.textContent = status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting…' : 'Disconnected';
  badge.className = `status-badge status-${status === 'connected' ? 'connected' : status === 'error' ? 'error' : 'connecting'}`;
});

ws.connect();

// ── Helper: send command to server ────────────────────────────
function sendCommand(command: string, params?: Record<string, unknown>): void {
  ws.send({
    kind: 'command',
    payload: { command, params },
  });
}

// ── Scene selector ────────────────────────────────────────────
document.querySelectorAll<HTMLButtonElement>('.scene-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const scene = btn.dataset['scene'] as SceneName;
    sendCommand('scene_change', { scene });
    document.querySelectorAll('.scene-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ── Palette selector ──────────────────────────────────────────
document.querySelectorAll<HTMLButtonElement>('.palette-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const palette = btn.dataset['palette'] as PaletteId;
    const duration = parseFloat((document.getElementById('transition-duration') as HTMLInputElement).value);
    sendCommand('palette_change', { palette, durationMs: duration * 1000 });
    document.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ── Generic slider binder ─────────────────────────────────────
function bindSlider(
  id: string,
  valId: string,
  format: (v: number) => string,
  command: string,
  paramKey: string,
): void {
  const el  = document.getElementById(id) as HTMLInputElement;
  const val = document.getElementById(valId)!;
  if (!el || !val) return;

  el.addEventListener('input', () => {
    const v = parseFloat(el.value);
    val.textContent = format(v);
    sendCommand(command, { [paramKey]: v });
  });
}

const f2 = (v: number) => v.toFixed(2);
const pct = (v: number) => `${Math.round(v * 100)}%`;

bindSlider('travel-speed',      'travel-speed-val',      f2,  'set_visual', 'travelSpeed');
bindSlider('rotation-speed',    'rotation-speed-val',    f2,  'set_visual', 'rotationSpeed');
bindSlider('displacement-amp',  'displacement-amp-val',  f2,  'set_visual', 'displacementAmp');
bindSlider('twist-amount',      'twist-amount-val',      f2,  'set_visual', 'twistAmount');
bindSlider('bloom-strength',    'bloom-strength-val',    f2,  'set_visual', 'bloomStrength');
bindSlider('bloom-radius',      'bloom-radius-val',      f2,  'set_visual', 'bloomRadius');
bindSlider('bloom-threshold',   'bloom-threshold-val',   f2,  'set_visual', 'bloomThreshold');
bindSlider('exposure',          'exposure-val',          f2,  'set_visual', 'exposure');
bindSlider('render-scale',      'render-scale-val',      pct, 'set_visual', 'renderScale');
bindSlider('vignette-strength', 'vignette-strength-val', f2,  'set_visual', 'vignetteStrength');
bindSlider('grain-intensity',   'grain-intensity-val',   (v) => v.toFixed(3), 'set_visual', 'grainIntensity');

// Tone Mapping selector
document.getElementById('tone-mapping')?.addEventListener('change', (e) => {
  const v = (e.target as HTMLSelectElement).value;
  sendCommand('set_visual', { toneMapping: v });
});

// Quality Preset selector
document.getElementById('quality-preset')?.addEventListener('change', (e) => {
  const v = (e.target as HTMLSelectElement).value;
  sendCommand('set_visual', { qualityPreset: v });
});

// Particle density
const pdEl = document.getElementById('particle-density') as HTMLInputElement;
const pdLabels = ['Low (2k)', 'Medium (8k)', 'High (20k)'];
const pdVal = document.getElementById('particle-density-val')!;
pdEl?.addEventListener('input', () => {
  const v = parseInt(pdEl.value) as 0 | 1 | 2;
  pdVal.textContent = pdLabels[v] ?? '';
  sendCommand('set_visual', { particleDensity: v });
});

// Transition duration display
const tdEl = document.getElementById('transition-duration') as HTMLInputElement;
const tdVal = document.getElementById('transition-duration-val')!;
tdEl?.addEventListener('input', () => {
  tdVal.textContent = `${parseFloat(tdEl.value).toFixed(1)}s`;
});

// FPS target
document.getElementById('fps-target')?.addEventListener('change', (e) => {
  const v = parseInt((e.target as HTMLSelectElement).value) as 30 | 60;
  sendCommand('set_visual', { fpsTarget: v });
});

// ── Audio Broadcast Controls ──────────────────────────────────
const audioToggleBtn = document.getElementById('audio-toggle-btn') as HTMLButtonElement;
const audioMuteBtn   = document.getElementById('audio-mute-btn')   as HTMLButtonElement;
const audioVolSlider = document.getElementById('audio-volume')     as HTMLInputElement;
const audioVolVal    = document.getElementById('audio-volume-val')!;
const audioModeSel   = document.getElementById('audio-mode')       as HTMLSelectElement;
const playlistNavRow = document.getElementById('playlist-nav-row') as HTMLDivElement;
const audioPrevBtn   = document.getElementById('audio-prev-btn')   as HTMLButtonElement;
const audioNextBtn   = document.getElementById('audio-next-btn')   as HTMLButtonElement;

// Reactivity Engine Elements
const audioReactivitySlider = document.getElementById('audio-reactivity') as HTMLInputElement | null;
const audioReactivityVal    = document.getElementById('audio-reactivity-val');
const audioBassScaleSlider  = document.getElementById('audio-bass-scale') as HTMLInputElement | null;
const audioBassScaleVal     = document.getElementById('audio-bass-scale-val');
const audioBeatPulseCheck   = document.getElementById('audio-beat-pulse') as HTMLInputElement | null;
const audioBeatPulseVal     = document.getElementById('audio-beat-pulse-val');

audioToggleBtn?.addEventListener('click', () => {
  const current = store.getState().audio.playing;
  sendCommand(current ? 'audio_pause' : 'audio_play');
});

audioMuteBtn?.addEventListener('click', () => {
  const current = store.getState().audio.muted;
  sendCommand('audio_set_mute', { muted: !current });
});

audioVolSlider?.addEventListener('input', () => {
  const v = parseFloat(audioVolSlider.value);
  audioVolVal.textContent = `${Math.round(v * 100)}%`;
  sendCommand('audio_set_volume', { volume: v });
});

audioModeSel?.addEventListener('change', () => {
  const mode = audioModeSel.value;
  sendCommand('audio_set_mode', { mode });
});

audioPrevBtn?.addEventListener('click', () => sendCommand('audio_prev'));
audioNextBtn?.addEventListener('click', () => sendCommand('audio_next'));

audioReactivitySlider?.addEventListener('input', () => {
  const v = parseFloat(audioReactivitySlider.value);
  if (audioReactivityVal) audioReactivityVal.textContent = `${Math.round(v * 100)}%`;
  sendCommand('audio_set_reactivity', { reactivityIntensity: v });
});

audioBassScaleSlider?.addEventListener('input', () => {
  const v = parseFloat(audioBassScaleSlider.value);
  if (audioBassScaleVal) audioBassScaleVal.textContent = `${Math.round(v * 100)}%`;
  sendCommand('audio_set_reactivity', { bassScale: v });
});

audioBeatPulseCheck?.addEventListener('change', () => {
  const checked = audioBeatPulseCheck.checked;
  if (audioBeatPulseVal) audioBeatPulseVal.textContent = checked ? 'On' : 'Off';
  sendCommand('audio_set_reactivity', { beatPulseEnabled: checked });
});

// ── Simulator buttons ─────────────────────────────────────────
const simActions: Record<string, () => void> = {
  chat:        () => sendCommand('sim_event', { type: 'chat' }),
  likes:       () => sendCommand('sim_event', { type: 'like', count: 10 }),
  follow:      () => sendCommand('sim_event', { type: 'follow' }),
  gift:        () => sendCommand('sim_event', { type: 'gift' }),
  'vote-blue': () => sendCommand('sim_event', { type: 'vote', choice: 'blue' }),
  'vote-pink': () => sendCommand('sim_event', { type: 'vote', choice: 'pink' }),
  'vote-teal': () => sendCommand('sim_event', { type: 'vote', choice: 'teal' }),
  burst:       () => sendCommand('sim_burst', { count: 100 }),
};

document.querySelectorAll<HTMLButtonElement>('.sim-btn').forEach(btn => {
  const action = btn.dataset['action']!;
  btn.addEventListener('click', () => simActions[action]?.());
});

// ── Emergency toggle ──────────────────────────────────────────
const emergencyBtn = document.getElementById('emergency-toggle') as HTMLButtonElement;
emergencyBtn?.addEventListener('click', () => {
  const active = emergencyBtn.dataset['active'] === 'true';
  const next = !active;
  emergencyBtn.dataset['active'] = String(next);
  emergencyBtn.innerHTML = `Interactions: <strong>${next ? 'DISABLED' : 'ENABLED'}</strong>`;
  sendCommand(next ? 'disable_interactions' : 'enable_interactions');
});

// ── Preset controls ───────────────────────────────────────────
const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;

presetSelect?.addEventListener('change', () => {
  const name = presetSelect.value;
  if (name) sendCommand('load_preset', { name });
});

document.getElementById('preset-save')?.addEventListener('click', () => {
  const name = prompt('Preset name:')?.trim();
  if (name) sendCommand('save_preset', { name });
});

document.getElementById('preset-export')?.addEventListener('click', () => {
  const state = store.getState();
  const blob = new Blob([JSON.stringify(state.presets, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'presets.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById('preset-import-file')?.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  file.text().then(text => {
    try {
      const data = JSON.parse(text);
      sendCommand('import_presets', { presets: data });
    } catch {
      alert('Invalid preset JSON file');
    }
  }).catch(() => alert('Failed to read file'));
});

document.getElementById('preset-reset')?.addEventListener('click', () => {
  if (confirm('Reset all settings to defaults?')) sendCommand('reset_defaults');
});

// ── Sync UI controls from server session state ────────────────
function syncUIWithState(state: SessionState): void {
  // 1. Scene buttons
  document.querySelectorAll<HTMLButtonElement>('.scene-btn').forEach(b => {
    b.classList.toggle('active', b.dataset['scene'] === state.scene);
  });

  // 2. Palette buttons
  document.querySelectorAll<HTMLButtonElement>('.palette-btn').forEach(b => {
    b.classList.toggle('active', b.dataset['palette'] === state.palette);
  });

  // 3. Preset selector dropdown
  if (presetSelect && state.presets) {
    const currentVal = presetSelect.value;
    presetSelect.innerHTML = '<option value="">— Load Preset —</option>';
    for (const name of Object.keys(state.presets)) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = state.presets[name]?.name ?? name;
      presetSelect.appendChild(opt);
    }
    presetSelect.value = currentVal;
  }

  // 3b. Sync visual inputs
  const toneMappingEl = document.getElementById('tone-mapping') as HTMLSelectElement;
  if (toneMappingEl && state.visual.toneMapping && document.activeElement !== toneMappingEl) {
    toneMappingEl.value = state.visual.toneMapping;
  }
  const qualityPresetEl = document.getElementById('quality-preset') as HTMLSelectElement;
  if (qualityPresetEl && state.visual.qualityPreset && document.activeElement !== qualityPresetEl) {
    qualityPresetEl.value = state.visual.qualityPreset;
  }
  const vigEl = document.getElementById('vignette-strength') as HTMLInputElement;
  const vigVal = document.getElementById('vignette-strength-val');
  if (vigEl && state.visual.vignetteStrength !== undefined && document.activeElement !== vigEl) {
    vigEl.value = String(state.visual.vignetteStrength);
    if (vigVal) vigVal.textContent = state.visual.vignetteStrength.toFixed(2);
  }
  const grainEl = document.getElementById('grain-intensity') as HTMLInputElement;
  const grainVal = document.getElementById('grain-intensity-val');
  if (grainEl && state.visual.grainIntensity !== undefined && document.activeElement !== grainEl) {
    grainEl.value = String(state.visual.grainIntensity);
    if (grainVal) grainVal.textContent = state.visual.grainIntensity.toFixed(3);
  }

  // 4. Emergency button
  if (emergencyBtn) {
    emergencyBtn.dataset['active'] = String(!state.interactionsEnabled);
    emergencyBtn.innerHTML = `Interactions: <strong>${state.interactionsEnabled ? 'ENABLED' : 'DISABLED'}</strong>`;
  }

  // 5. Audio controls synchronization
  if (audioToggleBtn) {
    audioToggleBtn.textContent = state.audio.playing ? '⏸ Pause' : '▶ Play';
  }
  if (audioMuteBtn) {
    audioMuteBtn.textContent = state.audio.muted ? 'Unmute' : 'Mute';
    audioMuteBtn.style.background = state.audio.muted ? '#d32f2f' : '';
  }
  if (audioVolSlider && document.activeElement !== audioVolSlider) {
    audioVolSlider.value = String(state.audio.volume);
    if (audioVolVal) audioVolVal.textContent = `${Math.round(state.audio.volume * 100)}%`;
  }
  if (audioModeSel) {
    audioModeSel.value = state.audio.mode;
  }
  if (playlistNavRow) {
    playlistNavRow.style.display = state.audio.mode === 'playlist' ? 'flex' : 'none';
  }
  if (audioReactivitySlider && document.activeElement !== audioReactivitySlider) {
    const r = state.audio.reactivityIntensity ?? 1.0;
    audioReactivitySlider.value = String(r);
    if (audioReactivityVal) audioReactivityVal.textContent = `${Math.round(r * 100)}%`;
  }
  if (audioBassScaleSlider && document.activeElement !== audioBassScaleSlider) {
    const b = state.audio.bassScale ?? 1.0;
    audioBassScaleSlider.value = String(b);
    if (audioBassScaleVal) audioBassScaleVal.textContent = `${Math.round(b * 100)}%`;
  }
  if (audioBeatPulseCheck && document.activeElement !== audioBeatPulseCheck) {
    const p = state.audio.beatPulseEnabled ?? true;
    audioBeatPulseCheck.checked = p;
    if (audioBeatPulseVal) audioBeatPulseVal.textContent = p ? 'On' : 'Off';
  }
  const ctrlAudio = document.getElementById('ctrl-audio');
  if (ctrlAudio) {
    ctrlAudio.textContent = state.audio.playing
      ? `${state.audio.mode === 'procedural' ? 'Synth' : 'Playlist'} (${Math.round(state.audio.volume * 100)}%)`
      : 'Paused';
  }
}

// ── Diagnostics ────────────────────────────────────────────────
function _updateDiagnostics(d: Record<string, unknown>): void {
  const set = (id: string, val: unknown) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(val ?? '—');
  };
  set('ctrl-fps',     d['fps']);
  set('ctrl-ft',      d['frameTimeMs'] ? `${d['frameTimeMs']}ms` : '—');
  set('ctrl-quality', d['qualityLevel']);
  set('ctrl-dc',      d['drawCalls']);
  set('ctrl-tris',    d['triangles'] ? `${(Number(d['triangles']) / 1000).toFixed(1)}k` : '—');
  set('ctrl-geo',     d['geometries']);
  set('ctrl-tex',     d['textures']);
  set('ctrl-audio',   d['audioState'] ?? '—');
  set('ctrl-queue',   d['queueSize'] ?? '0');
}
