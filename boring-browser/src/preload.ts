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

      if (location.hostname.includes('asos.com')) {
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    } else {
      console.log('[Boring Browser] Fast path enabled, skipping DOM wait');
    }

    if (fastPath === 'youtube-watch') {
      const selectors = ['#movie_player', 'ytd-player', '#player'];
      for (const selector of selectors) {
        const el = document.querySelector(selector) as HTMLElement | null;
        if (el && el.querySelector('video')) {
          youtubePlayer = el;
          break;
        }
      }
      (window as any).__boringYouTubePlayer = youtubePlayer;
      console.log('[Boring Browser] YouTube player found:', !!youtubePlayer);
    } else {
      (window as any).__boringYouTubePlayer = null;
    }

    if (fastPath === 'youtube-list') {
      const waitForYouTubeData = async (timeoutMs = 3500, intervalMs = 50) => {
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
      if (hasData) {
        try {
          // Stop further loading once we have enough data to render.
          window.stop();
        } catch (e) {
          console.warn('[Boring Browser] Failed to stop YouTube load after data:', e);
        }
      } else {
        console.log('[Boring Browser] YouTube data not ready yet; skipping window.stop()');
      }
    }

    // Run the transformation
    console.log('[Boring Browser] Running transformation...');
    const transformResult = runTransform(location.href, document);
    console.log('[Boring Browser] Adapter result:', transformResult.template);

    const isFallbackCleanup = transformResult.template === 'fallback';
    if (isFallbackCleanup) {
      console.log('[Boring Browser] Fallback cleanup mode enabled');
      applyFallbackCleanup();

      // Mark as transformed
      hasTransformed = true;
      lastUrl = location.href;

      // Reveal the page
      console.log('[Boring Browser] Revealing page...');
      removeVeil();
      console.log('[Boring Browser] Transformation complete!');

      // Set up event handlers
      setupEventHandlers();
      setupSearchHandler();
      setupNavigationDetection();
      return;
    }

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

    const isYouTubeWatch = fastPath === 'youtube-watch';

    // Replace entire document (adapter/template-driven, single path for all sites)
    console.log('[Boring Browser] Replacing document HTML...');
    try {
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

      const forcePlayerVisible = (
        player: HTMLElement | null,
        options: { preservePosition?: boolean } = {}
      ) => {
        if (!player) return;
        if (!options.preservePosition) {
          player.style.setProperty('position', 'absolute', 'important');
          player.style.setProperty('inset', '0', 'important');
        }
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
          body.innerHTML = `${transformedHTML}`;
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

          body.innerHTML = `${transformedHTML}`;

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

      const applyYouTubeWatchMinimal = () => {
        const html = document.documentElement;
        const body = document.body;
        const head = document.head;
        if (!html || !body || !head) return;

        body.classList.add('boring-youtube-watch');

        const styleId = 'boring-youtube-watch-style';
        let style = document.getElementById(styleId) as HTMLStyleElement | null;
        if (!style) {
          style = document.createElement('style');
          style.id = styleId;
          head.appendChild(style);
        }
        style.textContent = `
          html, body {
            opacity: 1 !important;
            visibility: visible !important;
          }
          body.boring-youtube-watch {
            margin: 0 !important;
            background: #0b0b0c !important;
            color: #e8e8e8 !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          }
          ytd-masthead, #masthead-container, #related, #secondary, #comments, ytd-comments, #info, #below {
            display: none !important;
          }
          ytd-watch-flexy {
            margin: 0 !important;
            padding: 0 !important;
          }
          #primary {
            width: 100% !important;
            max-width: none !important;
          }
          #player,
          #player-container-outer,
          #player-container-inner,
          #movie_player,
          .html5-video-container,
          #movie_player video {
            width: 100% !important;
            max-width: 100% !important;
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
          #player {
            position: relative !important;
            aspect-ratio: 16 / 9;
            min-height: 240px;
          }
          #movie_player,
          .html5-video-container,
          #movie_player video {
            height: 100% !important;
          }
          #boring-youtube-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 56px;
            display: flex;
            align-items: center;
            padding: 0 16px;
            background: rgba(11, 11, 12, 0.9);
            border-bottom: 1px solid #2a2a2c;
            z-index: 999999;
            pointer-events: none;
          }
          #boring-youtube-overlay .boring-back-btn {
            pointer-events: auto;
          }
          #boring-youtube-overlay .boring-mode-label {
            pointer-events: auto;
          }
          .boring-back-btn {
            background: #1a1a1c !important;
            border: 1px solid #2a2a2c !important;
            color: #e8e8e8 !important;
            padding: 8px 16px !important;
            border-radius: 6px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            text-decoration: none !important;
            transition: background 0.2s ease !important;
          }
          .boring-back-btn:hover {
            background: #2a2a2c !important;
          }
          .boring-mode-label {
            font-size: 12px !important;
            color: #888 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.5px !important;
          }
          body.boring-youtube-watch #page-manager {
            margin-top: 56px !important;
          }

          html:fullscreen #boring-youtube-overlay,
          body:fullscreen #boring-youtube-overlay,
          html:-webkit-full-screen #boring-youtube-overlay,
          body:-webkit-full-screen #boring-youtube-overlay {
            display: none !important;
          }

          html:fullscreen #player,
          body:fullscreen #player,
          html:fullscreen #movie_player,
          body:fullscreen #movie_player,
          #player:fullscreen,
          #movie_player:fullscreen,
          html:-webkit-full-screen #player,
          body:-webkit-full-screen #player,
          html:-webkit-full-screen #movie_player,
          body:-webkit-full-screen #movie_player,
          #player:-webkit-full-screen,
          #movie_player:-webkit-full-screen {
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            max-height: 100vh !important;
            z-index: 2147483647 !important;
          }
          html:fullscreen #movie_player video,
          body:fullscreen #movie_player video,
          #movie_player:fullscreen video,
          html:-webkit-full-screen #movie_player video,
          body:-webkit-full-screen #movie_player video,
          #movie_player:-webkit-full-screen video {
            width: 100% !important;
            height: 100% !important;
          }
        `;

        const overlayId = 'boring-youtube-overlay';
        let overlay = document.getElementById(overlayId);
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.id = overlayId;
          overlay.innerHTML = `
            <button class="boring-back-btn" data-action="back">← Back</button>
            <span class="boring-mode-label" style="margin-left: 12px;">Video</span>
          `;
          body.appendChild(overlay);
        }

        const player =
          (document.getElementById('movie_player') as HTMLElement | null) ||
          (document.querySelector('ytd-player') as HTMLElement | null) ||
          (document.getElementById('player') as HTMLElement | null);
        if (player) {
          forcePlayerVisible(player, { preservePosition: true });
          const video = player.querySelector('video') as HTMLVideoElement | null;
          if (video) {
            video.style.setProperty('object-fit', 'contain', 'important');
            video.style.setProperty('background', '#000', 'important');
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
        }
      };

      function applyFallbackCleanup() {
        const html = document.documentElement;
        const body = document.body;
        const head = document.head || document.documentElement;
        if (!head) return;

        const styleId = 'boring-fallback-cleanup-style';
        let style = document.getElementById(styleId) as HTMLStyleElement | null;
        if (!style) {
          style = document.createElement('style');
          style.id = styleId;
          head.appendChild(style);
        }

        style.textContent = `
          html, body {
            overflow: auto !important;
            color-scheme: dark;
          }
          html.boring-fallback-dark {
            filter: invert(1) hue-rotate(180deg);
            background: #0b0b0c !important;
          }
          html.boring-fallback-dark img,
          html.boring-fallback-dark video,
          html.boring-fallback-dark picture,
          html.boring-fallback-dark svg,
          html.boring-fallback-dark canvas,
          html.boring-fallback-dark iframe {
            filter: invert(1) hue-rotate(180deg) !important;
          }
          body.modal-open,
          html.modal-open,
          body.no-scroll,
          html.no-scroll {
            overflow: auto !important;
          }
          [aria-modal="true"],
          [role="dialog"],
          .modal,
          .popup,
          .overlay,
          .backdrop,
          .tp-modal,
          .tp-backdrop,
          .tp-container,
          .piano,
          .paywall,
          .interstitial,
          .newsletter,
          .subscribe,
          .cookie,
          .consent,
          .gdpr,
          #qc-cmp2-container,
          .qc-cmp2-container,
          #onetrust-consent-sdk,
          .ot-sdk-container,
          .didomi,
          #didomi-notice,
          [id^="sp_message_container_"],
          .sp-message-open {
            display: none !important;
            visibility: hidden !important;
          }
          ins.adsbygoogle,
          .adsbygoogle,
          [data-ad],
          [data-ads],
          [data-ad-slot],
          [data-adunit],
          [data-testid*="ad"],
          [data-testid*="sponsor"],
          [id^="ad-"],
          [id^="ad_"],
          [id*="-ad-"],
          [id*="_ad_"],
          [class^="ad-"],
          [class^="ad_"],
          [class*=" ad-"],
          [class*=" ad_"],
          [class*=" ads-"],
          [class*=" advert"],
          [class*=" sponsor"],
          [class*=" promo"],
          [class*=" banner"],
          [class*=" outbrain"],
          [class*=" taboola"] {
            display: none !important;
          }
          iframe[src*="doubleclick"],
          iframe[src*="googlesyndication"],
          iframe[src*="adservice"],
          iframe[src*="adsystem"],
          iframe[src*="adnxs"],
          iframe[src*="taboola"],
          iframe[src*="outbrain"],
          iframe[src*="piano"],
          iframe[src*="tinypass"],
          iframe[src*="criteo"],
          iframe[src*="moatads"],
          iframe[src*="pubmatic"],
          iframe[src*="openx"] {
            display: none !important;
          }
        `;

        const cleanupOnce = () => {
          if (html) {
            html.classList.add('boring-fallback-dark');
            html.style.setProperty('overflow', 'auto', 'important');
            html.style.setProperty('position', 'static', 'important');
            html.classList.remove('modal-open', 'no-scroll', 'tp-modal-open', 'paywall-open');
          }
          if (body) {
            body.style.setProperty('overflow', 'auto', 'important');
            body.style.setProperty('position', 'static', 'important');
            body.classList.remove('modal-open', 'no-scroll', 'tp-modal-open', 'paywall-open');
          }

          const overlaySelectors = [
            '[aria-modal="true"]',
            '[role="dialog"]',
            '.modal',
            '.popup',
            '.overlay',
            '.backdrop',
            '.tp-modal',
            '.tp-backdrop',
            '.tp-container',
            '.piano',
            '.paywall',
            '.interstitial',
            '.newsletter',
            '.subscribe',
            '.cookie',
            '.consent',
            '.gdpr',
            '#qc-cmp2-container',
            '.qc-cmp2-container',
            '#onetrust-consent-sdk',
            '.ot-sdk-container',
            '.didomi',
            '#didomi-notice',
            '[id^="sp_message_container_"]'
          ];

          overlaySelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => el.remove());
          });

          document.querySelectorAll('iframe').forEach(frame => {
            const src = frame.getAttribute('src') || '';
            if (
              /doubleclick|googlesyndication|adservice|adsystem|adnxs|taboola|outbrain|piano|tinypass|criteo|moatads|pubmatic|openx/i.test(
                src
              )
            ) {
              frame.remove();
            }
          });

          const viewportArea = window.innerWidth * window.innerHeight;
          const candidates = document.querySelectorAll('body *');
          const keywordRegex =
            /(cookie|consent|subscribe|newsletter|sign up|sign in|log in|paywall|popup|overlay|modal|adblock|advert)/i;

          candidates.forEach(el => {
            const element = el as HTMLElement;
            const style = window.getComputedStyle(element);
            if (style.position !== 'fixed' && style.position !== 'sticky') return;

            const rect = element.getBoundingClientRect();
            const area = rect.width * rect.height;
            if (area < viewportArea * 0.2) return;

            const zIndex = parseInt(style.zIndex || '0', 10);
            const attributes = `${element.id} ${element.className}`.toLowerCase();
            const text = (element.textContent || '').toLowerCase();

            if (keywordRegex.test(attributes) || keywordRegex.test(text) || zIndex >= 1000) {
              element.remove();
            }
          });
        };

        cleanupOnce();

        let cleanupScheduled = false;
        const scheduleCleanup = () => {
          if (cleanupScheduled) return;
          cleanupScheduled = true;
          setTimeout(() => {
            cleanupScheduled = false;
            cleanupOnce();
          }, 120);
        };

        const observer = new MutationObserver(scheduleCleanup);
        const root = document.body || document.documentElement;
        if (root) {
          observer.observe(root, { childList: true, subtree: true });
          setTimeout(() => observer.disconnect(), 5000);
        }
      }

      if (isYouTubeWatch) {
        applyYouTubeWatchMinimal();
      } else {
        applyTemplateToDocument();
      }

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
        if (isYouTubeWatch) {
          applyYouTubeWatchMinimal();
          logRenderState('ensure-present-youtube-watch');
          ensureVisible();
          return;
        }

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

    // Populate basket UI if present
    updateBasketUI();

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
    const target = (e.target as HTMLElement | null)?.closest('[data-action]') as HTMLElement | null;
    if (!target) return;
    const action = target.getAttribute('data-action');

    if (action === 'back') {
      e.preventDefault();
      window.history.back();
    } else if (action === 'reload') {
      e.preventDefault();
      window.location.reload();
    } else if (action === 'add-to-basket') {
      e.preventDefault();
      const item = readBasketItem(target);
      if (item) {
        addToBasket(item);
      }
    } else if (action === 'remove-from-basket') {
      e.preventDefault();
      const id = target.getAttribute('data-item-id') || '';
      if (id) {
        removeFromBasket(id);
      }
    } else if (action === 'checkout') {
      e.preventDefault();
      const checkoutUrl =
        target.getAttribute('data-checkout-url') ||
        (target.closest('.boring-basket') as HTMLElement | null)?.getAttribute('data-checkout-url') ||
        `${location.origin}/bag`;
      ipcRenderer.send(IPC_CHANNELS.SET_MINIMAL_MODE, false);
      ipcRenderer.send('nav-to', checkoutUrl);
    }
  });
}

type BasketItem = {
  id: string;
  title: string;
  price?: string;
  brand?: string;
  image?: string;
  href?: string;
  quantity: number;
};

function readBasketItem(el: HTMLElement): BasketItem | null {
  const id = el.getAttribute('data-item-id') || '';
  const title = el.getAttribute('data-item-title') || '';
  if (!id || !title) return null;
  return {
    id,
    title,
    price: el.getAttribute('data-item-price') || undefined,
    brand: el.getAttribute('data-item-brand') || undefined,
    image: el.getAttribute('data-item-image') || undefined,
    href: el.getAttribute('data-item-href') || undefined,
    quantity: 1
  };
}

function getBasket(): BasketItem[] {
  try {
    const raw = window.localStorage.getItem('boring-basket');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => item && item.id && item.title);
  } catch {
    return [];
  }
}

function saveBasket(items: BasketItem[]) {
  window.localStorage.setItem('boring-basket', JSON.stringify(items));
  updateBasketUI();
}

function addToBasket(item: BasketItem) {
  const basket = getBasket();
  const existing = basket.find(entry => entry.id === item.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    basket.push(item);
  }
  saveBasket(basket);
}

function removeFromBasket(id: string) {
  const basket = getBasket();
  const index = basket.findIndex(entry => entry.id === id);
  if (index === -1) return;
  const item = basket[index];
  if (item.quantity > 1) {
    item.quantity -= 1;
  } else {
    basket.splice(index, 1);
  }
  saveBasket(basket);
}

function parsePrice(value?: string): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9.,]/g, '').trim();
  if (!cleaned) return null;
  const normalized = cleaned.includes(',') && !cleaned.includes('.')
    ? cleaned.replace(',', '.')
    : cleaned.replace(/,/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

function updateBasketUI() {
  const basket = getBasket();
  const basketEl = document.querySelector('.boring-basket') as HTMLElement | null;
  if (!basketEl) return;

  const listEl = basketEl.querySelector('.boring-basket-list') as HTMLElement | null;
  const emptyEl = basketEl.querySelector('.boring-basket-empty') as HTMLElement | null;
  const countEl = basketEl.querySelector('.boring-basket-count') as HTMLElement | null;
  const totalEl = basketEl.querySelector('.boring-basket-total') as HTMLElement | null;
  const checkoutBtn = basketEl.querySelector('.boring-basket-checkout') as HTMLButtonElement | null;

  if (countEl) {
    const count = basket.reduce((sum, item) => sum + item.quantity, 0);
    countEl.textContent = String(count);
  }

  if (totalEl) {
    const total = basket.reduce((sum, item) => {
      const price = parsePrice(item.price);
      return price ? sum + price * item.quantity : sum;
    }, 0);
    totalEl.textContent = total > 0 ? `$${total.toFixed(2)}` : '—';
  }

  if (checkoutBtn) {
    checkoutBtn.disabled = basket.length === 0;
  }

  if (!listEl) return;

  if (basket.length === 0) {
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  listEl.innerHTML = basket.map(item => {
    const meta = [item.brand, item.price].filter(Boolean).join(' · ');
    return `
      <div class="boring-basket-item">
        <div class="boring-basket-item-info">
          <div class="boring-basket-item-title">${item.title}</div>
          ${meta ? `<div class="boring-basket-item-meta">${meta}</div>` : ''}
        </div>
        <div class="boring-basket-item-actions">
          <span class="boring-basket-item-qty">x${item.quantity}</span>
          <button class="boring-basket-remove" data-action="remove-from-basket" data-item-id="${item.id}">
            Remove
          </button>
        </div>
      </div>
    `;
  }).join('');
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
