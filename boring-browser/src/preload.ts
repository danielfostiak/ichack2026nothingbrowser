// Preload script - ZERO FLICKER implementation
// This runs at document_start to hide the original page immediately

const IPC_MINIMAL_MODE_SYNC = 'get-minimal-mode-sync';

// CRITICAL: Inject veil IMMEDIATELY before any imports or async code
// This MUST be the first code that runs
(function() {
  // Skip veil if minimal mode is disabled (prevents black screens in normal mode)
  try {
    const { ipcRenderer } = require('electron');
    const minimalMode = ipcRenderer.sendSync(IPC_MINIMAL_MODE_SYNC);
    if (!minimalMode) {
      console.log('[Boring Browser] Minimal mode disabled at document_start, skipping veil injection');
      return;
    }
  } catch (e) {
    // If sync IPC fails, fall back to applying veil for safety
    console.warn('[Boring Browser] Failed to check minimal mode sync, applying veil:', e);
  }

  // Skip veil entirely for local files (homepage, etc.)
  if (location.protocol === 'file:') {
    console.log('[Boring Browser] Local file detected in veil IIFE, skipping veil injection');
    return;
  }

  const isYouTube = location.hostname.includes('youtube.com') || location.hostname.includes('youtu.be');
  if (isYouTube) {
    const isWatch =
      location.pathname.includes('/watch') ||
      location.pathname.startsWith('/shorts/') ||
      location.hostname.includes('youtu.be');
    (window as any).__boringFastPath = isWatch ? 'youtube-watch' : 'youtube-list';
    // NOTE: Don't call window.stop() on watch pages; it can prevent the embed from loading.
  }


  const injectVeil = () => {
    if (!document.documentElement) {
      // Use MutationObserver for immediate detection instead of setTimeout
      const observer = new MutationObserver(() => {
        if (document.documentElement) {
          observer.disconnect();
          applyVeilStyles();
        }
      });
      // Observe the document itself
      if (document) {
        observer.observe(document, { childList: true, subtree: true });
      }
      // Also try setTimeout as backup
      setTimeout(injectVeil, 0);
      return;
    }
    applyVeilStyles();
  };

  const applyVeilStyles = () => {
    const style = document.createElement('style');
    style.id = 'boring-browser-veil';
    style.textContent = `
      * { visibility: hidden !important; }
      html, body {
        background: #0b0b0c !important;
        margin: 0 !important;
        padding: 0 !important;
      }
    `;
    // Insert at the very beginning of head or documentElement
    if (document.head) {
      document.head.insertBefore(style, document.head.firstChild);
    } else {
      document.documentElement.appendChild(style);
    }
  };

  injectVeil();
})();

import { ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './ipc';
import { runTransform } from './adapters/index';
import { renderTemplate } from './ui/templates';
import * as fs from 'fs';
import * as path from 'path';

console.log('[Boring Browser] Preload script loaded (veil already applied)!');

let hasTransformed = false;
let lastUrl = location.href;

// Main transformation function
async function performTransformation() {
  console.log('[Boring Browser] performTransformation called for:', location.href);

  // Skip transformation for local files (homepage, etc.)
  if (location.protocol === 'file:') {
    console.log('[Boring Browser] Local file detected, skipping transformation');
    removeVeil();
    return;
  }

  if (hasTransformed && location.href === lastUrl) {
    console.log('[Boring Browser] Already transformed this URL, skipping');
    return; // Already transformed this URL
  }

  try {
    // Check if minimal mode is enabled
    const minimalMode = await ipcRenderer.invoke(IPC_CHANNELS.GET_MINIMAL_MODE);
    console.log('[Boring Browser] Minimal mode enabled:', minimalMode);

    if (!minimalMode) {
      // Minimal mode disabled - show original page
      console.log('[Boring Browser] Minimal mode disabled, removing veil');
      removeVeil();
      return;
    }

    const fastPath = (window as any).__boringFastPath as string | undefined;
    let youtubePlayer: HTMLElement | null = null;

    if (fastPath !== 'youtube-watch') {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        console.log('[Boring Browser] Waiting for DOMContentLoaded...');
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve, { once: true });
        });
      }

      // Wait for dynamic content to fully load (BBC needs this)
      await new Promise(resolve => setTimeout(resolve, 300));
    } else {
      console.log('[Boring Browser] Fast path enabled, skipping DOM wait');
    }

    if (fastPath === 'youtube-watch') {
      const waitForYouTubePlayer = async (timeoutMs = 4000, intervalMs = 50) => {
        const start = Date.now();
        const selectors = ['#movie_player', 'ytd-player', '#player'];
        while (Date.now() - start < timeoutMs) {
          for (const selector of selectors) {
            const el = document.querySelector(selector) as HTMLElement | null;
            if (el && el.querySelector('video')) {
              return el;
            }
          }
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
        return null;
      };

      youtubePlayer = await waitForYouTubePlayer();
      (window as any).__boringYouTubePlayer = youtubePlayer;
      console.log('[Boring Browser] YouTube player found:', !!youtubePlayer);
    } else {
      (window as any).__boringYouTubePlayer = null;
    }

    if (fastPath === 'youtube-list') {
      const waitForYouTubeData = async (timeoutMs = 2000, intervalMs = 50) => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
          const win = document.defaultView as any;
          if (win && win.ytInitialData) return true;
          const scripts = document.querySelectorAll('script');
          for (const script of scripts) {
            const text = script.textContent || '';
            if (text.includes('ytInitialData')) return true;
          }
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
        return false;
      };

      const hasData = await waitForYouTubeData();
      console.log('[Boring Browser] YouTube initial data available:', hasData);
      try {
        // Stop further loading once we have enough data to render.
        window.stop();
      } catch (e) {
        console.warn('[Boring Browser] Failed to stop YouTube load after data:', e);
      }
    }

    // Run the transformation
    console.log('[Boring Browser] Running transformation...');
    const transformResult = runTransform(location.href, document);
    console.log('[Boring Browser] Adapter result:', transformResult.template);
    const transformedHTML = renderTemplate(transformResult);
    console.log('[Boring Browser] Transformation complete, HTML length:', transformedHTML.length);

    // Read CSS file
    const cssPath = path.join(__dirname, 'ui/styles.css');
    let cssContent = '';
    try {
      cssContent = fs.readFileSync(cssPath, 'utf-8');
    } catch (error) {
      console.warn('Could not load styles.css, using embedded styles');
      cssContent = getEmbeddedStyles();
    }

    // Replace entire document (adapter/template-driven, single path for all sites)
    console.log('[Boring Browser] Replacing document HTML...');
    try {
      const badgeHTML = `
    <div style="position: fixed; bottom: 10px; right: 10px; background: #007acc; color: white; padding: 8px 12px; border-radius: 4px; font-size: 11px; font-family: monospace; z-index: 999999;">
      ✓ Minimal Mode Active
    </div>`;

      const headMarkup = `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Boring Browser - Minimal View</title>
    <style>
      ${cssContent}
      /* Override any injected veil CSS */
      * {
        visibility: visible !important;
      }
      html, body {
        opacity: 1 !important;
        visibility: visible !important;
      }
      /* Smooth fade-in for better feel */
      body {
        animation: smoothFadeIn 0.25s ease-out;
      }
      @keyframes smoothFadeIn {
        from {
          opacity: 0;
          transform: translateY(2px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    </style>
  `;

      const forceVisible = (el: HTMLElement | null) => {
        if (!el) return;
        el.style.setProperty('display', 'block', 'important');
        el.style.setProperty('visibility', 'visible', 'important');
        el.style.setProperty('opacity', '1', 'important');
        el.style.setProperty('filter', 'none', 'important');
        el.style.setProperty('transform', 'none', 'important');
        el.style.setProperty('mix-blend-mode', 'normal', 'important');
      };

      const forcePlayerVisible = (player: HTMLElement | null) => {
        if (!player) return;
        player.style.setProperty('position', 'absolute', 'important');
        player.style.setProperty('inset', '0', 'important');
        player.style.setProperty('width', '100%', 'important');
        player.style.setProperty('height', '100%', 'important');
        player.style.setProperty('visibility', 'visible', 'important');
        player.style.setProperty('opacity', '1', 'important');
        player.style.setProperty('display', 'block', 'important');
        player.style.setProperty('transform', 'none', 'important');

        const video = player.querySelector('video') as HTMLVideoElement | null;
        if (video) {
          video.style.setProperty('width', '100%', 'important');
          video.style.setProperty('height', '100%', 'important');
          video.style.setProperty('display', 'block', 'important');
          video.style.setProperty('visibility', 'visible', 'important');
          video.style.setProperty('opacity', '1', 'important');
        }
      };

      const applyTemplateToDocument = () => {
        const preserveHead = fastPath === 'youtube-watch';
        const html = document.documentElement || document.createElement('html');
        if (!document.documentElement) {
          document.appendChild(html);
        }

        if (!preserveHead) {
          html.setAttribute('lang', 'en');
          html.className = '';
          html.removeAttribute('style');
        }

        let head = document.head;
        let body = document.body;

        if (!preserveHead) {
          head = document.createElement('head');
          body = document.createElement('body');

          // Wipe any leftover nodes/styles from the original page.
          while (html.firstChild) {
            html.removeChild(html.firstChild);
          }
          html.appendChild(head);
          html.appendChild(body);

          head.innerHTML = headMarkup;
          body.innerHTML = `${transformedHTML}${badgeHTML}`;
        } else {
          if (!head) {
            head = document.createElement('head');
            html.appendChild(head);
          }
          if (!body) {
            body = document.createElement('body');
            html.appendChild(body);
          }

          const existingStyle = head.querySelector('style[data-boring-style]') as HTMLStyleElement | null;
          if (existingStyle) {
            existingStyle.textContent = `
              ${cssContent}
              * { visibility: visible !important; }
              html, body { opacity: 1 !important; visibility: visible !important; }
            `;
          } else {
            const style = document.createElement('style');
            style.setAttribute('data-boring-style', 'true');
            style.textContent = `
              ${cssContent}
              * { visibility: visible !important; }
              html, body { opacity: 1 !important; visibility: visible !important; }
            `;
            head.appendChild(style);
          }

          const preservedPlayer = (window as any).__boringYouTubePlayer as HTMLElement | null;
          if (preservedPlayer && preservedPlayer.parentNode) {
            preservedPlayer.parentNode.removeChild(preservedPlayer);
          }

          body.innerHTML = `${transformedHTML}${badgeHTML}`;

          const slot = body.querySelector('#boring-player-slot') as HTMLElement | null;
          if (slot) {
            if (preservedPlayer) {
              slot.innerHTML = '';
              slot.appendChild(preservedPlayer);
              forcePlayerVisible(preservedPlayer);
              const video = preservedPlayer.querySelector('video') as HTMLVideoElement | null;
              if (video) {
                console.log('[Boring Browser] YouTube video stats:', {
                  readyState: video.readyState,
                  networkState: video.networkState,
                  videoWidth: video.videoWidth,
                  videoHeight: video.videoHeight,
                  clientWidth: video.clientWidth,
                  clientHeight: video.clientHeight
                });
              } else {
                console.log('[Boring Browser] YouTube video element not found in player');
              }
              console.log('[Boring Browser] YouTube player attached:', true);
            } else {
              const videoId = slot.getAttribute('data-video-id');
              if (videoId) {
                const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1&origin=https://www.youtube.com`;
                slot.innerHTML = `
                  <iframe
                    src="${embedUrl}"
                    title="YouTube video player"
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowfullscreen
                  ></iframe>
                `;
                console.log('[Boring Browser] YouTube player fallback embed used:', true);
              }
            }
          }
        }

        body.style.background = '#0b0b0c';
        body.style.color = '#e8e8e8';
        body.style.minHeight = '100vh';

        forceVisible(html as HTMLElement);
        forceVisible(body);
      };

      applyTemplateToDocument();

      const logRenderState = (stage: string) => {
        const container = document.querySelector('.boring-container') as HTMLElement | null;
        const videoOnly = document.querySelector('.boring-video-only') as HTMLElement | null;
        const hasContainer = !!container;
        const hasVideoOnly = !!videoOnly;
        const bodyLen = document.body?.innerHTML.length || 0;
        const headLen = document.head?.innerHTML.length || 0;
        const bodyStyle = document.body ? window.getComputedStyle(document.body) : null;
        const htmlStyle = document.documentElement ? window.getComputedStyle(document.documentElement) : null;
        const containerStyle = container ? window.getComputedStyle(container) : null;
        const rect = container ? container.getBoundingClientRect() : null;
        const videoRect = videoOnly ? videoOnly.getBoundingClientRect() : null;
        const payload = {
          hasContainer,
          hasVideoOnly,
          bodyLen,
          headLen,
          readyState: document.readyState,
          body: bodyStyle
            ? {
                display: bodyStyle.display,
                visibility: bodyStyle.visibility,
                opacity: bodyStyle.opacity,
                background: bodyStyle.backgroundColor,
                color: bodyStyle.color
              }
            : null,
          html: htmlStyle
            ? {
                display: htmlStyle.display,
                visibility: htmlStyle.visibility,
                opacity: htmlStyle.opacity,
                background: htmlStyle.backgroundColor
              }
            : null,
          container: containerStyle
            ? {
                display: containerStyle.display,
                visibility: containerStyle.visibility,
                opacity: containerStyle.opacity
              }
            : null,
          containerRect: rect
            ? {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
              }
            : null,
          videoRect: videoRect
            ? {
                x: Math.round(videoRect.x),
                y: Math.round(videoRect.y),
                width: Math.round(videoRect.width),
                height: Math.round(videoRect.height)
              }
            : null
        };
        console.log(`[Boring Browser] Render state (${stage}) ${JSON.stringify(payload)}`);
      };

      logRenderState('after-apply');

      const ensureVisible = () => {
        forceVisible(document.documentElement as HTMLElement);
        forceVisible(document.body);
        if (document.body) {
          document.body.style.minHeight = '100vh';
        }
      };

      const ensureTemplatePresent = () => {
        const container = document.querySelector('.boring-container') as HTMLElement | null;
        const videoOnly = document.querySelector('.boring-video-only') as HTMLElement | null;
        if (container) {
          forceVisible(container);
          logRenderState('ensure-present-hit');
          ensureVisible();
          return;
        }
        if (videoOnly) {
          forceVisible(videoOnly);
          logRenderState('ensure-present-hit-video');
          ensureVisible();
          return;
        }

        applyTemplateToDocument();
        logRenderState('ensure-present-reapply');
        ensureVisible();
      };

      // Run once now and once after the browser finishes parsing the new document.
      ensureTemplatePresent();
      setTimeout(ensureTemplatePresent, 0);
      setTimeout(() => logRenderState('post-timeout-50ms'), 50);
      setTimeout(() => logRenderState('post-timeout-250ms'), 250);
    } catch (htmlError) {
      console.error('[Boring Browser] Failed to replace document:', htmlError);
      console.error('[Boring Browser] Transformed HTML preview:', transformedHTML.substring(0, 500));
      throw htmlError; // Re-throw to be caught by outer try-catch
    }

    // Mark as transformed
    hasTransformed = true;
    lastUrl = location.href;
    console.log('[Boring Browser] Document replaced successfully');

    // Run any adapter post-render hook
    if (typeof transformResult.postRender === 'function') {
      try {
        transformResult.postRender();
      } catch (hookError) {
        console.error('[Boring Browser] Post-render hook failed:', hookError);
      }
    }

    // Reveal the page
    console.log('[Boring Browser] Revealing page...');
    removeVeil();
    console.log('[Boring Browser] Transformation complete!');

    // Set up event handlers
    setupEventHandlers();

    // Set up search handler if search box exists
    setupSearchHandler();

    // Set up SPA navigation detection
    setupNavigationDetection();

  } catch (error) {
    console.error('Transformation failed:', error);
    ipcRenderer.send(IPC_CHANNELS.LOG, 'Transformation error:', error);
    removeVeil();
  }
}

function removeVeil() {
  console.log('[Boring Browser] Removing veil...');

  const removeNow = () => {
    const veilStyle = document.getElementById('boring-browser-veil');
    if (veilStyle) {
      veilStyle.remove();
    }
  };

  // Remove immediately if present
  removeNow();

  // If the veil injects after this (race with documentElement), remove it then too.
  const root = document.documentElement || document;
  const observer = new MutationObserver(() => {
    removeNow();
  });
  observer.observe(root, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 2000);

  console.log('[Boring Browser] Veil removed!');
}

function setupEventHandlers() {
  // Handle all data-action buttons
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const action = target.getAttribute('data-action');

    if (action === 'back') {
      e.preventDefault();
      window.history.back();
    } else if (action === 'reload') {
      e.preventDefault();
      window.location.reload();
    } else if (action === 'fullscreen') {
      e.preventDefault();
      const wrapper = document.querySelector('.boring-player-wrapper') as HTMLElement | null;
      const fullscreenElement = document.fullscreenElement || (document as any).webkitFullscreenElement;

      if (fullscreenElement) {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        }
      } else if (wrapper) {
        if (wrapper.requestFullscreen) {
          wrapper.requestFullscreen();
        } else if ((wrapper as any).webkitRequestFullscreen) {
          (wrapper as any).webkitRequestFullscreen();
        }
      }
    } else if (action === 'theater') {
      e.preventDefault();
      const container = document.querySelector('.boring-video-only') as HTMLElement | null;
      if (container) {
        container.classList.toggle('theater');
      }
    }
  });
}

function setupSearchHandler() {
  const searchInput = document.getElementById('boring-search-input') as HTMLInputElement;
  if (searchInput) {
    const DEFAULT_SEARCH_URL = 'https://duckduckgo.com/html/?q=';

    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) {
          // Determine which search engine based on current URL
          const currentUrl = window.location.href;
          if (currentUrl.includes('youtube.com')) {
            window.location.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
          } else {
            // Default to DuckDuckGo (paired with adapter)
            window.location.href = `${DEFAULT_SEARCH_URL}${encodeURIComponent(query)}`;
          }
        }
      }
    });
  }
}

function setupNavigationDetection() {
  let navigationCheckInterval = (window as any).__boringNavInterval as number | undefined;
  let navigationObserver = (window as any).__boringNavObserver as MutationObserver | undefined;
  let popstateInstalled = (window as any).__boringNavPopstateInstalled as boolean | undefined;

  if (navigationCheckInterval) {
    clearInterval(navigationCheckInterval);
  }
  if (navigationObserver) {
    navigationObserver.disconnect();
  }

  // Monitor URL changes for SPA navigation (especially YouTube)
  let currentUrl = location.href;

  const checkUrlChange = () => {
    if (location.href !== currentUrl) {
      currentUrl = location.href;
      lastUrl = ''; // Reset to force re-transform
      hasTransformed = false;

      // Re-run transformation immediately (veil is already applied from navigation)
      performTransformation();
    }
  };

  // Check periodically (conservative timing for stability)
  navigationCheckInterval = window.setInterval(checkUrlChange, 500);
  (window as any).__boringNavInterval = navigationCheckInterval;

  // Also listen to popstate for back/forward
  if (!popstateInstalled) {
    window.addEventListener('popstate', () => {
      lastUrl = '';
      hasTransformed = false;
      performTransformation();
    });
    (window as any).__boringNavPopstateInstalled = true;
  }

  // MutationObserver for DOM changes that might indicate navigation
  navigationObserver = new MutationObserver(() => {
    checkUrlChange();
  });
  (window as any).__boringNavObserver = navigationObserver;

  const attachObserver = (attempts = 0) => {
    const target = document.body || document.documentElement;
    if (!target) {
      if (attempts < 20) {
        setTimeout(() => attachObserver(attempts + 1), 50);
      }
      return;
    }

    navigationObserver.observe(target, {
      childList: true,
      subtree: false
    });
  };

  attachObserver();
}

function getEmbeddedStyles(): string {
  // Fallback embedded styles in case file read fails
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { background: #0b0b0c; color: #e8e8e8; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.6;
      background: #0b0b0c;
      color: #e8e8e8;
    }
    .boring-container { max-width: 720px; margin: 0 auto; padding: 40px 20px; }
    .boring-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 32px;
      padding-bottom: 16px;
      border-bottom: 1px solid #2a2a2c;
    }
    .boring-back-btn {
      background: #1a1a1c;
      border: 1px solid #2a2a2c;
      color: #e8e8e8;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      text-decoration: none;
      transition: background 0.2s;
    }
    .boring-back-btn:hover { background: #2a2a2c; }
    .boring-mode-label {
      font-size: 12px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .boring-title {
      font-size: 32px;
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: 16px;
      color: #fff;
    }
    .boring-content {
      font-size: 17px;
      line-height: 1.7;
    }
    .boring-content p { margin-bottom: 20px; }
    .boring-content img {
      max-width: 100%;
      height: auto;
      margin: 24px 0;
      border-radius: 8px;
    }
    .boring-list { list-style: none; }
    .boring-list-item { margin-bottom: 8px; }
    .boring-list-link {
      display: block;
      padding: 16px 20px;
      background: #1a1a1c;
      border: 1px solid #2a2a2c;
      border-radius: 8px;
      color: #e8e8e8;
      text-decoration: none;
      transition: all 0.2s;
      font-size: 16px;
      line-height: 1.4;
    }
    .boring-list-link:hover {
      background: #2a2a2c;
      border-color: #3a3a3c;
      transform: translateX(4px);
    }
    .boring-search {
      width: 100%;
      padding: 12px 16px;
      background: #1a1a1c;
      border: 1px solid #2a2a2c;
      border-radius: 8px;
      color: #e8e8e8;
      font-size: 16px;
      margin-bottom: 24px;
      outline: none;
    }
    .boring-search:focus { border-color: #4a9eff; }
    .boring-player-wrapper {
      position: relative;
      width: 100%;
      background: #000;
      border-radius: 8px;
      overflow: hidden;
    }
  `;
}

// Start transformation when ready
console.log('[Boring Browser] Document ready state:', document.readyState);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[Boring Browser] DOMContentLoaded event fired');
    performTransformation();
  });
} else {
  console.log('[Boring Browser] Document already loaded, transforming immediately');
  performTransformation();
}

// Expose API globally (contextIsolation is false)
(window as any).boringBrowser = {
  getMinimalMode: () => ipcRenderer.invoke(IPC_CHANNELS.GET_MINIMAL_MODE),
  log: (...args: any[]) => ipcRenderer.send(IPC_CHANNELS.LOG, ...args)
};
