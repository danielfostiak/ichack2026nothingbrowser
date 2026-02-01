const { app, BrowserWindow, BrowserView, ipcMain, session } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow = null;
let view = null;
let boringModeEnabled = true; // Boring mode on by default
let lastRealUrl = null;

// Scraping state machine for template-based sites
//   null                          – not scraping
//   { phase:'scraping', module }  – hidden view loading the real site
//   { phase:'template', module, data } – template loaded, waiting to send data
let scrapingState = null;
let checkoutInProgress = false;
// When true the next page load is hidden via opacity:0 so the real site never flashes
let hidePage = false;

// Site detection - maps hostnames to module names
function getSiteModule(hostname) {
  if (hostname.includes("youtube.com")) return "youtube";
  if (hostname.includes("bbc.com") || hostname.includes("bbc.co.uk")) return "news";
  if (hostname.includes("theguardian.com")) return "news";
  if (hostname.includes("amazon.co.uk") || hostname.includes("amazon.com")) return "amazon";
  if (hostname.includes("asos.com")) return "shopping";
  if (hostname.includes("zara.com")) return "shopping";
  return null;
}

// A site module uses the scrape+template path if it ships a template.html
function hasTemplate(siteModule) {
  return fs.existsSync(path.join(__dirname, "boring-modules", siteModule, "template.html"));
}

function openReaderWindow(article, sourceUrl) {
  const readerWin = new BrowserWindow({
    width: 900,
    height: 800,
    title: "Reader Mode",
    webPreferences: {
      preload: path.join(__dirname, "reader_preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  readerWin.loadFile(path.join(__dirname, "reader.html"));

  readerWin.webContents.once("did-finish-load", () => {
    readerWin.webContents.send("reader:article", {
      article,
      sourceUrl,
      extractedAt: new Date().toISOString()
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    title: "Anti-Dopamine Browser (Articles MVP)",
    webPreferences: {
      preload: path.join(__dirname, "ui_preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));

  // Send initial boring mode state when UI loads
  mainWindow.webContents.once("did-finish-load", () => {
    mainWindow.webContents.send("ui:boring-state", boringModeEnabled);
  });

  // Persistent storage (cookies/logins persist inside THIS app profile)
  const persistSession = session.fromPartition("persist:main");

  view = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, "view_preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      session: persistSession
    }
  });

  mainWindow.setBrowserView(view);

  // Inject opacity:0 on dom-ready so the real page never paints while we scrape / checkout.
  // dom-ready fires before paint, so the user never sees the underlying site.
  view.webContents.on("dom-ready", () => {
    if (hidePage && scrapingState && scrapingState.phase === "scraping") {
      view.webContents.insertCSS("body { opacity: 0 !important; }");
      view.webContents.executeJavaScript(`
        (function() {
          if (document.getElementById('boring-loading')) return;
          var overlay = document.createElement('div');
          overlay.id = 'boring-loading';
          overlay.style.position = 'fixed';
          overlay.style.top = '0';
          overlay.style.left = '0';
          overlay.style.right = '0';
          overlay.style.bottom = '0';
          overlay.style.background = '#111';
          overlay.style.color = '#e8e8e8';
          overlay.style.display = 'flex';
          overlay.style.alignItems = 'center';
          overlay.style.justifyContent = 'center';
          overlay.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Arial';
          overlay.style.fontSize = '16px';
          overlay.style.letterSpacing = '0.02em';
          overlay.style.zIndex = '2147483647';
          overlay.textContent = 'Loading results…';
          document.documentElement.appendChild(overlay);
        })()
      `);
    }
  });

  const resize = () => {
    if (scrapingState) return; // stay hidden while scraping
    const [w, h] = mainWindow.getContentSize();
    // Top bar in index.html is 64px tall
    view.setBounds({ x: 0, y: 64, width: w, height: h - 64 });
  };

  resize();
  mainWindow.on("resize", resize);

  // Default page
  view.webContents.loadURL("https://www.bbc.com/news");

  // Keep URL bar synced on navigation
  const sendUrlToUI = () => {
    const url = view.webContents.getURL();
    if (/^https?:\/\//i.test(url)) {
      lastRealUrl = url;
    }
    mainWindow.webContents.send("ui:url", url);
  };

  // Overlay injection for sites that do NOT have a template (YouTube, news, etc.)
  const injectBoringMode = () => {
    if (!boringModeEnabled || !view) return;

    const url = view.webContents.getURL();
    const hostname = new URL(url).hostname;

    // Inject global boring mode CSS
    const globalCSS = fs.readFileSync(path.join(__dirname, "boring-modules", "global.css"), "utf8");
    view.webContents.insertCSS(globalCSS);

    // Determine which site module to use
    const siteModule = getSiteModule(hostname);
    if (siteModule && !hasTemplate(siteModule)) {
      // Inject site-specific CSS
      const cssPath = path.join(__dirname, "boring-modules", siteModule, "style.css");
      if (fs.existsSync(cssPath)) {
        const siteCSS = fs.readFileSync(cssPath, "utf8");
        view.webContents.insertCSS(siteCSS);
      }

      // Inject site-specific JS
      const jsPath = path.join(__dirname, "boring-modules", siteModule, "inject.js");
      if (fs.existsSync(jsPath)) {
        const siteJS = fs.readFileSync(jsPath, "utf8");
        view.webContents.executeJavaScript(siteJS);
      }
    }
  };

  // --- Navigation interception ---
  // will-navigate fires for renderer-initiated navigations (link clicks).
  // For programmatic navigations (loadURL from main), we set state in the IPC handlers.
  view.webContents.on("will-navigate", (_event, url) => {
    if (checkoutInProgress) return;
    try {
      const hostname = new URL(url).hostname;
      const siteModule = getSiteModule(hostname);
      if (boringModeEnabled && siteModule && hasTemplate(siteModule)) {
        view.setBounds({ x: 0, y: 64, width: 0, height: 0 });
        hidePage = true;
        scrapingState = { phase: "scraping", module: siteModule };
        mainWindow?.webContents.send("ui:loading", true);
      } else {
        scrapingState = null;
        mainWindow?.webContents.send("ui:loading", false);
      }
    } catch (e) { /* ignore bad URLs */ }
  });

  view.webContents.on("did-navigate", sendUrlToUI);

  view.webContents.on("did-navigate-in-page", () => {
    sendUrlToUI();
    // Only overlay-inject for non-template sites; template sites are already rendered
    if (!scrapingState && !checkoutInProgress) injectBoringMode();
  });

  // Main page-load handler — drives the scrape→template state machine
  view.webContents.on("did-finish-load", async () => {
    sendUrlToUI();
    if (checkoutInProgress) return;

    // Safety: if we aren't scraping anymore, ensure the page isn't left hidden
    if (!scrapingState && hidePage) {
      hidePage = false;
    }
    if (!scrapingState) {
      mainWindow?.webContents.send("ui:loading", false);
    }

    // ── Phase 1: real site just finished loading in the hidden view ──
    if (scrapingState && scrapingState.phase === "scraping") {
      const mod = scrapingState.module;
      try {
        const code = fs.readFileSync(
          path.join(__dirname, "boring-modules", mod, "inject.js"), "utf8"
        );
        console.log("[Boring Mode] Starting extraction for:", mod);
        // executeJavaScript returns the IIFE's return value (the extracted data)
        const data = await view.webContents.executeJavaScript(code);
        console.log("[Boring Mode] Extraction complete, products:", data?.products?.length || 0);
        // Allow the template to be visible on load
        hidePage = false;
        scrapingState = { phase: "template", module: mod, data };
        view.webContents.loadFile(
          path.join(__dirname, "boring-modules", mod, "template.html")
        );
      } catch (e) {
        console.error("[Boring Mode] Extraction failed:", e);
        mainWindow?.webContents.send("ui:toast", "Extraction failed - showing real site");
        mainWindow?.webContents.send("ui:loading", false);
        scrapingState = null;
        hidePage = false;
        resize(); // show the real page as fallback
      }
      return;
    }

    // ── Phase 2: template just finished loading — send extracted data ──
    if (scrapingState && scrapingState.phase === "template") {
      hidePage = false; // reveal template (not the real page)
      view.webContents.executeJavaScript(`
        (function() {
          var overlay = document.getElementById('boring-loading');
          if (overlay) overlay.remove();
        })()
      `).catch(() => {});
      view.webContents.send("boring:data", scrapingState.data || { type: "homepage", origin: view.webContents.getURL() });
      mainWindow?.webContents.send("ui:loading", false);
      scrapingState = null;
      resize(); // reveal the template at normal size
      return;
    }

    // ── No scraping state — overlay injection for other sites ──
    injectBoringMode();
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ---- IPC from UI (address bar/buttons) ----

ipcMain.on("nav:go", (_evt, url) => {
  if (!view) return;
  try {
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;

    // Set up scraping state before loading so the view is hidden immediately
    if (!checkoutInProgress) {
      const hostname = new URL(normalized).hostname;
      const siteModule = getSiteModule(hostname);
      if (boringModeEnabled && siteModule && hasTemplate(siteModule)) {
        view.setBounds({ x: 0, y: 64, width: 0, height: 0 });
        hidePage = true;
        scrapingState = { phase: "scraping", module: siteModule };
        mainWindow?.webContents.send("ui:loading", true);
      } else {
        scrapingState = null;
        hidePage = false;
        mainWindow?.webContents.send("ui:loading", false);
        if (mainWindow) {
          const [w, h] = mainWindow.getContentSize();
          view.setBounds({ x: 0, y: 64, width: w, height: h - 64 });
        }
      }
    }

    view.webContents.loadURL(normalized);
  } catch (e) {
    console.error("Bad URL:", e);
  }
});

ipcMain.on("nav:back", () => view?.webContents.goBack());
ipcMain.on("nav:forward", () => view?.webContents.goForward());
ipcMain.on("nav:reload", () => view?.webContents.reload());

ipcMain.on("reader:extract", () => {
  if (!view) return;
  view.webContents.send("extract-article");
});

// Receive extracted article from the BrowserView preload
ipcMain.on("article-extracted", (_evt, payload) => {
  const { ok, article, error, url } = payload;

  if (!ok) {
    console.error("Extraction failed:", error);
    mainWindow?.webContents.send("ui:toast", error || "Extraction failed");
    return;
  }

  openReaderWindow(article, url);
});

// Checkout: add items to the real Amazon cart, then show the cart page
ipcMain.on("boring:checkout", async (_evt, items) => {
  if (!view || !mainWindow || !items || items.length === 0) return;

  const origin = items[0].url
    ? new URL(items[0].url).origin
    : "https://www.amazon.co.uk";

  checkoutInProgress = true;
  scrapingState = null;
  hidePage = true; // hide dp pages while we add items
  const [w, h] = mainWindow.getContentSize();
  view.setBounds({ x: 0, y: 64, width: w, height: h - 64 });

  mainWindow.webContents.send(
    "ui:toast",
    `Adding ${items.length} item${items.length > 1 ? "s" : ""} to basket…`
  );

  // For each item: load its product page so all real form tokens are present,
  // extract the add-to-cart form fields (including CSRF), and POST them.
  for (const item of items) {
    try {
      const dpUrl = item.url || origin + "/dp/" + item.asin;
      view.webContents.loadURL(dpUrl);
      await new Promise((resolve) =>
        view.webContents.once("did-finish-load", resolve)
      );

      // Amazon renders the form asynchronously — poll until it appears or timeout
      await view.webContents.executeJavaScript(`
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

      // Extract the form and submit it via fetch (cookies included automatically)
      const asin = item.asin;
      await view.webContents.executeJavaScript(`
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

      // Brief pause so Amazon processes the request before the next item
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (e) {
      console.error("[Checkout] Failed for ASIN:", item.asin, e);
    }
  }

  // Show Amazon's cart page through the template flow for a minimalist view.
  checkoutInProgress = false;
  hidePage = true;
  scrapingState = { phase: "scraping", module: "amazon" };
  view.webContents.loadURL(origin + "/cart");
});

// Toggle boring mode
ipcMain.on("boring:toggle", () => {
  boringModeEnabled = !boringModeEnabled;
  mainWindow?.webContents.send("ui:boring-state", boringModeEnabled);
  mainWindow?.webContents.send("ui:loading", false);

  // Reset scraping state so the reload picks up the new mode cleanly
  scrapingState = null;
  checkoutInProgress = false;

  if (boringModeEnabled && view) {
    // If we're currently on a template-capable site, set up scraping for the reload
    try {
      const url = view.webContents.getURL();
      const hostname = new URL(url).hostname;
      const siteModule = getSiteModule(hostname);
      if (siteModule && hasTemplate(siteModule)) {
        view.setBounds({ x: 0, y: 64, width: 0, height: 0 });
        hidePage = true;
        scrapingState = { phase: "scraping", module: siteModule };
      }
    } catch (e) { /* ignore */ }
  } else if (mainWindow && view) {
    hidePage = false;
    const [w, h] = mainWindow.getContentSize();
    view.setBounds({ x: 0, y: 64, width: w, height: h - 64 });
    if (lastRealUrl) {
      view.webContents.loadURL(lastRealUrl);
    } else {
      view?.webContents.reload();
    }
    return;
  }

  view?.webContents.reload();
});
