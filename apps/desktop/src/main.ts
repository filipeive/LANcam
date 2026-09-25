import { app, BrowserWindow, Menu, Tray, clipboard, shell, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { networkInterfaces } from 'os';
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let serverPort = 3478;

function getLocalIPs(): string[] {
  const interfaces = networkInterfaces();
  const ips: string[] = [];
  for (const iface of Object.values(interfaces)) {
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) {
        ips.push(addr.address);
      }
    }
  }
  return ips;
}

async function startEmbeddedServer(): Promise<number> {
  try {
    // Dynamic ESM import to support CommonJS main process loading ESM server module
    // @ts-ignore
    const { loadConfig, createServer } = await import('@lancam/server');
    const config = loadConfig();
    serverPort = config.port;

    const { server, httpServer } = await createServer(config);

    server.listen(config.port, config.host, () => {
      console.log(`[Electron Desktop] Embedded server listening on port ${config.port}`);
    });

    if (httpServer) {
      httpServer.listen(config.httpPort, config.host, () => {
        console.log(`[Electron Desktop] Embedded HTTP server listening on port ${config.httpPort}`);
      });
    }

    return config.port;
  } catch (err) {
    console.error('[Electron Desktop] Server launch failed:', err);
    return serverPort;
  }
}

function createWindow(port: number): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'LANCam — Local Network Camera',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
    backgroundColor: '#0f172a',
  });

  // Ignore certificate errors for local self-signed HTTPS
  app.on('certificate-error', (event: any, _webContents: any, _url: any, _error: any, _certificate: any, callback: (allow: boolean) => void) => {
    event.preventDefault();
    callback(true);
  });

  const url = `https://localhost:${port}`;
  mainWindow.loadURL(url).catch(() => {
    // Fallback to HTTP if SSL certs were not generated yet
    mainWindow?.loadURL(`http://localhost:${port - 100 || 3478}`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray(port: number): void {
  const localIPs = getLocalIPs();
  const primaryIP = localIPs[0] || '127.0.0.1';

  const contextMenu = Menu.buildFromTemplate([
    { label: 'LANCam Desktop Active', enabled: false },
    { type: 'separator' },
    {
      label: 'Open Dashboard',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow(port);
        }
      },
    },
    {
      label: `Copy Smartphone URL (https://${primaryIP}:${port})`,
      click: () => {
        clipboard.writeText(`https://${primaryIP}:${port}`);
      },
    },
    {
      label: `Copy OBS HTTP URL (http://${primaryIP}:${port - 100})`,
      click: () => {
        clipboard.writeText(`http://${primaryIP}:${port - 100}`);
      },
    },
    { type: 'separator' },
    {
      label: 'Quit LANCam',
      click: () => {
        app.quit();
      },
    },
  ]);

  try {
    const iconPath = [
      path.join(app.getAppPath(), 'build/icon.png'),
      path.join(__dirname, '../build/icon.png'),
      path.join(__dirname, 'build/icon.png'),
    ].find((p) => fs.existsSync(p));
    if (iconPath) {
      tray = new Tray(iconPath);
      tray.setToolTip('LANCam Local Network Camera');
      tray.setContextMenu(contextMenu);
    }
  } catch {
    // Tray icon fallback
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    ipcMain.on('copy-to-clipboard', (_event: any, text: string) => {
      clipboard.writeText(text);
    });

    ipcMain.on('open-external', (_event: any, url: string) => {
      shell.openExternal(url);
    });

    ipcMain.handle('get-server-info', () => {
      return {
        port: serverPort,
        localIPs: getLocalIPs(),
      };
    });

    const port = await startEmbeddedServer();
    createWindow(port);
    createTray(port);
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
