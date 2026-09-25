/**
 * LANCam — Camera Page
 *
 * Mobile-first camera capture and streaming interface.
 * This page runs on the smartphone after scanning the QR code.
 */

import { VIDEO_PRESETS } from '@lancam/shared';
import type { VideoPreset, ConnectionState, WebRTCStats } from '@lancam/shared';
import { SignalingClient } from '../../lib/signaling-client.js';
import { WebRTCConnection } from '../../lib/webrtc.js';
import {
  enumerateVideoDevices,
  detectSupportedPresets,
  getCameraStream,
  requestWakeLock,
  CameraError,
  setTorch,
  type DeviceInfo,
} from '../../lib/media.js';
import { formatBitrate, formatResolution } from '../../lib/stats.js';
import { icons } from '../../lib/icons.js';

interface CameraState {
  joinCode: string;
  sessionId: string;
  sessionName: string;
  cameraId: string;
  sessionToken: string;
  wsUrl: string;
  devices: DeviceInfo[];
  supportedPresets: VideoPreset[];
  selectedDeviceId: string;
  selectedPresetId: string;
  enableAudio: boolean;
  mirrorPreview: boolean;
  torchActive: boolean;
  stream: MediaStream | null;
  signaling: SignalingClient | null;
  connections: Map<string, WebRTCConnection>;
  connectionState: ConnectionState;
  stats: WebRTCStats | null;
  wakeLock: WakeLockSentinel | null;
  isStreaming: boolean;
}

const state: CameraState = {
  joinCode: '',
  sessionId: '',
  sessionName: '',
  cameraId: '',
  sessionToken: '',
  wsUrl: '',
  devices: [],
  supportedPresets: [],
  selectedDeviceId: '',
  selectedPresetId: 'BALANCED',
  enableAudio: false,
  mirrorPreview: false,
  torchActive: false,
  stream: null,
  signaling: null,
  connections: new Map(),
  connectionState: 'disconnected',
  stats: null,
  wakeLock: null,
  isStreaming: false,
};

export async function initCameraPage(container: HTMLElement, joinCode: string): Promise<void> {
  state.joinCode = joinCode;

  container.innerHTML = `
    <div class="page" style="padding:var(--space-4);max-width:480px;margin:0 auto">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <div class="brand">
          <div class="brand-icon" style="width:28px;height:28px;font-size:var(--text-sm)">LC</div>
          <div class="brand-name" style="font-size:var(--text-lg)">LAN<span>Cam</span></div>
        </div>
        <div id="connection-badge" class="badge badge--offline">Joining...</div>
      </div>

      <!-- Session Info -->
      <div id="session-info" class="alert alert--info mb-4" style="font-size:var(--text-sm)">
        Joining session...
      </div>

      <!-- Video Preview -->
      <div class="video-container mb-4" id="preview-container">
        <video id="preview-video" autoplay playsinline muted></video>
        <div id="preview-overlay" class="video-overlay">
          <div class="flex flex-col items-center gap-3">
            <div class="spinner"></div>
            <span>Initializing camera...</span>
          </div>
        </div>
      </div>

      <!-- Camera Controls -->
      <div id="controls-panel">
        <!-- Quick Action Buttons -->
        <div class="flex items-center gap-2 mb-4" style="justify-content:center">
          <button id="btn-flip-camera" class="btn btn-sm btn-outline flex items-center gap-1" disabled>
            ${icons.refresh(16)} <span>Flip Camera</span>
          </button>
          <button id="btn-torch" class="btn btn-sm btn-outline flex items-center gap-1 hidden">
            ${icons.flash(16)} <span>Torch</span>
          </button>
        </div>

        <!-- Camera Selection -->
        <div class="form-group">
          <label class="form-label">Camera Source</label>
          <select id="camera-select" class="form-select" disabled>
            <option>Loading cameras...</option>
          </select>
        </div>

        <!-- Resolution -->
        <div class="form-group">
          <label class="form-label">Resolution & Framerate</label>
          <select id="resolution-select" class="form-select" disabled>
            <option>Detecting...</option>
          </select>
        </div>

        <!-- Host Camera Options Box -->
        <div class="card p-3 mb-4" style="background:var(--color-bg-subtle);border-radius:var(--radius-md);font-size:var(--text-sm)">
          <div style="font-weight:600;margin-bottom:var(--space-2);color:var(--color-text-muted)">Camera Settings:</div>
          <div style="display:flex;flex-direction:column;gap:var(--space-2)">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="chk-audio" /> Include Microphone Audio
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="chk-mirror" /> Mirror Preview Horizontally
            </label>
          </div>
        </div>

        <!-- Start/Stop Button -->
        <button id="stream-btn" class="btn btn-success btn-lg btn-block mt-4" disabled>
          Loading...
        </button>
      </div>

      <!-- Streaming Stats -->
      <div id="stats-panel" class="hidden mt-4">
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-label">Status</div>
            <div class="stat-value" id="stat-status">—</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Resolution</div>
            <div class="stat-value" id="stat-resolution">—</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">FPS</div>
            <div class="stat-value" id="stat-fps">—</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Bitrate</div>
            <div class="stat-value" id="stat-bitrate">—</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">RTT</div>
            <div class="stat-value" id="stat-rtt">—</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Codec</div>
            <div class="stat-value" id="stat-codec">—</div>
          </div>
        </div>
      </div>

      <!-- Error Display -->
      <div id="error-panel" class="hidden mt-4">
        <div class="alert alert--error" id="error-message"></div>
      </div>

      <!-- Background Warning -->
      <div class="alert alert--warning mt-4 flex items-center gap-2" style="font-size:var(--text-xs)">
        ${icons.warning(16)}
        <span>Keep this app in the foreground. Switching apps or locking the screen will pause the camera.</span>
      </div>
    </div>
  `;

  // Join the session first
  await joinSession();
}

async function joinSession(): Promise<void> {
  try {
    const response = await fetch(`/api/join/${state.joinCode}`);
    if (!response.ok) {
      throw new Error('Invalid or expired session code');
    }

    const data = await response.json();
    state.sessionId = data.sessionId;
    state.sessionName = data.sessionName;
    state.cameraId = data.cameraId;
    state.sessionToken = data.sessionToken;

    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const relativeWsUrl = `${wsProto}//${window.location.host}/ws`;
    state.wsUrl = data.wsUrl && !data.wsUrl.includes(':3478') ? data.wsUrl : relativeWsUrl;

    updateSessionInfo(`Session: ${data.sessionName}`);

    // Initialize camera
    await initCamera();
  } catch (err) {
    showError(err instanceof Error ? err.message : 'Failed to join session');
  }
}

async function initCamera(): Promise<void> {
  try {
    state.devices = await enumerateVideoDevices();
    state.selectedDeviceId = state.devices[0].deviceId;

    const cameraSelect = document.getElementById('camera-select') as HTMLSelectElement;
    cameraSelect.innerHTML = state.devices.map((d) =>
      `<option value="${d.deviceId}">${escapeHtml(d.label)}</option>`
    ).join('');
    cameraSelect.disabled = false;
    cameraSelect.addEventListener('change', () => {
      state.selectedDeviceId = cameraSelect.value;
      updatePreview();
      detectPresets();
    });

    // Flip Camera button listener
    const flipBtn = document.getElementById('btn-flip-camera') as HTMLButtonElement;
    if (state.devices.length > 1) {
      flipBtn.disabled = false;
      flipBtn.addEventListener('click', () => {
        const currentIndex = state.devices.findIndex(d => d.deviceId === state.selectedDeviceId);
        const nextIndex = (currentIndex + 1) % state.devices.length;
        state.selectedDeviceId = state.devices[nextIndex].deviceId;
        cameraSelect.value = state.selectedDeviceId;
        updatePreview();
        detectPresets();
      });
    }

    // Settings checkboxes
    const chkAudio = document.getElementById('chk-audio') as HTMLInputElement;
    chkAudio?.addEventListener('change', () => {
      state.enableAudio = chkAudio.checked;
    });

    const chkMirror = document.getElementById('chk-mirror') as HTMLInputElement;
    chkMirror?.addEventListener('change', () => {
      state.mirrorPreview = chkMirror.checked;
      const video = document.getElementById('preview-video') as HTMLVideoElement;
      if (video) {
        video.style.transform = state.mirrorPreview ? 'scaleX(-1)' : 'none';
      }
    });

    await detectPresets();
    await updatePreview();

    const streamBtn = document.getElementById('stream-btn') as HTMLButtonElement;
    streamBtn.disabled = false;
    streamBtn.innerHTML = `<div class="flex items-center justify-center gap-2">${icons.play(18)}<span>START CAMERA</span></div>`;
    streamBtn.className = 'btn btn-success btn-lg btn-block mt-4';
    streamBtn.addEventListener('click', toggleStreaming);

    updateBadge('ready');
  } catch (err) {
    if (err instanceof CameraError) {
      showError(err.getUserMessage());
    } else {
      showError('Failed to initialize camera');
    }
  }
}

async function detectPresets(): Promise<void> {
  const resolutionSelect = document.getElementById('resolution-select') as HTMLSelectElement;
  resolutionSelect.innerHTML = '<option>Detecting supported resolutions...</option>';
  resolutionSelect.disabled = true;

  state.supportedPresets = await detectSupportedPresets(state.selectedDeviceId);

  resolutionSelect.innerHTML = state.supportedPresets.map((p) =>
    `<option value="${p.id}" ${p.id === state.selectedPresetId ? 'selected' : ''}>
      ${p.width}×${p.height} @ ${p.frameRate} FPS
    </option>`
  ).join('');
  resolutionSelect.disabled = false;
  resolutionSelect.addEventListener('change', () => {
    state.selectedPresetId = resolutionSelect.value;
  });

  // Default to highest supported
  if (!state.supportedPresets.find(p => p.id === state.selectedPresetId)) {
    state.selectedPresetId = state.supportedPresets[state.supportedPresets.length - 1].id;
    resolutionSelect.value = state.selectedPresetId;
  }
}

async function updatePreview(): Promise<void> {
  const video = document.getElementById('preview-video') as HTMLVideoElement;
  const overlay = document.getElementById('preview-overlay') as HTMLDivElement;

  // Stop existing preview stream
  if (state.stream && !state.isStreaming) {
    state.stream.getTracks().forEach(t => t.stop());
  }

  try {
    const previewStream = await getCameraStream(
      state.selectedDeviceId,
      VIDEO_PRESETS.BALANCED, // Preview at 720p
    );

    if (!state.isStreaming) {
      state.stream = previewStream;
    }

    video.srcObject = previewStream;
    overlay.classList.add('hidden');
  } catch (err) {
    overlay.innerHTML = `
      <div class="flex flex-col items-center gap-3">
        <div style="color:var(--color-text-muted)">${icons.camera(32)}</div>
        <span>${err instanceof CameraError ? err.getUserMessage() : 'Camera unavailable'}</span>
      </div>
    `;
  }
}

async function toggleStreaming(): Promise<void> {
  if (state.isStreaming) {
    stopStreaming();
  } else {
    await startStreaming();
  }
}

async function startStreaming(): Promise<void> {
  const streamBtn = document.getElementById('stream-btn') as HTMLButtonElement;
  streamBtn.disabled = true;
  streamBtn.textContent = 'Starting...';

  try {
    // Get the stream with selected preset
    const preset = state.supportedPresets.find(p => p.id === state.selectedPresetId)
      || VIDEO_PRESETS.BALANCED;

    // Stop preview stream
    state.stream?.getTracks().forEach(t => t.stop());

    state.stream = await getCameraStream(state.selectedDeviceId, preset, state.enableAudio);

    // Update preview
    const video = document.getElementById('preview-video') as HTMLVideoElement;
    video.srcObject = state.stream;

    // Request wake lock
    state.wakeLock = await requestWakeLock();

    // Connect signaling
    state.signaling = new SignalingClient(state.wsUrl, (connected) => {
      if (!connected && state.isStreaming) {
        updateBadge('reconnecting');
      }
    });

    state.signaling.connect();

    // Register camera
    state.signaling.on('session-joined', () => {
      updateBadge('ready');
      state.signaling!.send({
        type: 'camera-status',
        status: 'live',
      });
    });

    // Handle viewer connections
    state.signaling.on('viewer-connected', (msg) => {
      const { viewerId } = msg as { viewerId: string };
      createPeerConnection(viewerId);
    });

    state.signaling.on('viewer-disconnected', (msg) => {
      const { viewerId } = msg as { viewerId: string };
      const conn = state.connections.get(viewerId);
      if (conn) {
        conn.close();
        state.connections.delete(viewerId);
        updateAggregateConnectionStatus();
      }
    });

    // Register with server
    state.signaling.send({
      type: 'camera-register',
      sessionToken: state.sessionToken,
      cameraId: state.cameraId,
      cameraName: state.devices.find(d => d.deviceId === state.selectedDeviceId)?.label || state.cameraId,
      capabilities: {
        facingModes: state.devices.map(d => d.facingMode),
        resolutions: state.supportedPresets.map(p => ({ width: p.width, height: p.height, label: p.label })),
        maxFrameRate: Math.max(...state.supportedPresets.map(p => p.frameRate)),
        hasZoom: false,
        hasTorch: false,
      },
    });

    state.isStreaming = true;

    // Update UI
    streamBtn.disabled = false;
    streamBtn.innerHTML = `<div class="flex items-center justify-center gap-2">${icons.stop(18)}<span>STOP CAMERA</span></div>`;
    streamBtn.className = 'btn btn-danger btn-lg btn-block mt-4';

    // Disable controls while streaming
    (document.getElementById('camera-select') as HTMLSelectElement).disabled = true;
    (document.getElementById('resolution-select') as HTMLSelectElement).disabled = true;

    // Show stats
    document.getElementById('stats-panel')!.classList.remove('hidden');
    updateAggregateConnectionStatus();

  } catch (err) {
    streamBtn.disabled = false;
    streamBtn.innerHTML = `<div class="flex items-center justify-center gap-2">${icons.play(18)}<span>START CAMERA</span></div>`;
    streamBtn.className = 'btn btn-success btn-lg btn-block mt-4';

    if (err instanceof CameraError) {
      showError(err.getUserMessage());
    } else {
      showError('Failed to start streaming');
    }
  }
}

function updateAggregateConnectionStatus(): void {
  if (!state.isStreaming) {
    updateBadge('ready');
    return;
  }

  if (state.connections.size === 0) {
    updateBadge('ready');
    return;
  }

  let hasLive = false;
  let hasConnecting = false;
  let hasDegraded = false;

  for (const conn of state.connections.values()) {
    if (conn.state === 'live') {
      hasLive = true;
    } else if (conn.state === 'connecting') {
      hasConnecting = true;
    } else if (conn.state === 'degraded' || conn.state === 'reconnecting') {
      hasDegraded = true;
    }
  }

  if (hasLive) {
    updateBadge('live');
  } else if (hasConnecting) {
    updateBadge('connecting');
  } else if (hasDegraded) {
    updateBadge('warning');
  } else {
    updateBadge('ready');
  }
}

function createPeerConnection(viewerId: string): void {
  if (!state.signaling || !state.stream) return;

  const preset = state.supportedPresets.find(p => p.id === state.selectedPresetId)
    || VIDEO_PRESETS.BALANCED;

  const conn = new WebRTCConnection({
    role: 'sender',
    signaling: state.signaling,
    peerId: state.cameraId,
    remotePeerId: viewerId,
    maxBitrate: preset.targetBitrate,
    onStateChange: () => {
      updateAggregateConnectionStatus();
    },
    onStats: (stats) => {
      state.stats = stats;
      updateStats(stats);

      // Adaptive bitrate tuning under network latency/jitter spike
      if (stats.rtt && stats.rtt > 150) {
        conn.setMaxBitrate(Math.max(1_000_000, Math.round(preset.targetBitrate * 0.6)));
      } else if (stats.rtt && stats.rtt < 50) {
        conn.setMaxBitrate(preset.targetBitrate);
      }
    },
  });

  conn.addStream(state.stream);
  conn.createOffer();

  state.connections.set(viewerId, conn);
  updateAggregateConnectionStatus();
}

function stopStreaming(): void {
  // Close all peer connections
  for (const [, conn] of state.connections) {
    conn.close();
  }
  state.connections.clear();

  // Disconnect signaling
  state.signaling?.send({ type: 'camera-status', status: 'stopped' });
  state.signaling?.disconnect();
  state.signaling = null;

  // Stop stream
  state.stream?.getTracks().forEach(t => t.stop());
  state.stream = null;

  // Release wake lock
  state.wakeLock?.release().catch(() => {});
  state.wakeLock = null;

  state.isStreaming = false;

  // Update UI
  const streamBtn = document.getElementById('stream-btn') as HTMLButtonElement;
  streamBtn.innerHTML = `<div class="flex items-center justify-center gap-2">${icons.play(18)}<span>START CAMERA</span></div>`;
  streamBtn.className = 'btn btn-success btn-lg btn-block mt-4';

  (document.getElementById('camera-select') as HTMLSelectElement).disabled = false;
  (document.getElementById('resolution-select') as HTMLSelectElement).disabled = false;
  document.getElementById('stats-panel')!.classList.add('hidden');

  updateBadge('ready');
  updatePreview();
}

function updateBadge(status: string): void {
  const badge = document.getElementById('connection-badge')!;
  const labels: Record<string, string> = {
    ready: 'Ready',
    live: '● LIVE',
    connecting: 'Connecting...',
    reconnecting: 'Reconnecting...',
    degraded: '⚠ Degraded',
    disconnected: 'Disconnected',
    failed: 'Failed',
    warning: '⚠ Unstable',
  };
  const classes: Record<string, string> = {
    ready: 'badge--ready',
    live: 'badge--live',
    connecting: 'badge--warning',
    reconnecting: 'badge--warning',
    degraded: 'badge--warning',
    disconnected: 'badge--offline',
    failed: 'badge--offline',
    warning: 'badge--warning',
  };

  badge.textContent = labels[status] || status;
  badge.className = `badge ${classes[status] || 'badge--offline'}`;
}

function updateSessionInfo(text: string): void {
  document.getElementById('session-info')!.textContent = text;
}

function updateStats(stats: WebRTCStats): void {
  const setText = (id: string, value: string, quality?: 'good' | 'warning' | 'bad') => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value;
    el.className = `stat-value${quality ? ` stat-value--${quality}` : ''}`;
  };

  setText('stat-status', stats.connectionState === 'connected' ? 'Connected' : stats.connectionState,
    stats.connectionState === 'connected' ? 'good' : 'warning');
  setText('stat-resolution', formatResolution(stats.resolution));
  setText('stat-fps', stats.fps !== null ? stats.fps.toFixed(1) : '—',
    stats.fps !== null ? (stats.fps >= 25 ? 'good' : stats.fps >= 15 ? 'warning' : 'bad') : undefined);
  setText('stat-bitrate', formatBitrate(stats.bitrate));
  setText('stat-rtt', stats.rtt !== null ? `${stats.rtt} ms` : '—',
    stats.rtt !== null ? (stats.rtt <= 50 ? 'good' : stats.rtt <= 150 ? 'warning' : 'bad') : undefined);
  setText('stat-codec', stats.codec || '—');
}

function showError(message: string): void {
  const panel = document.getElementById('error-panel')!;
  const msgEl = document.getElementById('error-message')!;
  panel.classList.remove('hidden');

  const isHttp = window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
  const httpsUrl = `https://${window.location.host}${window.location.pathname}${window.location.search}`;

  if (isHttp || message.includes('HTTPS') || message.includes('permissão') || message.includes('permission')) {
    msgEl.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px">
        <div style="font-weight:600;font-size:1.05rem;display:flex;align-items:center;gap:8px;color:#ef4444">
          ${icons.warning(20)} Câmera Bloqueada pelo Navegador
        </div>
        <div>${escapeHtml(message)}</div>
        
        <div style="background:rgba(0,0,0,0.25);padding:12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1)">
          <div style="font-weight:600;margin-bottom:8px;color:#38bdf8">💡 Solução Recomendada:</div>
          <p style="margin-bottom:10px;font-size:0.875rem">Navegadores de telemóveis (Chrome/Safari) exigem uma ligação segura HTTPS para autorizar a câmera.</p>
          
          <a href="${httpsUrl}" class="btn btn-primary btn-block" style="text-align:center;text-decoration:none;display:block;padding:10px;font-weight:600">
            🔒 Abrir em HTTPS (Ativar Câmera)
          </a>
          
          <div style="margin-top:10px;font-size:0.775rem;color:var(--color-text-muted);line-height:1.4">
            * Se surgir o aviso "Sua conexão não é privada", clique em <b>Avançado</b> → <b>Ir para 146.235.224.99 (não seguro)</b>.
          </div>
        </div>
      </div>
    `;
  } else {
    msgEl.textContent = message;
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
