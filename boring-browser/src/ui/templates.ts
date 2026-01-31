// UI Templates for Boring Browser

export interface ListItem {
  title: string;
  href: string;
}

export interface ListPageData {
  title: string;
  items: ListItem[];
  modeLabel?: string;
  searchBox?: boolean;
}

export interface ArticlePageData {
  title: string;
  byline?: string;
  contentHTML: string;
  modeLabel?: string;
}

export interface VideoPageData {
  title?: string;
  playerHTML: string;
  modeLabel?: string;
}

export function renderListPage(data: ListPageData): string {
  const searchBoxHTML = data.searchBox ? `
    <input
      type="text"
      class="boring-search"
      id="boring-search-input"
      placeholder="Search..."
    >
  ` : '';

  const itemsHTML = data.items.map(item => `
    <li class="boring-list-item">
      <a href="${escapeHtml(item.href)}" class="boring-list-link">
        ${escapeHtml(item.title)}
      </a>
    </li>
  `).join('');

  return `
    <div class="boring-container">
      <div class="boring-header">
        <button class="boring-back-btn" data-action="back">← Back</button>
        <span class="boring-mode-label">${data.modeLabel || 'List View'}</span>
      </div>
      <h1 class="boring-title">${escapeHtml(data.title)}</h1>
      ${searchBoxHTML}
      <ul class="boring-list">
        ${itemsHTML}
      </ul>
    </div>
  `;
}

export function renderArticlePage(data: ArticlePageData): string {
  const bylineHTML = data.byline ? `
    <div class="boring-byline">${escapeHtml(data.byline)}</div>
  ` : '';

  return `
    <div class="boring-container">
      <div class="boring-header">
        <button class="boring-back-btn" data-action="back">← Back</button>
        <span class="boring-mode-label">${data.modeLabel || 'Article View'}</span>
      </div>
      <h1 class="boring-title">${escapeHtml(data.title)}</h1>
      ${bylineHTML}
      <div class="boring-content">
        ${data.contentHTML}
      </div>
    </div>
  `;
}

export function renderVideoPage(data: VideoPageData): string {
  const titleHTML = data.title ? `
    <h1 class="boring-video-title">${escapeHtml(data.title)}</h1>
  ` : '';

  return `
    <div class="boring-container">
      <div class="boring-header">
        <button class="boring-back-btn" data-action="back">← Back</button>
        <span class="boring-mode-label">${data.modeLabel || 'Video View'}</span>
      </div>
      <div class="boring-video-container">
        ${titleHTML}
        <div class="boring-player-wrapper">
          ${data.playerHTML}
        </div>
      </div>
    </div>
  `;
}

export function renderFallback(url: string): string {
  return `
    <div class="boring-container">
      <div class="boring-header">
        <button class="boring-back-btn" data-action="back">← Back</button>
        <span class="boring-mode-label">Fallback View</span>
      </div>
      <div class="boring-fallback">
        <h2>Minimal view not available</h2>
        <p>This page doesn't have a custom minimal view yet.</p>
        <a href="${escapeHtml(url)}" class="boring-search-btn" data-action="reload">
          Reload Original Page
        </a>
      </div>
    </div>
  `;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
