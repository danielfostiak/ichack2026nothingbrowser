import { app, BrowserWindow, BrowserView, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { IPC_CHANNELS } from './ipc';

let mainWindow: BrowserWindow | null = null;
let browserView: BrowserView | null = null;
let minimalModeEnabled = true;
let lastRealUrl: string | null = null;

type ScrapingState =
  | null
  | { phase: 'scraping'; module: string }
  | { phase: 'template'; module: string; data: any };

let scrapingState: ScrapingState = null;
let checkoutInProgress = false;
let hidePage = false;

const BORING_MODULES_DIR = path.join(__dirname, 'boring-modules');

const CHROME_HEIGHT = 60;

function getSiteModule(hostname: string): string | null {
  if (hostname.includes('amazon.co.uk') || hostname.includes('amazon.com')) return 'amazon';
  return null;
}

function hasTemplate(siteModule: string): boolean {
  return fs.existsSync(path.join(BORING_MODULES_DIR, siteModule, 'template.html'));
}

function setBrowserViewHidden(hidden: boolean) {
  if (!mainWindow || !browserView) return;
  hidePage = hidden;
  if (hidden) {
    browserView.setBounds({
      x: 0,
      y: CHROME_HEIGHT,
      width: 0,
      height: 0
    });
  } else {
    updateBrowserViewBounds();
  }
}

function maybeStartTemplateFlow(url: string): boolean {
  if (!browserView || checkoutInProgress) return false;
  try {
    const hostname = new URL(url).hostname;
    const siteModule = getSiteModule(hostname);
    if (minimalModeEnabled && siteModule && hasTemplate(siteModule)) {
      scrapingState = { phase: 'scraping', module: siteModule };
      setBrowserViewHidden(true);
      return true;
    }
  } catch {
    // Ignore invalid URLs
  }

  scrapingState = null;
  setBrowserViewHidden(false);
  return false;
}

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
          background: #3a3a3c;
          border-color: #3a3a3c;
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
        input:focus { border-color: #3a3a3c; }
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

        urlInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            let input = urlInput.value.trim();
            let url;

            // Check if it looks like a URL or a search query
            if (input.startsWith('http://') || input.startsWith('https://')) {
              // It's already a URL
              url = input;
            } else if (input.includes('.') && !input.includes(' ') && input.split('.')[1]?.length >= 2) {
              // Looks like a domain (has a dot and no spaces)
              url = 'https://' + input;
            } else {
              // Treat as search query
              url = 'https://www.google.com/search?q=' + encodeURIComponent(input);
            }

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
      maybeStartTemplateFlow(url);
      browserView.webContents.loadURL(url);
    }
  });

  ipcMain.on('boring:checkout', async (_event, items: Array<{ asin: string; url?: string }>) => {
    if (!browserView || !items || items.length === 0) return;

    const origin = items[0].url ? new URL(items[0].url).origin : 'https://www.amazon.co.uk';

    checkoutInProgress = true;
    scrapingState = null;
    setBrowserViewHidden(true);

    for (const item of items) {
      try {
        const dpUrl = item.url || origin + '/dp/' + item.asin;
        browserView.webContents.loadURL(dpUrl);
        await new Promise((resolve) => browserView?.webContents.once('did-finish-load', resolve));

        await browserView.webContents.executeJavaScript(`
          (function() {
            return new Promise(function(resolve) {
              var deadline = Date.now() + 10000;
              function findAddToCart() {
                var form = document.getElementById('add-to-cart-form');
                var btn = document.getElementById('add-to-cart') ||
                          document.getElementById('add-to-cart-button') ||
                          document.querySelector('#add-to-cart-button-ubb') ||
                          document.querySelector('input#add-to-cart-button, input#add-to-cart-button-ubb') ||
                          document.querySelector('button#add-to-cart-button, button#add-to-cart-button-ubb') ||
                          document.querySelector('input[name="submit.add-to-cart"], button[name="submit.add-to-cart"]');
                return { form: form, btn: btn };
              }
              (function tick() {
                var found = findAddToCart();
                if ((found.form || found.btn) || Date.now() >= deadline) resolve();
                else setTimeout(tick, 250);
              })();
            });
          })()
        `);

        const asin = item.asin;
        await browserView.webContents.executeJavaScript(`
          (async function() {
            function findAddToCart() {
              var form = document.getElementById('add-to-cart-form');
              var btn = document.getElementById('add-to-cart') ||
                        document.getElementById('add-to-cart-button') ||
                        document.querySelector('#add-to-cart-button-ubb') ||
                        document.querySelector('input#add-to-cart-button, input#add-to-cart-button-ubb') ||
                        document.querySelector('button#add-to-cart-button, button#add-to-cart-button-ubb') ||
                        document.querySelector('input[name="submit.add-to-cart"], button[name="submit.add-to-cart"]');
              return { form: form, btn: btn };
            }

            var found = findAddToCart();
            var form = found.form;
            var btn = found.btn;

            if (form) {
              var params = new URLSearchParams();
              form.querySelectorAll('input[name], select[name], textarea[name]').forEach(function(el) {
                if (el.type === 'checkbox' && !el.checked) return;
                if (el.type === 'radio' && !el.checked) return;
                params.append(el.name, el.value || '');
              });
              if (!params.has('ASIN')) params.set('ASIN', '${asin}');
              if (!params.has('quantity')) params.set('quantity', '1');

              var action = form.getAttribute('action') || '/gp/buy/shared/ajax/addToCart';
              await fetch(action, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString()
              });
              return 'form-submitted';
            }

            if (btn) {
              btn.click();
              return 'button-clicked';
            }

            return 'not-found';
          })()
        `);

        await new Promise((resolve) => setTimeout(resolve, 1500));
      } catch (error) {
        console.error('[Checkout] Failed for ASIN:', item.asin, error);
      }
    }

    checkoutInProgress = false;
    scrapingState = { phase: 'scraping', module: 'amazon' };
    browserView.webContents.loadURL(origin + '/cart');
  });

  ipcMain.on('toggle-minimal', () => {
    minimalModeEnabled = !minimalModeEnabled;
    mainWindow?.webContents.send('minimal-mode-changed', minimalModeEnabled);
    if (browserView) {
      if (!minimalModeEnabled) {
        scrapingState = null;
        setBrowserViewHidden(false);
        if (lastRealUrl) {
          browserView.webContents.loadURL(lastRealUrl);
          return;
        }
      } else {
        const currentUrl = browserView.webContents.getURL();
        if (currentUrl) {
          maybeStartTemplateFlow(currentUrl);
        }
      }
      browserView.webContents.reload();
    }
  });

  // Track URL changes
  if (browserView) {
    browserView.webContents.on('will-navigate', (_event, url) => {
      if (checkoutInProgress) return;
      maybeStartTemplateFlow(url);
    });

    browserView.webContents.on('did-navigate', (event, url) => {
      if (url.startsWith('http')) {
        lastRealUrl = url;
      }
      // Hide file:// URLs (homepage, templates) - show empty URL bar instead
      const displayUrl = url.startsWith('file://') ? '' : url;
      mainWindow?.webContents.send('url-changed', displayUrl);
    });

    browserView.webContents.on('did-navigate-in-page', (event, url) => {
      if (url.startsWith('http')) {
        lastRealUrl = url;
      }
      const displayUrl = url.startsWith('file://') ? '' : url;
      mainWindow?.webContents.send('url-changed', displayUrl);
    });

    browserView.webContents.on('did-finish-load', async () => {
      if (!browserView) return;
      if (checkoutInProgress) return;

      if (scrapingState && scrapingState.phase === 'scraping') {
        const mod = scrapingState.module;
        try {
          const jsPath = path.join(BORING_MODULES_DIR, mod, 'inject.js');
          const code = fs.readFileSync(jsPath, 'utf8');
          const data = await browserView.webContents.executeJavaScript(code);
          scrapingState = { phase: 'template', module: mod, data };
          setBrowserViewHidden(false);
          browserView.webContents.loadFile(
            path.join(BORING_MODULES_DIR, mod, 'template.html')
          );
        } catch (error) {
          console.error('[Boring Mode] Extraction failed:', error);
          scrapingState = null;
          setBrowserViewHidden(false);
        }
        return;
      }

      if (scrapingState && scrapingState.phase === 'template') {
        const payload = scrapingState.data || { type: 'homepage', origin: lastRealUrl || '' };
        browserView.webContents.send('boring:data', payload);
        scrapingState = null;
        setBrowserViewHidden(false);
      }
    });
  }

  // Open DevTools for debugging
  browserView.webContents.openDevTools({ mode: 'detach' });

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
    if (hidePage) {
      browserView.setBounds({
        x: 0,
        y: CHROME_HEIGHT,
        width: 0,
        height: 0
      });
      return;
    }
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

ipcMain.on(IPC_CHANNELS.LOG, (event, ...args) => {
  console.log('[Preload]', ...args);
});

app.whenReady().then(createWindow);

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
