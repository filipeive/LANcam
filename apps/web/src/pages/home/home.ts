/**
 * LANCam — Home Page
 *
 * Landing page and session creation interface.
 * This is the first page users see when opening LANCam on their computer.
 */

import { navigate } from '../../main.js';
import { icons } from '../../lib/icons.js';

export async function initHomePage(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div class="page">
      <header class="page-header">
        <div class="container flex items-center justify-between">
          <div class="brand">
            <div class="brand-icon">LC</div>
            <div class="brand-name">LAN<span>Cam</span></div>
          </div>
          <span class="text-muted text-mono" style="font-size:var(--text-xs)">v0.1.0</span>
        </div>
      </header>

      <main class="page-content">
        <div class="container">
          <!-- Hero -->
          <div class="text-center mb-6" style="max-width:600px;margin-left:auto;margin-right:auto;padding-top:var(--space-8)">
            <h1 style="margin-bottom:var(--space-4)">
              Turn your phone into a<br/>
              <span style="background:linear-gradient(135deg, #3b82f6, #8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">live camera for OBS</span>
            </h1>
            <p class="text-secondary" style="font-size:var(--text-lg);line-height:1.7">
              Stream high-quality video from your smartphone directly to OBS Studio
              over your local network. No internet required.
            </p>
          </div>

          <!-- Create Session Card -->
          <div class="card" style="max-width:480px;margin:var(--space-8) auto 0">
            <h3 style="margin-bottom:var(--space-4)">Create a Session</h3>
            <p class="text-secondary" style="margin-bottom:var(--space-6);font-size:var(--text-sm)">
              Give your session a name and scan the QR code with your phone to start streaming.
            </p>

            <form id="create-session-form">
              <div class="form-group">
                <label class="form-label" for="session-name">Session Name</label>
                <input
                  type="text"
                  id="session-name"
                  class="form-input"
                  placeholder="e.g., Sunday Service, Studio A, Meeting Room"
                  maxlength="100"
                  required
                  autofocus
                />
              </div>
              <button type="submit" class="btn btn-primary btn-lg btn-block" id="create-btn">
                Create Session
              </button>
            </form>

            <div id="create-error" class="alert alert--error mt-4 hidden"></div>
          </div>

          <!-- Existing Sessions -->
          <div id="sessions-section" class="hidden" style="max-width:480px;margin:var(--space-8) auto 0">
            <h3 style="margin-bottom:var(--space-4)">Active Sessions</h3>
            <div id="sessions-list"></div>
          </div>

          <!-- How it Works -->
          <div style="max-width:600px;margin:var(--space-12) auto 0">
            <h3 class="text-center" style="margin-bottom:var(--space-6)">How It Works</h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:var(--space-4)">
              <div class="card text-center" style="padding:var(--space-5)">
                <div style="color:var(--color-accent);margin-bottom:var(--space-2)">${icons.copy(28)}</div>
                <div style="font-weight:600;margin-bottom:var(--space-1)">1. Create</div>
                <div class="text-muted" style="font-size:var(--text-sm)">Start a new session</div>
              </div>
              <div class="card text-center" style="padding:var(--space-5)">
                <div style="color:var(--color-accent);margin-bottom:var(--space-2)">${icons.smartphone(28)}</div>
                <div style="font-weight:600;margin-bottom:var(--space-1)">2. Scan</div>
                <div class="text-muted" style="font-size:var(--text-sm)">QR code with your phone</div>
              </div>
              <div class="card text-center" style="padding:var(--space-5)">
                <div style="color:var(--color-accent);margin-bottom:var(--space-2)">${icons.video(28)}</div>
                <div style="font-weight:600;margin-bottom:var(--space-1)">3. Stream</div>
                <div class="text-muted" style="font-size:var(--text-sm)">Low-latency to OBS</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer style="padding:var(--space-6) 0;text-align:center;border-top:1px solid var(--color-border)">
        <p class="text-muted" style="font-size:var(--text-sm)">
          LANCam — LAN-first, low-latency, web-first camera streaming
        </p>
      </footer>
    </div>
  `;

  // Load existing sessions
  loadSessions();

  // Form handler
  const form = document.getElementById('create-session-form') as HTMLFormElement;
  const nameInput = document.getElementById('session-name') as HTMLInputElement;
  const createBtn = document.getElementById('create-btn') as HTMLButtonElement;
  const errorDiv = document.getElementById('create-error') as HTMLDivElement;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = nameInput.value.trim();
    if (!name) return;

    createBtn.disabled = true;
    createBtn.textContent = 'Creating...';
    errorDiv.classList.add('hidden');

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create session');
      }

      const data = await response.json();

      // Store QR data for dashboard
      localStorage.setItem(`lancam-session-${data.sessionId}`, JSON.stringify({
        joinCode: data.joinCode,
        joinUrl: data.joinUrl,
        qrCodeDataUrl: data.qrCodeDataUrl,
        dashboardToken: data.dashboardToken,
      }));

      // Navigate to dashboard
      navigate(`/dashboard/${data.sessionId}?token=${data.dashboardToken}`);
    } catch (err) {
      errorDiv.textContent = err instanceof Error ? err.message : 'Failed to create session';
      errorDiv.classList.remove('hidden');
      createBtn.disabled = false;
      createBtn.textContent = 'Create Session';
    }
  });
}

async function loadSessions(): Promise<void> {
  try {
    const response = await fetch('/api/sessions');
    if (!response.ok) return;

    const { sessions } = await response.json();
    if (!sessions || sessions.length === 0) return;

    const section = document.getElementById('sessions-section')!;
    const list = document.getElementById('sessions-list')!;

    section.classList.remove('hidden');

    list.innerHTML = sessions.map((session: {
      sessionId: string;
      sessionName: string;
      state: string;
      cameras: Array<{ cameraId: string }>;
    }) => `
      <div class="card" style="margin-bottom:var(--space-3);cursor:pointer;padding:var(--space-4)"
           onclick="window.location.href='/dashboard/${session.sessionId}'">
        <div class="flex items-center justify-between">
          <div>
            <div style="font-weight:600">${escapeHtml(session.sessionName)}</div>
            <div class="text-muted" style="font-size:var(--text-sm)">
              ${session.cameras.length} camera${session.cameras.length !== 1 ? 's' : ''}
            </div>
          </div>
          <span class="badge badge--${session.state === 'active' ? 'ready' : 'offline'}">
            ${session.state}
          </span>
        </div>
      </div>
    `).join('');
  } catch {
    // Silently fail — sessions list is not critical
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
