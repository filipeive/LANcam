import type { ConnectionState, WebRTCStats } from '@lancam/shared';
import { RECONNECT_DELAYS_MS } from '@lancam/shared';
import { SignalingClient } from '../../lib/signaling-client.js';
import { WebRTCConnection } from '../../lib/webrtc.js';
import { icons } from '../../lib/icons.js';
import { formatBitrate, formatResolution } from '../../lib/stats.js';

export async function initViewerPage(
  container: HTMLElement,
  cameraId: string,
  token: string,
  sessionId: string,
): Promise<void> {
  const urlParams = new URLSearchParams(window.location.search);

  const initialAudio = urlParams.get('audio') === '1' || urlParams.get('audio') === 'true';
  const initialMirror = urlParams.get('mirror') === '1' || urlParams.get('mirror') === 'true';
  const initialFit = urlParams.get('fit') === 'cover' ? 'cover' : 'contain';
  const initialRotate = parseInt(urlParams.get('rotate') || '0', 10) || 0;
  const initialStats = urlParams.get('stats') === '1' || urlParams.get('stats') === 'true';
  const isCleanMode = urlParams.get('clean') === '1' || urlParams.get('clean') === 'true';

  let currentMirror = initialMirror;
  let currentFit = initialFit;
  let currentRotate = initialRotate;
  let currentStats = initialStats;
  let currentAudio = initialAudio;

  container.innerHTML = `
    <style>
      html, body, #app {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #000;
        font-family: system-ui, -apple-system, sans-serif;
      }
      #viewer-video-wrapper {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #000;
        overflow: hidden;
      }
      #viewer-video {
        width: 100%;
        height: 100%;
        object-fit: ${currentFit};
        background: transparent;
        transition: transform 0.3s ease;
      }
      #viewer-status {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: rgba(255,255,255,0.7);
        font-size: 14px;
        text-align: center;
        pointer-events: none;
        z-index: 10;
        transition: opacity 0.5s;
        background: rgba(15, 23, 42, 0.85);
        padding: 12px 24px;
        border-radius: 9999px;
        border: 1px solid rgba(255,255,255,0.1);
        backdrop-filter: blur(8px);
      }
      #viewer-status.hidden {
        opacity: 0;
        pointer-events: none;
      }

      /* Control Toolbar (Hover) */
      .viewer-toolbar {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(15, 23, 42, 0.85);
        border: 1px solid rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(12px);
        padding: 6px 12px;
        border-radius: 9999px;
        z-index: 50;
        box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);
        opacity: 0;
        transition: opacity 0.3s ease, transform 0.3s ease;
      }
      .viewer-toolbar.visible, #viewer-video-wrapper:hover .viewer-toolbar {
        opacity: 1;
      }
      .control-btn {
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.7);
        padding: 8px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      }
      .control-btn:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.15);
        transform: scale(1.08);
      }
      .control-btn.active {
        color: #3b82f6;
        background: rgba(59, 130, 246, 0.2);
      }

      /* Stats Overlay (HUD) */
      #viewer-stats-hud {
        position: fixed;
        top: 16px;
        left: 16px;
        background: rgba(15, 23, 42, 0.85);
        border: 1px solid rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(8px);
        padding: 8px 14px;
        border-radius: 8px;
        color: #e2e8f0;
        font-family: monospace;
        font-size: 11px;
        z-index: 40;
        display: flex;
        flex-direction: column;
        gap: 4px;
        pointer-events: none;
      }
      #viewer-stats-hud.hidden {
        display: none;
      }
    </style>

    <div id="viewer-video-wrapper">
      <video id="viewer-video" autoplay playsinline ${initialAudio ? '' : 'muted'}></video>
      <div id="viewer-status">Connecting to camera...</div>

      <!-- Real-time Stats HUD -->
      <div id="viewer-stats-hud" class="${initialStats ? '' : 'hidden'}">
        <div>Resolution: <span id="hud-res">—</span></div>
        <div>FPS: <span id="hud-fps">—</span></div>
        <div>Bitrate: <span id="hud-bitrate">—</span></div>
        <div>RTT / Latency: <span id="hud-rtt">—</span></div>
      </div>

      <!-- Controls Overlay Bar -->
      ${isCleanMode ? '' : `
        <div id="viewer-toolbar" class="viewer-toolbar">
          <button id="btn-audio" class="control-btn ${initialAudio ? 'active' : ''}" title="Toggle Sound">
            ${initialAudio ? icons.volume2(18) : icons.volumeX(18)}
          </button>
          <button id="btn-mirror" class="control-btn ${initialMirror ? 'active' : ''}" title="Mirror Video (Flip H)">
            ${icons.flipH(18)}
          </button>
          <button id="btn-fit" class="control-btn ${initialFit === 'cover' ? 'active' : ''}" title="Toggle Fit / Fill Mode">
            ${icons.maximize(18)}
          </button>
          <button id="btn-rotate" class="control-btn ${initialRotate !== 0 ? 'active' : ''}" title="Rotate Video (${initialRotate}°)">
            ${icons.rotateCw(18)}
          </button>
          <button id="btn-stats" class="control-btn ${initialStats ? 'active' : ''}" title="Toggle Stats HUD">
            ${icons.barChart(18)}
          </button>
          <button id="btn-fullscreen" class="control-btn" title="Fullscreen">
            ${icons.fullscreen(18)}
          </button>
        </div>
      `}
    </div>
  `;

  const video = document.getElementById('viewer-video') as HTMLVideoElement;
  const statusEl = document.getElementById('viewer-status') as HTMLDivElement;
  const toolbar = document.getElementById('viewer-toolbar');

  let signaling: SignalingClient | null = null;
  let connection: WebRTCConnection | null = null;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let isClosingIntentionally = false;
  let hideToolbarTimer: ReturnType<typeof setTimeout> | null = null;

  // Apply transformations (mirror, rotate)
  function applyTransformations(): void {
    const transforms: string[] = [];
    if (currentMirror) transforms.push('scaleX(-1)');
    if (currentRotate !== 0) transforms.push(`rotate(${currentRotate}deg)`);

    video.style.transform = transforms.join(' ');
    video.style.objectFit = currentFit;
  }
  applyTransformations();

  // Control Bar Auto-Hide Logic
  if (toolbar) {
    const showToolbar = () => {
      toolbar.classList.add('visible');
      if (hideToolbarTimer) clearTimeout(hideToolbarTimer);
      hideToolbarTimer = setTimeout(() => {
        toolbar.classList.remove('visible');
      }, 3000);
    };

    document.addEventListener('mousemove', showToolbar);
    showToolbar();
  }

  // Interactive Controls Listeners
  const btnAudio = document.getElementById('btn-audio');
  btnAudio?.addEventListener('click', () => {
    currentAudio = !currentAudio;
    video.muted = !currentAudio;
    btnAudio.classList.toggle('active', currentAudio);
    btnAudio.innerHTML = currentAudio ? icons.volume2(18) : icons.volumeX(18);
  });

  const btnMirror = document.getElementById('btn-mirror');
  btnMirror?.addEventListener('click', () => {
    currentMirror = !currentMirror;
    btnMirror.classList.toggle('active', currentMirror);
    applyTransformations();
  });

  const btnFit = document.getElementById('btn-fit');
  btnFit?.addEventListener('click', () => {
    currentFit = currentFit === 'contain' ? 'cover' : 'contain';
    btnFit.classList.toggle('active', currentFit === 'cover');
    applyTransformations();
  });

  const btnRotate = document.getElementById('btn-rotate');
  btnRotate?.addEventListener('click', () => {
    currentRotate = (currentRotate + 90) % 360;
    btnRotate.classList.toggle('active', currentRotate !== 0);
    btnRotate.title = `Rotate Video (${currentRotate}°)`;
    applyTransformations();
  });

  const btnStats = document.getElementById('btn-stats');
  const hud = document.getElementById('viewer-stats-hud');
  btnStats?.addEventListener('click', () => {
    currentStats = !currentStats;
    btnStats.classList.toggle('active', currentStats);
    hud?.classList.toggle('hidden', !currentStats);
  });

  const btnFullscreen = document.getElementById('btn-fullscreen');
  btnFullscreen?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  function updateHud(stats: WebRTCStats): void {
    const resEl = document.getElementById('hud-res');
    const fpsEl = document.getElementById('hud-fps');
    const bitrateEl = document.getElementById('hud-bitrate');
    const rttEl = document.getElementById('hud-rtt');

    if (resEl) resEl.textContent = formatResolution(stats.resolution);
    if (fpsEl) fpsEl.textContent = stats.fps !== null ? `${stats.fps.toFixed(1)} FPS` : '—';
    if (bitrateEl) bitrateEl.textContent = formatBitrate(stats.bitrate);
    if (rttEl) rttEl.textContent = stats.rtt !== null ? `${stats.rtt} ms` : '—';
  }

  function cancelReconnect(): void {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function connect(): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    statusEl.textContent = 'Connecting...';
    statusEl.classList.remove('hidden');

    signaling = new SignalingClient(wsUrl, (connected) => {
      if (!connected) {
        statusEl.textContent = 'Reconnecting to server...';
        statusEl.classList.remove('hidden');
      }
    });

    signaling.on('session-joined', () => {
      statusEl.textContent = 'Waiting for camera stream...';
    });

    signaling.on('offer', (msg) => {
      const offerMsg = msg as { fromCameraId: string; sdp: string };

      if (connection) {
        isClosingIntentionally = true;
        connection.close();
        connection = null;
        isClosingIntentionally = false;
      }

      connection = new WebRTCConnection({
        role: 'receiver',
        signaling: signaling!,
        peerId: `viewer-${Date.now()}`,
        remotePeerId: offerMsg.fromCameraId,
        onStateChange: handleStateChange,
        onStats: (stats) => {
          updateHud(stats);
        },
        onRemoteStream: (stream) => {
          if ('playoutDelayHint' in video) {
            (video as any).playoutDelayHint = 0;
          }
          video.srcObject = stream;
          video.play().catch((err) => console.warn('[Viewer] Play call failed:', err));
          statusEl.classList.add('hidden');
          cancelReconnect();
          reconnectAttempt = 0;
        },
      });

      connection.handleOffer(offerMsg.sdp);
    });

    signaling.on('camera-status-update', (msg) => {
      const statusMsg = msg as { cameraId: string; status: string };
      if (statusMsg.cameraId === cameraId && statusMsg.status === 'stopped') {
        statusEl.textContent = 'Camera disconnected. Waiting for reconnection...';
        statusEl.classList.remove('hidden');
      }
    });

    signaling.connect();

    signaling.send({
      type: 'viewer-register',
      sessionToken: token,
      cameraId: cameraId,
    });
  }

  function handleStateChange(state: ConnectionState): void {
    if (isClosingIntentionally) return;

    switch (state) {
      case 'live':
        statusEl.classList.add('hidden');
        cancelReconnect();
        reconnectAttempt = 0;
        break;
      case 'degraded':
        break;
      case 'disconnected':
      case 'failed':
        statusEl.textContent = 'Connection lost. Reconnecting...';
        statusEl.classList.remove('hidden');
        scheduleReconnect();
        break;
    }
  }

  function scheduleReconnect(): void {
    if (reconnectTimer) return;

    const delay = RECONNECT_DELAYS_MS[reconnectAttempt] ?? 30000;
    reconnectAttempt++;

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      cleanup();
      connect();
    }, delay);
  }

  function cleanup(): void {
    cancelReconnect();
    if (connection) {
      isClosingIntentionally = true;
      connection.close();
      connection = null;
      isClosingIntentionally = false;
    }
    signaling?.disconnect();
    signaling = null;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !connection) {
      reconnectAttempt = 0;
      connect();
    }
  });

  connect();
}
