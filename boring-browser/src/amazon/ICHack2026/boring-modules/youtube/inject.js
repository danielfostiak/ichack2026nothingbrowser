/**
 * YouTube Boring Mode Injection
 * Morphs YouTube into clean video grid template
 */

(function() {
  'use strict';

  console.log('[Boring Mode] YouTube module loaded');

  let currentView = 'grid'; // 'grid' or 'player'
  let currentVideoId = null;

  // Extract video ID from URL
  function getVideoIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
  }

  // Check if we're on a watch page
  function isWatchPage() {
    return window.location.pathname === '/watch' && getVideoIdFromUrl();
  }

  // Extract videos from YouTube homepage/search
  function extractVideos() {
    const videos = [];
    const videoRenderers = document.querySelectorAll(
      'ytd-video-renderer, ytd-grid-video-renderer, ytd-playlist-video-renderer, ytd-rich-item-renderer'
    );

    videoRenderers.forEach((renderer, index) => {
      if (index >= 30) return; // Limit to 30 videos

      try {
        // Get title and link
        const titleElement = renderer.querySelector('#video-title');
        if (!titleElement) return;

        const title = titleElement.getAttribute('title') || titleElement.textContent.trim();
        const url = titleElement.getAttribute('href');
        if (!title || !url) return;

        // Get channel name
        let channel = 'Unknown Channel';
        const channelElement = renderer.querySelector(
          '#channel-name a, #text.ytd-channel-name a, ytd-channel-name a'
        );
        if (channelElement) {
          channel = channelElement.textContent.trim();
        }

        // Get metadata (views, upload time)
        let views = '';
        let uploadTime = '';
        const metadataLine = renderer.querySelector('#metadata-line');
        if (metadataLine) {
          const spans = metadataLine.querySelectorAll('span');
          if (spans[0]) views = spans[0].textContent.trim();
          if (spans[1]) uploadTime = spans[1].textContent.trim();
        }

        // Get duration
        let duration = '';
        const durationElement = renderer.querySelector(
          'ytd-thumbnail-overlay-time-status-renderer span, #text.ytd-thumbnail-overlay-time-status-renderer'
        );
        if (durationElement) {
          duration = durationElement.textContent.trim();
        }

        // Extract video ID from URL
        const videoId = url.includes('v=') ? url.split('v=')[1].split('&')[0] : url.split('/').pop();

        videos.push({
          videoId,
          title,
          url: url.startsWith('http') ? url : `https://www.youtube.com${url}`,
          channel,
          views,
          uploadTime,
          duration
        });
      } catch (e) {
        console.warn('[Boring Mode] Failed to extract video:', e);
      }
    });

    return videos;
  }

  // Extract video details from watch page
  function extractVideoDetails() {
    const video = {
      videoId: getVideoIdFromUrl(),
      title: '',
      channel: '',
      views: '',
      date: '',
      description: ''
    };

    // Title
    const titleEl = document.querySelector('h1.ytd-video-primary-info-renderer, h1.ytd-watch-metadata yt-formatted-string');
    if (titleEl) video.title = titleEl.textContent.trim();

    // Channel
    const channelEl = document.querySelector('ytd-channel-name a, #channel-name a');
    if (channelEl) video.channel = channelEl.textContent.trim();

    // Views and date
    const infoEl = document.querySelector('#info-strings, ytd-video-view-count-renderer');
    if (infoEl) {
      const text = infoEl.textContent;
      const match = text.match(/([\d,]+)\s+views/);
      if (match) video.views = match[1] + ' views';

      const dateMatch = text.match(/(\w+ \d+, \d+)/);
      if (dateMatch) video.date = dateMatch[1];
    }

    // Description
    const descEl = document.querySelector('#description-inner, ytd-text-inline-expander #content');
    if (descEl) {
      const text = descEl.textContent.trim();
      video.description = text.length > 500 ? text.substring(0, 500) + '...' : text;
    }

    return video;
  }

  // Render video player view
  function renderPlayerView(video) {
    const overlay = document.createElement('div');
    overlay.className = 'boring-overlay';
    overlay.innerHTML = `
      <div class="boring-container">
        <button class="boring-back" onclick="history.back()">
          ← Back to videos
        </button>

        <div class="boring-video-player">
          <div class="boring-video-embed">
            <iframe
              src="https://www.youtube.com/embed/${video.videoId}?autoplay=1"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
            ></iframe>
          </div>

          <div style="padding: 1.5rem 0;">
            <h1 class="boring-article-title" style="margin-bottom: 0.75rem;">${escapeHtml(video.title)}</h1>
            <div class="boring-card-meta">
              ${video.channel}
              ${video.views ? ` · ${video.views}` : ''}
              ${video.date ? ` · ${video.date}` : ''}
            </div>
            ${video.description ? `
              <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border); color: var(--fg); line-height: 1.7;">
                ${escapeHtml(video.description)}
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    document.body.classList.add('boring-mode-active');
    document.body.appendChild(overlay);
    console.log('[Boring Mode] Video player rendered');
  }

  // Render video grid view
  function renderGridView(videos) {
    const overlay = document.createElement('div');
    overlay.className = 'boring-overlay';
    overlay.innerHTML = `
      <div class="boring-container">
        <div class="boring-header">
          <h1 class="boring-title">YouTube</h1>
          <p class="boring-subtitle">No thumbnails, no recommendations, no dopamine traps</p>
        </div>

        <div class="boring-video-grid">
          ${videos.map(video => `
            <a href="${video.url}" class="boring-card">
              <h3 class="boring-card-title">${escapeHtml(video.title)}</h3>
              <div class="boring-card-meta">${escapeHtml(video.channel)}</div>
              <div class="boring-card-meta">
                ${video.views ? escapeHtml(video.views) : ''}
                ${video.views && video.uploadTime ? ' · ' : ''}
                ${video.uploadTime ? escapeHtml(video.uploadTime) : ''}
                ${(video.views || video.uploadTime) && video.duration ? ' · ' : ''}
                ${video.duration ? escapeHtml(video.duration) : ''}
              </div>
            </a>
          `).join('')}
        </div>

        ${videos.length === 0 ? `
          <div class="boring-empty">
            <p>No videos found. Try scrolling on the original page to load more content, then refresh.</p>
          </div>
        ` : ''}
      </div>
    `;

    document.body.classList.add('boring-mode-active');
    document.body.appendChild(overlay);
    console.log(`[Boring Mode] Video grid rendered (${videos.length} videos)`);
  }

  // Helper: Escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Main initialization
  function init() {
    // Remove any existing overlay
    const existingOverlay = document.querySelector('.boring-overlay');
    if (existingOverlay) existingOverlay.remove();

    if (isWatchPage()) {
      // Render video player
      console.log('[Boring Mode] Detected watch page, rendering player...');
      const video = extractVideoDetails();
      if (video.videoId) {
        renderPlayerView(video);
      } else {
        console.warn('[Boring Mode] Could not extract video ID');
      }
    } else {
      // Render video grid
      console.log('[Boring Mode] Detected YouTube homepage/search, extracting videos...');
      const videos = extractVideos();
      renderGridView(videos);
    }
  }

  // Run after page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1000));
  } else {
    setTimeout(init, 1000);
  }

  // Handle SPA navigation
  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      console.log('[Boring Mode] URL changed, reinitializing...');
      setTimeout(init, 1000);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  console.log('[Boring Mode] YouTube module initialized');
})();
