/**
 * LANCam — Main Application Entry Point
 *
 * Simple hash-based router that loads the appropriate page
 * based on the URL path. No framework needed.
 */

import './styles/global.css';

// Determine which page to load based on URL path
async function route(): Promise<void> {
  const path = window.location.pathname;
  const app = document.getElementById('app')!;

  // Clear previous page
  app.innerHTML = '';

  try {
    if (path.startsWith('/join/')) {
      // Camera join page — extract join code
      const joinCode = path.split('/join/')[1]?.split('?')[0] || '';
      const { initCameraPage } = await import('./pages/camera/camera.js');
      await initCameraPage(app, joinCode);
    } else if (path.startsWith('/camera/') && path.includes('/view')) {
      // OBS Viewer endpoint
      const parts = path.match(/\/camera\/([^/]+)\/view/);
      const cameraId = parts?.[1] || '';
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token') || '';
      const sessionId = params.get('session') || '';
      const { initViewerPage } = await import('./pages/viewer/viewer.js');
      await initViewerPage(app, cameraId, token, sessionId);
    } else if (path === '/dashboard' || path.startsWith('/dashboard/')) {
      // Dashboard
      const parts = path.match(/\/dashboard\/?(.*)/);
      const sessionId = parts?.[1] || '';
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token') || '';
      const { initDashboardPage } = await import('./pages/dashboard/dashboard.js');
      await initDashboardPage(app, sessionId, token);
    } else {
      // Home / Landing page
      const { initHomePage } = await import('./pages/home/home.js');
      await initHomePage(app);
    }
  } catch (err) {
    console.error('Failed to load page:', err);
    app.innerHTML = `
      <div class="page">
        <div class="container" style="display:flex;align-items:center;justify-content:center;min-height:100vh">
          <div class="card text-center" style="max-width:400px">
            <h2>Something went wrong</h2>
            <p class="text-secondary mt-4">Failed to load this page. Please try again.</p>
            <button class="btn btn-primary mt-6" onclick="window.location.reload()">Reload</button>
          </div>
        </div>
      </div>
    `;
  }
}

// Navigate without full page reload
export function navigate(path: string): void {
  window.history.pushState({}, '', path);
  route();
}

// Handle browser back/forward
window.addEventListener('popstate', () => route());

// Initial route
route();
