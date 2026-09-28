/**
 * LANCam — Premium Dashboard Page
 *
 * Session management dashboard featuring real-time camera grid layouts,
 * zoom controls, session deletion, QR code sharing, and OBS URL customizer.
 */

import type { CameraInfo } from '@lancam/shared';
import { SignalingClient } from '../../lib/signaling-client.js';
import { icons } from '../../lib/icons.js';
import { navigate, getBasePrefix } from '../../main.js';

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
  gridColumns: number;
  zoomLevel: number;
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
  gridColumns: 2,
  zoomLevel: 100,
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
      <header class="page-header" style="border-bottom:1px solid rgba(255,255,255,0.08);background:rgba(15,23,42,0.8);backdrop-filter:blur(12px)">
        <div class="container flex items-center justify-between" style="padding-top:var(--space-3);padding-bottom:var(--space-3)">
          <div class="brand" id="dashboard-brand-logo" style="cursor:pointer;display:flex;align-items:center;gap:10px">
            <div class="brand-icon" style="width:32px;height:32px;font-size:var(--text-sm);background:linear-gradient(135deg,#38bdf8,#818cf8);color:#000;font-weight:800;border-radius:8px">LC</div>
            <div class="brand-name" style="font-size:var(--text-xl);font-weight:700">LAN<span style="color:#38bdf8">Cam</span></div>
          </div>
          <div class="flex items-center gap-3">
            <span id="ws-status" class="badge badge--offline" style="padding:4px 10px;border-radius:20px;font-size:0.75rem">Connecting...</span>
            <button id="btn-delete-session" class="btn btn-sm btn-outline-danger flex items-center gap-1" style="border-color:rgba(239,68,68,0.4);color:#ef4444;background:rgba(239,68,68,0.1)">
              ${icons.trash(14)} <span>Eliminar Sessão</span>
            </button>
          </div>
        </div>
      </header>

      <main class="page-content" style="padding-top:var(--space-6)">
        <div class="container">
          <div id="loading-state" class="text-center" style="padding:var(--space-12) 0">
            <div class="spinner" style="margin:0 auto var(--space-4)"></div>
            <p class="text-secondary">A carregar painel da sessão...</p>
          </div>

          <div id="dashboard-content" class="hidden">
            <!-- Session Title & Control Toolbar -->
            <div class="flex items-center justify-between mb-6" style="flex-wrap:wrap;gap:16px;background:rgba(30,41,59,0.5);padding:16px;border-radius:12px;border:1px solid rgba(255,255,255,0.08)">
              <div>
                <div style="display:flex;align-items:center;gap:10px">
                  <h2 id="session-title" style="margin:0;font-size:1.5rem;font-weight:700"></h2>
                  <span id="session-status-badge" class="badge badge--ready" style="font-size:0.7rem">ATIVA</span>
                </div>
                <p class="text-muted" style="font-size:var(--text-sm);margin-top:4px;margin-bottom:0">
                  ID da Sessão: <span id="session-id" class="text-mono" style="color:#38bdf8"></span>
                </p>
              </div>

              <!-- Camera Controls Toolbar -->
              <div class="flex items-center gap-3" style="flex-wrap:wrap">
                <!-- Grid Selector -->
                <div style="display:flex;background:rgba(15,23,42,0.6);border-radius:8px;padding:3px;border:1px solid rgba(255,255,255,0.1)">
                  <button id="btn-grid-1" class="btn btn-xs btn-ghost" title="1 Coluna" style="padding:4px 10px;font-size:0.75rem">1 Coluna</button>
                  <button id="btn-grid-2" class="btn btn-xs btn-ghost" title="2 Colunas (Grade)" style="padding:4px 10px;font-size:0.75rem">Grade (2x2)</button>
                  <button id="btn-grid-3" class="btn btn-xs btn-ghost" title="3 Colunas" style="padding:4px 10px;font-size:0.75rem">3 Colunas</button>
                </div>

                <!-- Zoom Controls -->
                <div style="display:flex;align-items:center;gap:4px;background:rgba(15,23,42,0.6);border-radius:8px;padding:3px;border:1px solid rgba(255,255,255,0.1);font-size:0.75rem">
                  <span style="color:var(--color-text-muted);padding:0 6px">Zoom:</span>
                  <button id="btn-zoom-out" class="btn btn-xs btn-ghost" style="padding:2px 8px">${icons.minus(12)}</button>
                  <span id="zoom-label" style="font-weight:600;min-width:38px;text-align:center">100%</span>
                  <button id="btn-zoom-in" class="btn btn-xs btn-ghost" style="padding:2px 8px">${icons.plus(12)}</button>
                </div>
              </div>
            </div>

            <!-- Main Layout Grid -->
            <div style="display:grid;grid-template-columns:340px 1fr;gap:var(--space-6);align-items:start" id="dashboard-grid-layout">
              <!-- Left Column: QR Code + Connection Box -->
              <div>
                <div class="card" style="background:rgba(30,41,59,0.7);border:1px solid rgba(255,255,255,0.1);box-shadow:0 10px 30px rgba(0,0,0,0.3)">
                  <h3 style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-3);font-size:1.1rem;color:#f8fafc">
                    ${icons.smartphone(20)} Conectar Câmera
                  </h3>
                  <p class="text-secondary" style="font-size:var(--text-sm);margin-bottom:var(--space-4);line-height:1.4">
                    Digitalize este código QR no smartphone para iniciar a transmissão.
                  </p>

                  <div class="qr-container" id="qr-container" style="background:#ffffff;padding:16px;border-radius:12px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.2)">
                    <img id="qr-image" alt="QR Code" style="max-width:100%;height:auto;border-radius:4px" />
                    <div class="qr-label" id="qr-code-text" style="font-family:monospace;font-size:1.8rem;font-weight:800;letter-spacing:0.2em;color:#0f172a;margin-top:8px"></div>
                  </div>

                  <div class="mt-4" style="text-align:center">
                    <p class="text-muted" style="font-size:var(--text-xs);margin-bottom:var(--space-2)">
                      Ou partilhe este link direto:
                    </p>
                    <div class="flex items-center gap-2" style="justify-content:center;background:rgba(15,23,42,0.6);padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.08)">
                      <code id="join-url" class="text-mono" style="font-size:0.75rem;color:#38bdf8;word-break:break-all"></code>
                      <button class="btn btn-sm btn-outline" id="copy-join-url" title="Copiar Link" style="padding:4px 8px">${icons.copy(14)}</button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Right Column: Connected Cameras -->
              <div>
                <div class="card" style="background:rgba(30,41,59,0.7);border:1px solid rgba(255,255,255,0.1)">
                  <div class="card-header" style="display:flex;align-items:center;justify-content:between;margin-bottom:var(--space-4)">
                    <h3 style="display:flex;align-items:center;gap:var(--space-2);margin:0;font-size:1.1rem">
                      ${icons.video(20)} Câmeras Conetadas
                    </h3>
                    <span class="badge badge--ready" style="font-size:0.75rem" id="camera-count">0 conectadas</span>
                  </div>

                  <!-- Dynamic Multi-Camera Grid Container -->
                  <div id="camera-list" style="display:grid;grid-template-columns:repeat(2, 1fr);gap:16px;transition:all 0.3s ease">
                    <div class="text-center text-secondary" style="padding:var(--space-12) 0;font-size:var(--text-sm);grid-column:1/-1">
                      <div style="margin-bottom:12px;opacity:0.5">${icons.camera(40)}</div>
                      Nenhuma câmera conetada neste momento.<br/>
                      Digitalize o QR Code com o telemóvel para adicionar uma câmera.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Error State -->
          <div id="error-state" class="hidden text-center" style="padding:var(--space-12) 0">
            <div style="margin-bottom:var(--space-4);color:var(--color-text-muted)">${icons.alertCircle(48)}</div>
            <h3>Sessão Não Encontrada</h3>
            <p class="text-secondary mt-4">Esta sessão foi encerrada, eliminada ou expirou.</p>
            <button class="btn btn-primary mt-6" id="go-home-btn">
              Voltar ao Início
            </button>
          </div>
        </div>
      </main>

      <!-- Delete Session Confirmation Modal -->
      <div id="delete-modal" class="hidden" style="position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:999">
        <div class="card" style="max-width:420px;width:90%;background:#1e293b;border:1px solid rgba(239,68,68,0.3);box-shadow:0 20px 50px rgba(0,0,0,0.5)">
          <div style="display:flex;align-items:center;gap:12px;color:#ef4444;margin-bottom:12px">
            ${icons.trash(24)}
            <h3 style="margin:0;font-weight:700">Eliminar Sessão</h3>
          </div>
          <p style="font-size:0.9rem;color:#cbd5e1;line-height:1.5;margin-bottom:20px">
            Tem a certeza que pretende encerrar esta sessão? Todas as câmeras e links associados ao OBS deixarão de funcionar de imediato.
          </p>
          <div style="display:flex;justify-content:flex-end;gap:10px">
            <button id="btn-cancel-delete" class="btn btn-outline" style="padding:8px 16px">Cancelar</button>
            <button id="btn-confirm-delete" class="btn btn-danger" style="padding:8px 16px;background:#ef4444;color:#fff;border:none">Eliminar Sessão</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('dashboard-brand-logo')?.addEventListener('click', () => navigate('/'));
  document.getElementById('go-home-btn')?.addEventListener('click', () => navigate('/'));

  // Delete session listeners
  const modal = document.getElementById('delete-modal')!;
  document.getElementById('btn-delete-session')?.addEventListener('click', () => {
    modal.classList.remove('hidden');
  });
  document.getElementById('btn-cancel-delete')?.addEventListener('click', () => {
    modal.classList.add('hidden');
  });
  document.getElementById('btn-confirm-delete')?.addEventListener('click', deleteSession);

  // Grid layout controls listeners
  setupGridControls();

  await loadSession();

  // Responsive breakpoints styling
  const style = document.createElement('style');
  style.textContent = `
    @media (max-width: 900px) {
      #dashboard-grid-layout {
        grid-template-columns: 1fr !important;
      }
    }
    .status-dot--live {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #ef4444;
      box-shadow: 0 0 10px #ef4444;
      animation: pulse 1.5s infinite;
      display: inline-block;
    }
    @keyframes pulse {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
      70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }
  `;
  document.head.appendChild(style);
}

function setupGridControls(): void {
  const btn1 = document.getElementById('btn-grid-1');
  const btn2 = document.getElementById('btn-grid-2');
  const btn3 = document.getElementById('btn-grid-3');
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const zoomLabel = document.getElementById('zoom-label');

  const updateButtons = () => {
    [btn1, btn2, btn3].forEach((btn, idx) => {
      if (!btn) return;
      if (idx + 1 === state.gridColumns) {
        btn.style.background = '#38bdf8';
        btn.style.color = '#000';
        btn.style.fontWeight = '700';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = 'var(--color-text-muted)';
        btn.style.fontWeight = '400';
      }
    });

    const cameraList = document.getElementById('camera-list');
    if (cameraList) {
      cameraList.style.gridTemplateColumns = `repeat(${state.gridColumns}, 1fr)`;
      cameraList.style.transform = `scale(${state.zoomLevel / 100})`;
      cameraList.style.transformOrigin = 'top left';
    }

    if (zoomLabel) {
      zoomLabel.textContent = `${state.zoomLevel}%`;
    }
  };

  btn1?.addEventListener('click', () => { state.gridColumns = 1; updateButtons(); });
  btn2?.addEventListener('click', () => { state.gridColumns = 2; updateButtons(); });
  btn3?.addEventListener('click', () => { state.gridColumns = 3; updateButtons(); });

  btnZoomIn?.addEventListener('click', () => {
    state.zoomLevel = Math.min(150, state.zoomLevel + 10);
    updateButtons();
  });

  btnZoomOut?.addEventListener('click', () => {
    state.zoomLevel = Math.max(70, state.zoomLevel - 10);
    updateButtons();
  });

  updateButtons();
}

async function deleteSession(): Promise<void> {
  const btnConfirm = document.getElementById('btn-confirm-delete') as HTMLButtonElement;
  btnConfirm.disabled = true;
  btnConfirm.textContent = 'A eliminar...';

  try {
    const res = await fetch(`/api/sessions/${state.sessionId}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      state.signaling?.disconnect();
      localStorage.removeItem(`lancam-session-${state.sessionId}`);
      navigate('/');
    } else {
      alert('Não foi possível eliminar a sessão.');
    }
  } catch {
    alert('Erro de conexão ao eliminar a sessão.');
  } finally {
    btnConfirm.disabled = false;
    btnConfirm.textContent = 'Eliminar Sessão';
    document.getElementById('delete-modal')?.classList.add('hidden');
  }
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

    const basePrefix = getBasePrefix();
    const baseUrl = `${window.location.protocol}//${window.location.host}${basePrefix}`;
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
      code.style.cssText = 'font-size:2.5rem;font-weight:800;letter-spacing:0.15em;color:#0f172a;padding:20px';
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
        btn.textContent = '✓ Copiado!';
        setTimeout(() => { btn.innerHTML = `${icons.copy(14)}`; }, 2000);
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
      wsStatus.textContent = 'Conetado';
      wsStatus.className = 'badge badge--ready';
    } else {
      wsStatus.textContent = 'A reconetar...';
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
  countEl.textContent = `${realCameras.length} conetada${realCameras.length !== 1 ? 's' : ''}`;

  if (realCameras.length === 0) {
    listEl.innerHTML = `
      <div class="text-center text-secondary" style="padding:var(--space-12) 0;font-size:var(--text-sm);grid-column:1/-1">
        <div style="margin-bottom:12px;opacity:0.5">${icons.camera(40)}</div>
        Nenhuma câmera conetada neste momento.<br/>
        Digitalize o QR Code com o telemóvel para adicionar uma câmera.
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
      card.style.cssText = 'background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:16px;box-shadow:0 8px 24px rgba(0,0,0,0.3)';
      listEl.appendChild(card);
    }

    const iframe = card.querySelector<HTMLIFrameElement>(`#preview-frame-${camera.cameraId}`);
    if (!iframe && relativePreviewUrl) {
      card.innerHTML = `
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="${camera.status === 'live' ? 'status-dot--live' : 'status-dot'}" id="dot-${camera.cameraId}"></span>
            <span style="font-weight:700;font-size:0.95rem" id="name-${camera.cameraId}">${escapeHtml(camera.cameraName)}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="badge badge--${statusClass}" id="badge-${camera.cameraId}">${camera.status.toUpperCase()}</span>
            <button class="btn btn-xs btn-outline" id="open-viewer-${camera.cameraId}" title="Abrir Visualizador Em Ecrã Inteiro">
              ${icons.externalLink(14)} Visualizador
            </button>
          </div>
        </div>

        <!-- 16:9 Video Stream Preview Frame -->
        <div style="position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:8px;overflow:hidden;margin-bottom:12px;border:1px solid rgba(255,255,255,0.12)">
          <iframe
            id="preview-frame-${camera.cameraId}"
            src="${escapeHtml(relativePreviewUrl)}"
            style="width:100%;height:100%;border:none;display:block"
            allow="autoplay; camera; microphone"
          ></iframe>
        </div>

        <!-- OBS Options Box -->
        <div class="obs-options-box" style="background:rgba(30,41,59,0.7);padding:12px;border-radius:8px;margin-bottom:12px;border:1px solid rgba(255,255,255,0.06)">
          <div style="font-weight:600;margin-bottom:8px;color:#94a3b8;font-size:0.75rem">Opções do Link OBS Browser Source:</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.75rem">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;color:#e2e8f0">
              <input type="checkbox" id="opt-audio-${camera.cameraId}" /> Sound / Audio
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;color:#e2e8f0">
              <input type="checkbox" id="opt-mirror-${camera.cameraId}" /> Mirror (Flip H)
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;color:#e2e8f0">
              <input type="checkbox" id="opt-fit-${camera.cameraId}" /> Cover (Fill Frame)
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;color:#e2e8f0">
              <input type="checkbox" id="opt-stats-${camera.cameraId}" /> Show Stats HUD
            </label>
          </div>
        </div>

        <!-- OBS URL Field & Copy Button -->
        <div class="flex items-center gap-2">
          <input
            type="text"
            class="form-input"
            value="${escapeHtml(rawObsUrl)}"
            readonly
            style="font-size:0.75rem;padding:6px 10px;background:rgba(15,23,42,0.9);color:#38bdf8;border:1px solid rgba(255,255,255,0.12)"
            id="obs-url-${camera.cameraId}"
          />
          <button
            class="btn btn-sm btn-primary flex items-center justify-center gap-1"
            id="copy-btn-${camera.cameraId}"
            title="Copiar Link para o OBS"
            style="white-space:nowrap;padding:6px 14px;font-weight:600"
          >${icons.copy(14)} Copiar</button>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
          <span style="font-size:0.725rem;color:#10b981;display:flex;align-items:center;gap:4px">
            ✓ Link HTTP (Sem erros SSL no OBS Studio)
          </span>
          <a href="#" id="toggle-protocol-${camera.cameraId}" style="font-size:0.725rem;color:#38bdf8;text-decoration:none">
            Usar Link HTTPS
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
          copyBtn.innerHTML = `✓ Copiado!`;
          setTimeout(() => { copyBtn.innerHTML = `${icons.copy(14)} Copiar`; }, 2000);
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
        protoBtn.textContent = useHttps ? 'Usar Link HTTP (Recomendado para OBS)' : 'Usar Link HTTPS';
        updateInput();
      });

    } else {
      const dot = card.querySelector(`#dot-${camera.cameraId}`);
      const badge = card.querySelector(`#badge-${camera.cameraId}`);
      const name = card.querySelector(`#name-${camera.cameraId}`);

      if (dot) dot.className = camera.status === 'live' ? 'status-dot--live' : 'status-dot';
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

