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

export interface FallbackPageData {
  url: string;
}

export type TemplateId = 'list' | 'article' | 'video' | 'fallback';

export type TemplateDataMap = {
  list: ListPageData;
  article: ArticlePageData;
  video: VideoPageData;
  fallback: FallbackPageData;
};

export type TemplateResult<T extends TemplateId = TemplateId> = {
  template: T;
  data: TemplateDataMap[T];
  postRender?: () => void;
};

export function renderTemplate(result: TemplateResult): string {
  switch (result.template) {
    case 'list':
      return renderListPage(result.data);
    case 'article':
      return renderArticlePage(result.data);
    case 'video':
      return renderVideoPage(result.data);
    case 'fallback':
    default:
      return renderFallback(result.data.url);
  }
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

  const itemsHTML = data.items.map(item => {
    const imageHTML = item.image ? `
      <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" class="boring-list-image">
    ` : '';

    return `
      <li class="boring-list-item">
        <a href="${escapeHtml(item.href)}" class="boring-list-link">
          ${imageHTML}
          <span class="boring-list-title">${escapeHtml(item.title)}</span>
        </a>
      </li>
    `;
  }).join('');

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
  return `
    <div class="boring-container boring-video-only">
      <div class="boring-header">
        <button class="boring-back-btn" data-action="back">← Back</button>
        <div class="boring-header-actions">
          <span class="boring-mode-label">${data.modeLabel || 'Video'}</span>
          <button class="boring-action-btn" data-action="theater">Theater</button>
          <button class="boring-action-btn" data-action="fullscreen">Fullscreen</button>
        </div>
      </div>
      <div class="boring-player-wrapper">
        ${data.playerHTML}
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
