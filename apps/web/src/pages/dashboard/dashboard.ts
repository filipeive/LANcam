/**
 * LANCam — Dashboard Page
 *
 * Session management dashboard showing QR code, camera list,
 * OBS URLs, and real-time status updates.
 */

import type { CameraInfo } from '@lancam/shared';
import { SignalingClient } from '../../lib/signaling-client.js';
import { icons } from '../../lib/icons.js';
import { navigate } from '../../main.js';

interface DashboardState {
  sessionId: string;
  sessionName: string;
  dashboardToken: string;
  joinCode: string;
  joinUrl: string;
  qrCodeDataUrl: string;
  cameras: CameraInfo[];
  obsUrls: Record<string, string>;
  obsHttpsUrls: Record<string, string>;
  signaling: SignalingClient | null;
}

const state: DashboardState = {
  sessionId: '',
  sessionName: '',
  dashboardToken: '',
  joinCode: '',
  joinUrl: '',
  qrCodeDataUrl: '',
  cameras: [],
  obsUrls: {},
  obsHttpsUrls: {},
  signaling: null,
};

export async function initDashboardPage(
  container: HTMLElement,
  sessionId: string,
  token: string,
): Promise<void> {
  state.sessionId = sessionId;
  state.dashboardToken = token;

  container.innerHTML = `
    <div class="page">
      <header class="page-header">
        <div class="container flex items-center justify-between">
          <div class="brand" id="dashboard-brand-logo" style="cursor:pointer">
            <div class="brand-icon" style="width:28px;height:28px;font-size:var(--text-sm)">LC</div>
            <div class="brand-name" style="font-size:var(--text-lg)">LAN<span>Cam</span></div>
          </div>
          <div class="flex items-center gap-3">
            <span id="ws-status" class="badge badge--offline">Connecting...</span>
          </div>
        </div>
      </header>

      <main class="page-content">
        <div class="container">
          <div id="loading-state" class="text-center" style="padding:var(--space-12) 0">
            <div class="spinner" style="margin:0 auto var(--space-4)"></div>
            <p class="text-secondary">Loading session...</p>
          </div>

          <div id="dashboard-content" class="hidden">
            <!-- Session Header -->
            <div class="flex items-center justify-between mb-6">
              <div>
                <h2 id="session-title" style="margin-bottom:var(--space-1)"></h2>
                <p class="text-muted" style="font-size:var(--text-sm)">
                  Session ID: <span id="session-id" class="text-mono"></span>
                </p>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-6);align-items:start">
              <!-- Left Column: QR Code + Join Info -->
              <div>
                <div class="card">
                  <h3 style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-4)">
                    ${icons.smartphone(20)} Connect a Camera
                  </h3>
                  <p class="text-secondary" style="font-size:var(--text-sm);margin-bottom:var(--space-4)">
                    Scan this QR code with your smartphone to start streaming.
                  </p>

                  <div class="qr-container" id="qr-container">
                    <img id="qr-image" alt="QR Code" />
                    <div class="qr-label" id="qr-code-text"></div>
                  </div>

                  <div class="mt-4" style="text-align:center">
                    <p class="text-muted" style="font-size:var(--text-xs);margin-bottom:var(--space-2)">
                      Or share this link:
                    </p>
                    <div class="flex items-center gap-2" style="justify-content:center">
                      <code id="join-url" class="text-mono" style="font-size:var(--text-xs);color:var(--color-accent);word-break:break-all"></code>
                      <button class="btn btn-sm btn-outline" id="copy-join-url" title="Copy URL">${icons.copy(14)}</button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Right Column: Camera List -->
              <div>
                <div class="card">
                  <div class="card-header">
                    <h3 style="display:flex;align-items:center;gap:var(--space-2)">
                      ${icons.video(20)} Cameras
                    </h3>
                    <span class="text-muted" style="font-size:var(--text-sm)" id="camera-count">0 connected</span>
                  </div>

                  <div id="camera-list">
                    <div class="text-center text-secondary" style="padding:var(--space-8) 0;font-size:var(--text-sm)">
                      No cameras connected yet.<br/>
                      Scan the QR code to add a camera.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Error State -->
          <div id="error-state" class="hidden text-center" style="padding:var(--space-12) 0">
            <div style="margin-bottom:var(--space-4);color:var(--color-text-muted)">${icons.alertCircle(48)}</div>
            <h3>Session Not Found</h3>
            <p class="text-secondary mt-4">This session may have expired or been deleted.</p>
            <button class="btn btn-primary mt-6" id="go-home-btn">
              Go Home
            </button>
          </div>
        </div>
      </main>
    </div>
  `;

  document.getElementById('dashboard-brand-logo')?.addEventListener('click', () => navigate('/'));
  document.getElementById('go-home-btn')?.addEventListener('click', () => navigate('/'));

  await loadSession();

  // Responsive: stack columns on mobile
  const style = document.createElement('style');
  style.textContent = `
    @media (max-width: 768px) {
      #dashboard-content > div[style*="grid-template-columns"] {
        grid-template-columns: 1fr !important;
      }
    }
  `;
  document.head.appendChild(style);
}

async function loadSession(): Promise<void> {
  try {
    const response = await fetch(`/api/sessions/${state.sessionId}`);
    if (!response.ok) {
      document.getElementById('loading-state')!.classList.add('hidden');
      document.getElementById('error-state')!.classList.remove('hidden');
      return;
    }

    const data = await response.json();
    state.sessionName = data.session.sessionName;
    state.cameras = data.session.cameras;
    state.obsUrls = data.obsUrls || {};
    state.obsHttpsUrls = data.obsHttpsUrls || {};
    state.joinCode = data.session.joinCode;

    const baseUrl = `${window.location.protocol}//${window.location.host}`;
    state.joinUrl = `${baseUrl}/join/${state.joinCode}`;

    const stored = localStorage.getItem(`lancam-session-${state.sessionId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        state.qrCodeDataUrl = parsed.qrCodeDataUrl || '';
      } catch { /* ignore */ }
    }

    const qrImage = document.getElementById('qr-image') as HTMLImageElement;
    const qrText = document.getElementById('qr-code-text');
    const joinUrlEl = document.getElementById('join-url');

    if (state.qrCodeDataUrl) {
      qrImage.src = state.qrCodeDataUrl;
    } else {
      qrImage.style.display = 'none';
      const qrContainer = document.getElementById('qr-container')!;
      const code = document.createElement('div');
      code.style.cssText = 'font-size:3rem;font-weight:700;letter-spacing:0.15em;color:#1a1a1a;padding:20px';
      code.textContent = state.joinCode;
      qrContainer.prepend(code);
    }

    if (qrText) qrText.textContent = state.joinCode;
    if (joinUrlEl) joinUrlEl.textContent = state.joinUrl;

    document.getElementById('loading-state')!.classList.add('hidden');
    document.getElementById('dashboard-content')!.classList.remove('hidden');

    document.getElementById('session-title')!.textContent = state.sessionName;
    document.getElementById('session-id')!.textContent = state.sessionId;

    updateCameraList();
    connectSignaling();

    document.getElementById('copy-join-url')!.addEventListener('click', () => {
      navigator.clipboard.writeText(state.joinUrl).then(() => {
        const btn = document.getElementById('copy-join-url')!;
        btn.textContent = '✓';
        setTimeout(() => { btn.textContent = '📋'; }, 2000);
      });
    });

  } catch (err) {
    document.getElementById('loading-state')!.classList.add('hidden');
    document.getElementById('error-state')!.classList.remove('hidden');
  }
}

function connectSignaling(): void {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  state.signaling = new SignalingClient(wsUrl, (connected) => {
    const wsStatus = document.getElementById('ws-status')!;
    if (connected) {
      wsStatus.textContent = 'Connected';
      wsStatus.className = 'badge badge--ready';
    } else {
      wsStatus.textContent = 'Reconnecting...';
      wsStatus.className = 'badge badge--warning';
    }
  });

  state.signaling.on('camera-list-update', (msg) => {
    const { cameras } = msg as { cameras: CameraInfo[] };
    state.cameras = cameras;
    updateCameraList();
    refreshObsUrls();
  });

  state.signaling.connect();

  if (state.dashboardToken) {
    state.signaling.send({
      type: 'camera-register',
      sessionToken: state.dashboardToken,
      cameraId: 'dashboard',
      cameraName: 'Dashboard',
      capabilities: {
        facingModes: [],
        resolutions: [],
        maxFrameRate: 0,
        hasZoom: false,
        hasTorch: false,
      },
    });
  }
}

async function refreshObsUrls(): Promise<void> {
  try {
    const res = await fetch(`/api/sessions/${state.sessionId}`);
    if (res.ok) {
      const data = await res.json();
      state.obsUrls = data.obsUrls || {};
      state.obsHttpsUrls = data.obsHttpsUrls || {};
    }
  } catch {
    // Non-critical
  }
}

function updateCameraList(): void {
  const listEl = document.getElementById('camera-list')!;
  const countEl = document.getElementById('camera-count')!;

  const realCameras = state.cameras.filter(c => c.cameraId !== 'dashboard');
  countEl.textContent = `${realCameras.length} connected`;

  if (realCameras.length === 0) {
    listEl.innerHTML = `
      <div class="text-center text-secondary" style="padding:var(--space-8) 0;font-size:var(--text-sm)">
        No cameras connected yet.<br/>
        Scan the QR code to add a camera.
      </div>
    `;
    return;
  }

  const emptyMsg = listEl.querySelector('.text-center.text-secondary');
  if (emptyMsg) {
    emptyMsg.remove();
  }

  const activeIds = new Set(realCameras.map(c => c.cameraId));

  const existingCards = listEl.querySelectorAll<HTMLDivElement>('.camera-card[data-camera-id]');
  existingCards.forEach((card) => {
    const cid = card.getAttribute('data-camera-id');
    if (cid && !activeIds.has(cid)) {
      card.remove();
    }
  });

  realCameras.forEach((camera) => {
    const statusClass = camera.status === 'live' ? 'live' : camera.status === 'ready' ? 'ready' : 'offline';
    const rawObsUrl = state.obsUrls[camera.cameraId] || '';
    const relativePreviewUrl = rawObsUrl ? rawObsUrl.replace(/^https?:\/\/[^/]+/, '') : '';

    let card = listEl.querySelector<HTMLDivElement>(`.camera-card[data-camera-id="${camera.cameraId}"]`);

    if (!card) {
      card = document.createElement('div');
      card.className = 'card camera-card';
      card.setAttribute('data-camera-id', camera.cameraId);
      card.style.cssText = 'margin-bottom:var(--space-4);padding:var(--space-4)';
      listEl.appendChild(card);
    }

    const iframe = card.querySelector<HTMLIFrameElement>(`#preview-frame-${camera.cameraId}`);
    if (!iframe && relativePreviewUrl) {
      card.innerHTML = `
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="status-dot status-dot--${statusClass}" id="dot-${camera.cameraId}"></span>
            <span style="font-weight:600" id="name-${camera.cameraId}">${escapeHtml(camera.cameraName)}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="badge badge--${statusClass}" id="badge-${camera.cameraId}">${camera.status.toUpperCase()}</span>
            <button class="btn btn-xs btn-outline" id="open-viewer-${camera.cameraId}" title="Open Fullscreen Viewer Tab">
              ${icons.externalLink(14)} Open Viewer
            </button>
          </div>
        </div>

        <div style="position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:var(--radius-md);overflow:hidden;margin-bottom:var(--space-3);border:1px solid var(--color-bg-card-hover)">
          <iframe
            id="preview-frame-${camera.cameraId}"
            src="${escapeHtml(relativePreviewUrl)}"
            style="width:100%;height:100%;border:none;display:block"
            allow="autoplay; camera; microphone"
          ></iframe>
        </div>

        <!-- Host URL Customizer Options -->
        <div class="obs-options-box" style="background:var(--color-bg-subtle);padding:var(--space-3);border-radius:var(--radius-md);margin-bottom:var(--space-3);font-size:var(--text-xs)">
          <div style="font-weight:600;margin-bottom:var(--space-2);color:var(--color-text-muted)">OBS Browser Options:</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
              <input type="checkbox" id="opt-audio-${camera.cameraId}" /> Sound / Audio
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
              <input type="checkbox" id="opt-mirror-${camera.cameraId}" /> Mirror (Flip H)
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
              <input type="checkbox" id="opt-fit-${camera.cameraId}" /> Cover (Fill Frame)
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
              <input type="checkbox" id="opt-stats-${camera.cameraId}" /> Show Stats HUD
            </label>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <input
            type="text"
            class="form-input"
            value="${escapeHtml(rawObsUrl)}"
            readonly
            style="font-size:var(--text-xs);padding:var(--space-2) var(--space-3)"
            id="obs-url-${camera.cameraId}"
          />
          <button
            class="btn btn-sm btn-primary flex items-center justify-center"
            id="copy-btn-${camera.cameraId}"
            title="Copy OBS URL"
          >${icons.copy(14)} Copy</button>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:var(--space-2)">
          <span class="text-muted" style="font-size:var(--text-xs)">
            ✓ HTTP link (No SSL errors in OBS Studio)
          </span>
          <a href="#" id="toggle-protocol-${camera.cameraId}" class="text-accent" style="font-size:var(--text-xs)">
            Use HTTPS Link
          </a>
        </div>
      `;

      let useHttps = false;

      const buildUrl = () => {
        const baseUrlToUse = useHttps ? (state.obsHttpsUrls[camera.cameraId] || rawObsUrl) : rawObsUrl;
        const urlObj = new URL(baseUrlToUse, window.location.origin);

        const chkAudio = card.querySelector<HTMLInputElement>(`#opt-audio-${camera.cameraId}`);
        const chkMirror = card.querySelector<HTMLInputElement>(`#opt-mirror-${camera.cameraId}`);
        const chkFit = card.querySelector<HTMLInputElement>(`#opt-fit-${camera.cameraId}`);
        const chkStats = card.querySelector<HTMLInputElement>(`#opt-stats-${camera.cameraId}`);

        if (chkAudio?.checked) urlObj.searchParams.set('audio', '1');
        else urlObj.searchParams.delete('audio');

        if (chkMirror?.checked) urlObj.searchParams.set('mirror', '1');
        else urlObj.searchParams.delete('mirror');

        if (chkFit?.checked) urlObj.searchParams.set('fit', 'cover');
        else urlObj.searchParams.delete('fit');

        if (chkStats?.checked) urlObj.searchParams.set('stats', '1');
        else urlObj.searchParams.delete('stats');

        return urlObj.toString();
      };

      const updateInput = () => {
        const input = card.querySelector<HTMLInputElement>(`#obs-url-${camera.cameraId}`);
        if (input) input.value = buildUrl();
      };

      card.querySelectorAll(`input[id^="opt-"]`).forEach((el) => {
        el.addEventListener('change', updateInput);
      });

      const copyBtn = card.querySelector(`#copy-btn-${camera.cameraId}`);
      copyBtn?.addEventListener('click', () => {
        const fullUrl = buildUrl();
        navigator.clipboard.writeText(fullUrl).then(() => {
          copyBtn.innerHTML = `✓ Copied!`;
          setTimeout(() => { copyBtn.innerHTML = `${icons.copy(14)} Copy`; }, 2000);
        });
      });

      const openBtn = card.querySelector(`#open-viewer-${camera.cameraId}`);
      openBtn?.addEventListener('click', () => {
        window.open(buildUrl(), '_blank');
      });

      const protoBtn = card.querySelector(`#toggle-protocol-${camera.cameraId}`);
      protoBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        useHttps = !useHttps;
        protoBtn.textContent = useHttps ? 'Use HTTP Link (Recommended for OBS)' : 'Use HTTPS Link';
        updateInput();
      });

    } else {
      const dot = card.querySelector(`#dot-${camera.cameraId}`);
      const badge = card.querySelector(`#badge-${camera.cameraId}`);
      const name = card.querySelector(`#name-${camera.cameraId}`);

      if (dot) dot.className = `status-dot status-dot--${statusClass}`;
      if (badge) {
        badge.className = `badge badge--${statusClass}`;
        badge.textContent = camera.status.toUpperCase();
      }
      if (name) name.textContent = camera.cameraName;
    }
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
