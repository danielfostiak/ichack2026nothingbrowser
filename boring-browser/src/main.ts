import { app, BrowserWindow, BrowserView, ipcMain } from 'electron';
import * as path from 'path';
import { IPC_CHANNELS } from './ipc';

let mainWindow: BrowserWindow | null = null;
let browserView: BrowserView | null = null;
let minimalModeEnabled = true;
let cspStripperInstalled = false;

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const CHROME_HEIGHT = 60;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 1000,
    backgroundColor: '#0b0b0c',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  // Create the browser chrome UI
  const chromeHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background: #1a1a1c;
          color: #e0e0e0;
          height: ${CHROME_HEIGHT}px;
          display: flex;
          align-items: center;
          padding: 0 12px;
          gap: 8px;
          -webkit-app-region: drag;
        }
        button {
          -webkit-app-region: no-drag;
          background: #2a2a2c;
          border: 1px solid #3a3a3c;
          color: #e0e0e0;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          transition: background 0.2s;
        }
        button:hover { background: #3a3a3c; }
        button:active { background: #252527; }
        button.active {
          background: #007acc;
          border-color: #007acc;
        }
        input {
          -webkit-app-region: no-drag;
          flex: 1;
          background: #2a2a2c;
          border: 1px solid #3a3a3c;
          color: #e0e0e0;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 13px;
          outline: none;
        }
        input:focus { border-color: #007acc; }
        .nav-group { display: flex; gap: 4px; }
      </style>
    </head>
    <body>
      <div class="nav-group">
        <button id="back" title="Back">←</button>
        <button id="forward" title="Forward">→</button>
        <button id="refresh" title="Refresh">⟳</button>
      </div>
      <input type="text" id="url" placeholder="Enter URL...">
      <button id="minimal-toggle" class="active">Minimal Mode</button>
      <script>
        const { ipcRenderer } = require('electron');

        const backBtn = document.getElementById('back');
        const forwardBtn = document.getElementById('forward');
        const refreshBtn = document.getElementById('refresh');
        const urlInput = document.getElementById('url');
        const minimalToggle = document.getElementById('minimal-toggle');

        backBtn.addEventListener('click', () => ipcRenderer.send('nav-back'));
        forwardBtn.addEventListener('click', () => ipcRenderer.send('nav-forward'));
        refreshBtn.addEventListener('click', () => ipcRenderer.send('nav-refresh'));

        const DEFAULT_SEARCH_URL = 'https://duckduckgo.com/html/?q=';

        const normalizeInputToUrl = (rawInput) => {
          const input = rawInput.trim();
          if (!input) return '';

          if (input.includes('://')) {
            return input;
          }

          const withoutPath = input.split('/')[0];
          const host = withoutPath.includes('@') ? withoutPath.split('@').pop() : withoutPath;
          const hostWithoutPort = host.split(':')[0];

          const isLocalhost = hostWithoutPort === 'localhost';
          const isIp = (() => {
            const parts = hostWithoutPort.split('.');
            if (parts.length !== 4) return false;
            return parts.every(part => {
              if (part.length === 0) return false;
              const num = Number(part);
              return Number.isInteger(num) && num >= 0 && num <= 255;
            });
          })();
          const looksLikeDomain = hostWithoutPort.includes('.') && !hostWithoutPort.includes(' ');

          if (isLocalhost || isIp) {
            return 'http://' + input;
          }

          if (looksLikeDomain) {
            return 'https://' + input;
          }

          return DEFAULT_SEARCH_URL + encodeURIComponent(input);
        };

        urlInput.addEventListener('focus', () => {
          urlInput.select();
        });

        urlInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            const url = normalizeInputToUrl(urlInput.value);
            if (!url) return;
            ipcRenderer.send('nav-to', url);
          }
        });

        minimalToggle.addEventListener('click', () => {
          ipcRenderer.send('toggle-minimal');
        });

        ipcRenderer.on('url-changed', (event, url) => {
          urlInput.value = url;
        });

        ipcRenderer.on('minimal-mode-changed', (event, enabled) => {
          if (enabled) {
            minimalToggle.classList.add('active');
            minimalToggle.textContent = 'Minimal Mode';
          } else {
            minimalToggle.classList.remove('active');
            minimalToggle.textContent = 'Normal Mode';
          }
        });
      </script>
    </body>
    </html>
  `;

  mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(chromeHTML));

  // Create BrowserView
  browserView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: false, // Must be false to manipulate page DOM
      sandbox: false,
      nodeIntegration: true, // Needed for preload to use node modules
    }
  });

  if (!cspStripperInstalled) {
    cspStripperInstalled = true;
    const session = browserView.webContents.session;
    session.webRequest.onHeadersReceived((details, callback) => {
      const headers = details.responseHeaders || {};
      const strippedHeaders: Record<string, string[] | string> = {};

      Object.keys(headers).forEach((key) => {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey === 'content-security-policy' ||
          lowerKey === 'content-security-policy-report-only' ||
          lowerKey === 'x-webkit-csp'
        ) {
          return;
        }
        strippedHeaders[key] = headers[key] as string[] | string;
      });

      callback({ responseHeaders: strippedHeaders });
    });
  }

  // Use a standard Chrome UA to avoid Google "sorry" blocks
  browserView.webContents.setUserAgent(DEFAULT_USER_AGENT);

  // Set dark background to prevent white flash
  browserView.setBackgroundColor('#0b0b0c');

  mainWindow.setBrowserView(browserView);
  updateBrowserViewBounds();

  // Handle window resize
  mainWindow.on('resize', updateBrowserViewBounds);

  // Note: We rely on preload veil + dark BrowserView background for zero-flicker
  // No CSS injection here as it interferes with minimal mode toggle

  // Navigation handlers
  ipcMain.on('nav-back', () => {
    if (browserView && browserView.webContents.canGoBack()) {
      browserView.webContents.goBack();
    }
  });

  ipcMain.on('nav-forward', () => {
    if (browserView && browserView.webContents.canGoForward()) {
      browserView.webContents.goForward();
    }
  });

  ipcMain.on('nav-refresh', () => {
    if (browserView) {
      browserView.webContents.reload();
    }
  });

  ipcMain.on('nav-to', (event, url: string) => {
    if (browserView) {
      browserView.webContents.loadURL(url);
    }
  });

  ipcMain.on('toggle-minimal', () => {
    minimalModeEnabled = !minimalModeEnabled;
    mainWindow?.webContents.send('minimal-mode-changed', minimalModeEnabled);
    if (browserView) {
      browserView.webContents.reload();
    }
  });

  // Track URL changes
  if (browserView) {
    browserView.webContents.on('did-navigate', (event, url) => {
      // Hide file:// URLs (homepage) - show empty URL bar instead
      const displayUrl = url.startsWith('file://') ? '' : url;
      mainWindow?.webContents.send('url-changed', displayUrl);
    });

    browserView.webContents.on('did-navigate-in-page', (event, url) => {
      // Hide file:// URLs (homepage) - show empty URL bar instead
      const displayUrl = url.startsWith('file://') ? '' : url;
      mainWindow?.webContents.send('url-changed', displayUrl);
    });
  }

  // Open DevTools only when explicitly requested
  if (process.env.BORING_DEVTOOLS === '1') {
    browserView.webContents.openDevTools({ mode: 'detach' });
  }

  // Forward console logs from BrowserView to terminal
  browserView.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[BrowserView Console] ${message}`);
  });

  // Log preload errors
  browserView.webContents.on('preload-error', (event, preloadPath, error) => {
    console.error('[Preload Error]', preloadPath, error);
  });

  // Keyboard shortcut to toggle DevTools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.key === 'i' && input.meta && input.alt)) {
      if (browserView) {
        if (browserView.webContents.isDevToolsOpened()) {
          browserView.webContents.closeDevTools();
        } else {
          browserView.webContents.openDevTools({ mode: 'detach' });
        }
      }
    }
  });

  // Load initial page (homepage)
  const homepagePath = path.join(__dirname, 'homepage.html');
  browserView.webContents.loadFile(homepagePath);

  mainWindow.on('closed', () => {
    mainWindow = null;
    browserView = null;
  });
}

function updateBrowserViewBounds() {
  if (mainWindow && browserView) {
    const bounds = mainWindow.getBounds();
    browserView.setBounds({
      x: 0,
      y: CHROME_HEIGHT,
      width: bounds.width,
      height: bounds.height - CHROME_HEIGHT
    });
  }
}

// IPC handlers for preload
ipcMain.handle(IPC_CHANNELS.GET_MINIMAL_MODE, () => {
  return minimalModeEnabled;
});

ipcMain.on(IPC_CHANNELS.GET_MINIMAL_MODE_SYNC, (event) => {
  event.returnValue = minimalModeEnabled;
});

ipcMain.on(IPC_CHANNELS.LOG, (event, ...args) => {
  console.log('[Preload]', ...args);
});

app.whenReady().then(() => {
  app.userAgentFallback = DEFAULT_USER_AGENT;
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
