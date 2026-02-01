import { app, BrowserWindow, BrowserView, ipcMain, WebContents } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { IPC_CHANNELS } from './ipc';

app.setName('nothing');

let mainWindow: BrowserWindow | null = null;
let minimalModeEnabled = true;
let cspStripperInstalled = false;
let ipcHandlersInstalled = false;
let chromeReady = false;

type Tab = {
  id: number;
  view: BrowserView;
  url: string;
  title: string;
  isLoading: boolean;
};

let tabs: Tab[] = [];
let activeTabId: number | null = null;
let nextTabId = 1;
const tabByWebContentsId = new Map<number, Tab>();

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const CHROME_HEIGHT = 96;

const getActiveTab = (): Tab | null => {
  if (activeTabId === null) return null;
  return tabs.find((tab) => tab.id === activeTabId) || null;
};

const getTabById = (tabId: number): Tab | null => {
  return tabs.find((tab) => tab.id === tabId) || null;
};

const getTabDisplayUrl = (tab: Tab): string => {
  if (!tab.url) return '';
  if (tab.url.startsWith('file://')) return '';
  return tab.url;
};

const truncateTabLabel = (value: string, maxLen = 26) => {
  const normalized = value.toLowerCase();
  if (normalized.length <= maxLen) return normalized;
  return normalized.slice(0, Math.max(0, maxLen - 3)).trimEnd() + '...';
};

const getYouTubeTabTitle = (parsed: URL, host: string) => {
  const path = parsed.pathname;
  if (path === '/watch' || path.startsWith('/shorts') || host === 'youtu.be') {
    return 'youtube: watch';
  }
  if (path === '/results') {
    const query = parsed.searchParams.get('search_query') || parsed.searchParams.get('q');
    return query ? `youtube: ${truncateTabLabel(query)}` : 'youtube: search';
  }
  return 'youtube';
};

const getDuckDuckGoTabTitle = (parsed: URL) => {
  const query = parsed.searchParams.get('q');
  return query ? `search: ${truncateTabLabel(query)}` : 'search';
};

const getHostBasedTitle = (parsed: URL): string | null => {
  const host = parsed.hostname.replace(/^www\./, '');

  if (host.includes('youtube.com') || host === 'youtu.be') {
    return getYouTubeTabTitle(parsed, host);
  }
  if (host.includes('bbc.co.uk') || host.includes('bbc.com')) {
    return 'bbc news';
  }
  if (host.includes('amazon.')) {
    return 'amazon';
  }
  if (host.includes('asos.com')) {
    return 'asos';
  }
  if (host.includes('duckduckgo.com')) {
    return getDuckDuckGoTabTitle(parsed);
  }
  if (host.includes('google.')) {
    return 'google';
  }

  return host || null;
};

const getTabDisplayTitle = (tab: Tab): string => {
  const url = tab.url;
  if (url.startsWith('file://')) {
    return 'new tab';
  }

  const rawTitle = tab.title.trim();
  const normalizedTitle = rawTitle.toLowerCase();
  const isGenericTitle = normalizedTitle.startsWith('boring browser');
  if (rawTitle && !isGenericTitle) {
    return normalizedTitle;
  }

  if (!url) {
    return 'new tab';
  }

  try {
    const parsed = new URL(url);
    return (getHostBasedTitle(parsed) || url).toLowerCase();
  } catch {
    return url.toLowerCase();
  }
};

const sendToChrome = (channel: string, ...args: any[]) => {
  if (!mainWindow || !chromeReady) return;
  mainWindow.webContents.send(channel, ...args);
};

const sendTabsState = () => {
  if (!mainWindow || !chromeReady) return;
  const state = {
    tabs: tabs.map((tab) => ({
      id: tab.id,
      title: getTabDisplayTitle(tab),
      url: getTabDisplayUrl(tab),
      isLoading: tab.isLoading
    })),
    activeTabId
  };
  mainWindow.webContents.send('tabs-updated', state);
};

const sendActiveUrl = () => {
  const activeTab = getActiveTab();
  sendToChrome('url-changed', activeTab ? getTabDisplayUrl(activeTab) : '');
};

const resolveTabFromSender = (sender: WebContents): Tab | null => {
  const tab = tabByWebContentsId.get(sender.id);
  return tab || getActiveTab();
};

const installCspStripper = (view: BrowserView) => {
  if (cspStripperInstalled) return;
  cspStripperInstalled = true;
  const session = view.webContents.session;
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
};

const attachTabListeners = (tab: Tab) => {
  tab.view.webContents.on('did-start-loading', () => {
    tab.isLoading = true;
    sendTabsState();
  });

  tab.view.webContents.on('did-stop-loading', () => {
    tab.isLoading = false;
    tab.title = tab.view.webContents.getTitle();
    sendTabsState();
  });

  tab.view.webContents.on('page-title-updated', (_event, title) => {
    tab.title = title;
    sendTabsState();
  });

  const handleNavigation = (url: string) => {
    tab.url = url;
    sendTabsState();
    if (tab.id === activeTabId) {
      sendActiveUrl();
    }
  };

  tab.view.webContents.on('did-navigate', (_event, url) => {
    handleNavigation(url);
  });

  tab.view.webContents.on('did-navigate-in-page', (_event, url) => {
    handleNavigation(url);
  });

  tab.view.webContents.on('console-message', (_event, _level, message) => {
    console.log(`[Tab ${tab.id} Console] ${message}`);
  });

  tab.view.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error(`[Tab ${tab.id} Preload Error]`, preloadPath, error);
  });
};

const createTab = (initialUrl?: string): Tab => {
  const view = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: false, // Must be false to manipulate page DOM
      sandbox: false,
      nodeIntegration: true // Needed for preload to use node modules
    }
  });

  installCspStripper(view);

  // Use a standard Chrome UA to avoid Google "sorry" blocks
  view.webContents.setUserAgent(DEFAULT_USER_AGENT);

  // Set dark background to prevent white flash
  view.setBackgroundColor('#0b0b0c');

  const tab: Tab = {
    id: nextTabId++,
    view,
    url: '',
    title: '',
    isLoading: false
  };

  tabByWebContentsId.set(view.webContents.id, tab);
  tabs.push(tab);

  attachTabListeners(tab);

  if (initialUrl) {
    view.webContents.loadURL(initialUrl);
  } else {
    const homepagePath = path.join(__dirname, 'homepage.html');
    view.webContents.loadFile(homepagePath);
  }

  return tab;
};

const setActiveTab = (tabId: number) => {
  if (!mainWindow) return;
  const tab = getTabById(tabId);
  if (!tab) return;
  activeTabId = tabId;
  mainWindow.setBrowserView(tab.view);
  updateBrowserViewBounds();
  tab.view.webContents.focus();
  sendTabsState();
  sendActiveUrl();
};

const closeTab = (tabId: number) => {
  const index = tabs.findIndex((tab) => tab.id === tabId);
  if (index === -1) return;

  const tab = tabs[index];
  const wasActive = tabId === activeTabId;
  const nextTabId =
    wasActive && tabs.length > 1
      ? (tabs[index - 1]?.id ?? tabs[index + 1]?.id ?? null)
      : activeTabId;

  tabs.splice(index, 1);
  tabByWebContentsId.delete(tab.view.webContents.id);

  if (wasActive) {
    if (nextTabId !== null && nextTabId !== tabId) {
      setActiveTab(nextTabId);
    } else if (tabs.length === 0) {
      const newTab = createTab();
      setActiveTab(newTab.id);
    }
  } else {
    sendTabsState();
  }

  tab.view.webContents.destroy();
};

const reloadAllTabs = () => {
  tabs.forEach((tab) => {
    tab.view.webContents.reloadIgnoringCache();
  });
};

function createWindow() {
  chromeReady = false;
  const isMac = process.platform === 'darwin';
  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: 1400,
    height: 1000,
    backgroundColor: '#0b0b0c',
    title: '',
    titleBarStyle: isMac ? 'hiddenInset' : undefined,
    trafficLightPosition: isMac ? { x: 14, y: 14 } : undefined,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  };

  mainWindow = new BrowserWindow(windowOptions);
  mainWindow.setTitle('');

  const logoCandidates = [
    path.join(__dirname, 'assets', 'logo_small.png'),
    path.join(process.cwd(), 'assets', 'logo_small.png'),
    path.join(__dirname, 'assets', 'logo.png'),
    path.join(process.cwd(), 'assets', 'logo.png')
  ];
  let logoDataUrl = '';
  for (const candidate of logoCandidates) {
    if (fs.existsSync(candidate)) {
      const buffer = fs.readFileSync(candidate);
      logoDataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
      break;
    }
  }
  const minimalToggleInner = logoDataUrl
    ? `<img src="${logoDataUrl}" alt="" aria-hidden="true">`
    : '<span class="fallback-text">minimal</span>';

  // Create the browser chrome UI
  const chromeHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title></title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; text-transform: lowercase; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background: #1a1a1c;
          color: #e0e0e0;
          height: ${CHROME_HEIGHT}px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 8px 12px;
          -webkit-app-region: drag;
          text-transform: lowercase;
        }
        input::placeholder { text-transform: lowercase; }
        input, button { text-transform: lowercase; }
        body.platform-mac .tabbar {
          padding-left: 88px;
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
          background: #f5f5f5;
          border-color: #f5f5f5;
          color: #0b0b0c;
        }
        .tabbar {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        :root {
          --tab-height: 32px;
          --control-height: 36px;
        }
        .tabs {
          display: flex;
          align-items: center;
          gap: 6px;
          flex: 0 1 auto;
          width: max-content;
          max-width: calc(100% - 52px);
          overflow-x: auto;
          padding-bottom: 2px;
        }
        .tabs::-webkit-scrollbar { display: none; }
        .tab {
          -webkit-app-region: no-drag;
          display: flex;
          align-items: center;
          gap: 8px;
          max-width: 220px;
          background: #2a2a2c;
          border: 1px solid #3a3a3c;
          color: #e0e0e0;
          height: var(--tab-height);
          padding: 0 10px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
        }
        .tab.active {
          background: #353538;
          border-color: #4a4a4c;
        }
        .tab.dragging {
          opacity: 0.5;
        }
        .tab-title {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 150px;
        }
        .tab-close {
          -webkit-app-region: no-drag;
          background: transparent;
          border: none;
          color: #aaa;
          padding: 0 4px;
          cursor: pointer;
          font-size: 12px;
          line-height: 1;
        }
        .tab-close:hover { color: #fff; }
        #new-tab {
          width: var(--tab-height);
          height: var(--tab-height);
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          position: relative;
          top: -1px;
        }
        #minimal-toggle {
          width: var(--control-height);
          height: var(--control-height);
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        #minimal-toggle img {
          width: 100%;
          height: 100%;
          max-width: none;
          object-fit: cover;
          display: block;
          filter: none;
          transform: scale(2);
          transform-origin: center;
        }
        #minimal-toggle .fallback-text {
          font-size: 11px;
          text-transform: lowercase;
        }
        #minimal-toggle.active img {
          filter: none;
        }
        .toolbar input {
          -webkit-app-region: no-drag;
          flex: 1;
          background: #2a2a2c;
          border: 1px solid #3a3a3c;
          color: #e0e0e0;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 13px;
          outline: none;
          height: var(--control-height);
        }
        .toolbar input:focus { border-color: #007acc; }
        .nav-group { display: flex; gap: 4px; }
        .toolbar {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .toolbar button {
          height: var(--control-height);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        #explain-toggle {
          width: var(--control-height);
          padding: 0;
          font-weight: 700;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="tabbar">
        <div id="tabs" class="tabs"></div>
        <button id="new-tab" title="new tab">+</button>
      </div>
      <div class="toolbar">
        <div class="nav-group">
          <button id="back" title="back">←</button>
          <button id="forward" title="forward">→</button>
          <button id="refresh" title="refresh">⟳</button>
        </div>
        <input type="text" id="url" placeholder="enter url...">
        <button id="minimal-toggle" class="active" aria-label="minimal mode" title="minimal mode">${minimalToggleInner}</button>
        <button id="explain-toggle" title="explain">?</button>
      </div>
      <script>
        const { ipcRenderer } = require('electron');

        const tabsEl = document.getElementById('tabs');
        const newTabBtn = document.getElementById('new-tab');
        const backBtn = document.getElementById('back');
        const forwardBtn = document.getElementById('forward');
        const refreshBtn = document.getElementById('refresh');
        const urlInput = document.getElementById('url');
        const minimalToggle = document.getElementById('minimal-toggle');
        const explainToggle = document.getElementById('explain-toggle');

        document.body.classList.toggle('platform-mac', process.platform === 'darwin');

        let dragTabId = null;
        let dragTabEl = null;

        const getDragAfterElement = (container, x) => {
          const draggableElements = Array.from(container.querySelectorAll('.tab:not(.dragging)'));
          let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
          draggableElements.forEach((child) => {
            const box = child.getBoundingClientRect();
            const offset = x - (box.left + box.width / 2);
            if (offset < 0 && offset > closest.offset) {
              closest = { offset, element: child };
            }
          });
          return closest.element;
        };

        const finalizeTabOrder = () => {
          if (!dragTabEl) return;
          const newOrder = Array.from(tabsEl.querySelectorAll('.tab'))
            .map(node => Number(node.getAttribute('data-tab-id')))
            .filter(id => Number.isFinite(id));
          ipcRenderer.send('tabs-reorder', newOrder);
          dragTabEl = null;
          dragTabId = null;
        };

        const renderTabs = (tabs, activeTabId) => {
          tabsEl.innerHTML = '';
          tabs.forEach(tab => {
            const tabEl = document.createElement('div');
            tabEl.className = 'tab' + (tab.id === activeTabId ? ' active' : '');
            tabEl.setAttribute('data-tab-id', String(tab.id));
            tabEl.setAttribute('draggable', 'true');

            const titleEl = document.createElement('span');
            titleEl.className = 'tab-title';
            titleEl.textContent = (tab.title || 'new tab').toLowerCase();

            const closeBtn = document.createElement('button');
            closeBtn.className = 'tab-close';
            closeBtn.textContent = '×';
            closeBtn.title = 'close tab';
            closeBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              ipcRenderer.send('tabs-close', tab.id);
            });

            tabEl.appendChild(titleEl);
            tabEl.appendChild(closeBtn);

            tabEl.addEventListener('click', () => {
              ipcRenderer.send('tabs-activate', tab.id);
            });

            tabEl.addEventListener('dragstart', (event) => {
              dragTabId = tab.id;
              dragTabEl = tabEl;
              tabEl.classList.add('dragging');
              event.dataTransfer.setData('text/plain', String(tab.id));
              event.dataTransfer.effectAllowed = 'move';
            });

            tabEl.addEventListener('dragend', () => {
              tabEl.classList.remove('dragging');
              finalizeTabOrder();
            });

            tabsEl.appendChild(tabEl);
          });
        };

        tabsEl.addEventListener('dragover', (event) => {
          if (!dragTabEl) return;
          event.preventDefault();
          const afterElement = getDragAfterElement(tabsEl, event.clientX);
          if (afterElement == null) {
            tabsEl.appendChild(dragTabEl);
          } else if (afterElement !== dragTabEl) {
            tabsEl.insertBefore(dragTabEl, afterElement);
          }
        });

        tabsEl.addEventListener('drop', (event) => {
          if (!dragTabEl) return;
          event.preventDefault();
          finalizeTabOrder();
        });

        newTabBtn.addEventListener('click', () => {
          ipcRenderer.send('tabs-new');
        });

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
        explainToggle.addEventListener('click', () => {
          ipcRenderer.send('toggle-explain');
        });

        ipcRenderer.on('tabs-updated', (event, state) => {
          if (!state || !Array.isArray(state.tabs)) return;
          renderTabs(state.tabs, state.activeTabId);
          const activeTab = state.tabs.find(tab => tab.id === state.activeTabId);
          if (activeTab && document.activeElement !== urlInput) {
            urlInput.value = activeTab.url || '';
          }
        });

        ipcRenderer.on('url-changed', (event, url) => {
          if (document.activeElement !== urlInput) {
            urlInput.value = url;
          }
        });

        ipcRenderer.on('minimal-mode-changed', (event, enabled) => {
          if (enabled) {
            minimalToggle.classList.add('active');
            minimalToggle.setAttribute('aria-label', 'minimal mode');
            minimalToggle.title = 'minimal mode';
          } else {
            minimalToggle.classList.remove('active');
            minimalToggle.setAttribute('aria-label', 'normal mode');
            minimalToggle.title = 'normal mode';
          }
        });

        ipcRenderer.send('chrome-ready');
      </script>
    </body>
    </html>
  `;

  mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(chromeHTML));

  const initialTab = createTab();
  setActiveTab(initialTab.id);

  // Handle window resize
  mainWindow.on('resize', updateBrowserViewBounds);

  // Note: We rely on preload veil + dark BrowserView background for zero-flicker
  // No CSS injection here as it interferes with minimal mode toggle

  // Navigation handlers (install once)
  if (!ipcHandlersInstalled) {
    ipcHandlersInstalled = true;

    ipcMain.on('chrome-ready', () => {
      chromeReady = true;
      sendTabsState();
      sendActiveUrl();
      sendToChrome('minimal-mode-changed', minimalModeEnabled);
    });

    ipcMain.on('tabs-new', () => {
      const tab = createTab();
      setActiveTab(tab.id);
    });

    ipcMain.on('tabs-close', (_event, tabId: number) => {
      if (typeof tabId !== 'number') return;
      closeTab(tabId);
    });

    ipcMain.on('tabs-activate', (_event, tabId: number) => {
      if (typeof tabId !== 'number') return;
      setActiveTab(tabId);
    });

    ipcMain.on('tabs-reorder', (_event, tabOrder: number[]) => {
      if (!Array.isArray(tabOrder) || tabOrder.length === 0) return;
      const orderSet = new Set(tabOrder);
      const reordered: Tab[] = [];
      tabOrder.forEach((id) => {
        const tab = getTabById(id);
        if (tab) reordered.push(tab);
      });
      tabs.forEach((tab) => {
        if (!orderSet.has(tab.id)) {
          reordered.push(tab);
        }
      });
      tabs = reordered;
      sendTabsState();
    });

    ipcMain.on('nav-back', (event) => {
      const tab = resolveTabFromSender(event.sender);
      const webContents = tab?.view.webContents;
      if (webContents?.canGoBack()) {
        webContents.goBack();
      }
    });

    ipcMain.on('nav-forward', (event) => {
      const tab = resolveTabFromSender(event.sender);
      const webContents = tab?.view.webContents;
      if (webContents?.canGoForward()) {
        webContents.goForward();
      }
    });

    ipcMain.on('nav-refresh', (event) => {
      const tab = resolveTabFromSender(event.sender);
      if (tab) {
        tab.view.webContents.reload();
      }
    });

    ipcMain.on('nav-to', (event, url: string) => {
      const normalizedUrl = url.includes('amazon.co.uk')
        ? url.replace('amazon.co.uk', 'amazon.com')
        : url;
      let tab = resolveTabFromSender(event.sender);
      if (!tab) {
        tab = createTab();
        setActiveTab(tab.id);
      }
      tab.view.webContents.loadURL(normalizedUrl);
    });

    ipcMain.on('toggle-explain', () => {
      const activeTab = getActiveTab();
      if (!activeTab) return;
      activeTab.view.webContents.executeJavaScript(`
        if (window.__boringToggleExplain) {
          window.__boringToggleExplain();
        }
      `);
    });

    ipcMain.on('toggle-minimal', () => {
      minimalModeEnabled = !minimalModeEnabled;
      sendToChrome('minimal-mode-changed', minimalModeEnabled);
      reloadAllTabs();
    });
  }

  // Open DevTools only when explicitly requested
  if (process.env.BORING_DEVTOOLS === '1') {
    const activeTab = getActiveTab();
    if (activeTab) {
      activeTab.view.webContents.openDevTools({ mode: 'detach' });
    }
  }

  // Keyboard shortcut to toggle DevTools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.key === 'i' && input.meta && input.alt)) {
      const activeTab = getActiveTab();
      if (activeTab) {
        if (activeTab.view.webContents.isDevToolsOpened()) {
          activeTab.view.webContents.closeDevTools();
        } else {
          activeTab.view.webContents.openDevTools({ mode: 'detach' });
        }
      }
    }
  });

  mainWindow.on('closed', () => {
    tabs.forEach((tab) => {
      tab.view.webContents.destroy();
    });
    tabs = [];
    activeTabId = null;
    tabByWebContentsId.clear();
    chromeReady = false;
    mainWindow = null;
  });
}

function updateBrowserViewBounds() {
  const activeTab = getActiveTab();
  if (mainWindow && activeTab) {
    const bounds = mainWindow.getBounds();
    activeTab.view.setBounds({
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

ipcMain.on(IPC_CHANNELS.SET_MINIMAL_MODE, (event, enabled: boolean) => {
  minimalModeEnabled = !!enabled;
  sendToChrome('minimal-mode-changed', minimalModeEnabled);
  reloadAllTabs();
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
