// UI Templates for Boring Browser

export interface ListItem {
  title: string;
  href: string;
  image?: string;
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
      placeholder="search..."
    >
  ` : '';

  const itemsHTML = data.items.map(item => {
    // No images for anti-dopamine minimal UI
    return `
      <li class="boring-list-item">
        <a href="${escapeHtml(item.href)}" class="boring-list-link">
          <span class="boring-list-title">${escapeHtml(item.title.toLowerCase())}</span>
        </a>
      </li>
    `;
  }).join('');

  return `
    <div class="boring-container">
      <div class="boring-header">
        <button class="boring-back-btn" data-action="back">← back</button>
        <span class="boring-mode-label">${(data.modeLabel || 'list view').toLowerCase()}</span>
      </div>
      <h1 class="boring-title">${escapeHtml(data.title.toLowerCase())}</h1>
      ${searchBoxHTML}
      <ul class="boring-list">
        ${itemsHTML}
      </ul>
    </div>
  `;
}

export function renderArticlePage(data: ArticlePageData): string {
  const bylineHTML = data.byline ? `
    <div class="boring-byline">${escapeHtml(data.byline.toLowerCase())}</div>
  ` : '';

  return `
    <div class="boring-container">
      <div class="boring-header">
        <button class="boring-back-btn" data-action="back">← back</button>
        <span class="boring-mode-label">${(data.modeLabel || 'article view').toLowerCase()}</span>
      </div>
      <h1 class="boring-title">${escapeHtml(data.title.toLowerCase())}</h1>
      ${bylineHTML}
      <div class="boring-content">
        ${data.contentHTML}
      </div>
    </div>
  `;
}

export function renderVideoPage(data: VideoPageData): string {
  const titleHTML = data.title ? `
    <h1 class="boring-video-title">${escapeHtml(data.title.toLowerCase())}</h1>
  ` : '';

  return `
    <div class="boring-container">
      <div class="boring-header">
        <button class="boring-back-btn" data-action="back">← back</button>
        <span class="boring-mode-label">${(data.modeLabel || 'video view').toLowerCase()}</span>
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
        <button class="boring-back-btn" data-action="back">← back</button>
        <span class="boring-mode-label">fallback view</span>
      </div>
      <div class="boring-fallback">
        <h2>minimal view not available</h2>
        <p>this page doesn't have a custom minimal view yet.</p>
        <a href="${escapeHtml(url)}" class="boring-search-btn" data-action="reload">
          reload original page
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
