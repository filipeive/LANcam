/**
 * LANCam — Main Application Entry Point
 *
 * Simple SPA router that loads the appropriate page based on URL path.
 * Supports root base path prefixes (e.g. /lancam/ or /).
 */

import './styles/global.css';

import { initHomePage } from './pages/home/home.js';
import { initCameraPage } from './pages/camera/camera.js';
import { initViewerPage } from './pages/viewer/viewer.js';
import { initDashboardPage } from './pages/dashboard/dashboard.js';

export function getBasePrefix(): string {
  const pathname = window.location.pathname;
  if (pathname.startsWith('/lancam')) {
    return '/lancam';
  }
  return '';
}

// Determine which page to load based on URL path
async function route(): Promise<void> {
  const fullPath = window.location.pathname;
  const basePrefix = getBasePrefix();

  // Strip basePrefix if present
  let path = basePrefix && fullPath.startsWith(basePrefix)
    ? fullPath.slice(basePrefix.length)
    : fullPath;

  if (!path || !path.startsWith('/')) {
    path = '/' + (path || '');
  }

  const app = document.getElementById('app')!;
  app.innerHTML = '';

  try {
    if (path.startsWith('/join/')) {
      // Camera join page — extract join code
      const joinCode = path.split('/join/')[1]?.split('?')[0] || '';
      await initCameraPage(app, joinCode);
    } else if (path.startsWith('/camera/') && path.includes('/view')) {
      // OBS Viewer endpoint
      const parts = path.match(/\/camera\/([^/]+)\/view/);
      const cameraId = parts?.[1] || '';
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token') || '';
      const sessionId = params.get('session') || '';
      await initViewerPage(app, cameraId, token, sessionId);
    } else if (path === '/dashboard' || path.startsWith('/dashboard/')) {
      // Dashboard
      const parts = path.match(/\/dashboard\/?(.*)/);
      const sessionId = parts?.[1] || '';
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token') || '';
      await initDashboardPage(app, sessionId, token);
    } else {
      // Home / Landing page
      await initHomePage(app);
    }
  } catch (err) {
    console.error('Failed to load page:', err);
    app.innerHTML = `
      <div class="page">
        <div class="container" style="display:flex;align-items:center;justify-content:center;min-height:100vh">
          <div class="card text-center" style="max-width:400px">
            <h2>Página não pôde ser carregada</h2>
            <p class="text-secondary mt-4">${err instanceof Error ? err.message : 'Erro ao inicializar página'}</p>
            <button class="btn btn-primary mt-6" onclick="window.location.reload()">Recarregar</button>
          </div>
        </div>
      </div>
    `;
  }
}

// Global unhandled error handlers
window.addEventListener('error', (event) => {
  console.error('[LANCam Error]', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[LANCam Promise Rejection]', event.reason);
});

// Navigate without full page reload
export function navigate(path: string): void {
  const basePrefix = getBasePrefix();
  let targetPath = path;

  if (basePrefix) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    if (!cleanPath.startsWith(basePrefix)) {
      targetPath = `${basePrefix}${cleanPath}`;
    }
  }

  window.history.pushState({}, '', targetPath);
  route();
}

// Handle browser back/forward
window.addEventListener('popstate', () => route());

// Initial route
route();
