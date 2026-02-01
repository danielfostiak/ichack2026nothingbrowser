// UI Templates for Boring Browser

export interface ListItem {
  title: string;
  href: string;
  image?: string;
  meta?: string;
}

export interface ShoppingItem {
  title: string;
  href: string;
  price?: string;
  brand?: string;
  image?: string;
}

export interface NewsItem {
  title: string;
  href: string;
  source?: string;
  time?: string;
}

export interface ListPageData {
  title: string;
  items: ListItem[];
  modeLabel?: string;
  searchBox?: boolean;
}

export interface ShoppingPageData {
  title: string;
  items: ShoppingItem[];
  modeLabel?: string;
  searchBox?: boolean;
  checkoutUrl?: string;
}

export interface NewsPageData {
  title: string;
  items: NewsItem[];
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

export type TemplateId = 'list' | 'shopping' | 'news' | 'article' | 'video' | 'fallback';

export type TemplateDataMap = {
  list: ListPageData;
  shopping: ShoppingPageData;
  news: NewsPageData;
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
    case 'shopping':
      return renderShoppingPage(result.data);
    case 'news':
      return renderNewsPage(result.data);
    case 'article':
      return renderArticlePage(result.data);
    case 'video':
      return renderVideoPage(result.data);
    case 'fallback':
    default:
      return renderFallback(result.data.url);
  }
}

const explainButtonHTML = `
  <button class="boring-explain-btn" data-action="toggle-explain">explain</button>
`;

function renderToolbarRow(searchHTML?: string): string {
  const hasSearch = !!(searchHTML && searchHTML.trim());
  const searchWrap = hasSearch ? `
    <div class="boring-search-wrap">
      ${searchHTML}
    </div>
  ` : '<div class="boring-search-wrap"></div>';

  return `
    <div class="boring-toolbar-row${hasSearch ? '' : ' no-search'}">
      ${searchWrap}
      ${explainButtonHTML}
    </div>
  `;
}

function renderExplainPanel(): string {
  return `
    <aside class="boring-explain-panel" id="boring-explain-panel" aria-hidden="true">
      <div class="boring-explain-inner">
        <div class="boring-explain-header">
          <span class="boring-explain-title">explain</span>
          <button class="boring-explain-close" data-action="close-explain">×</button>
        </div>
        <div id="boring-explain-content" class="boring-explain-content">
          loading…
        </div>
      </div>
    </aside>
  `;
}

export function renderListPage(data: ListPageData): string {
  const searchInputHTML = data.searchBox ? `
    <input
      type="text"
      class="boring-search"
      id="boring-search-input"
      placeholder="search..."
    >
  ` : '';
  const toolbarRowHTML = renderToolbarRow(searchInputHTML);

  const itemsHTML = data.items.map(item => {
    const imageHTML = item.image ? `
      <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" class="boring-list-image">
    ` : '';
    const metaHTML = item.meta ? `
      <span class="boring-list-meta">${escapeHtml(item.meta)}</span>
    ` : '';

    return `
      <li class="boring-list-item">
        <a href="${escapeHtml(item.href)}" class="boring-list-link">
          ${imageHTML}
          <div class="boring-list-text">
            <span class="boring-list-title">${escapeHtml(item.title)}</span>
            ${metaHTML}
          </div>
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
      <h1 class="boring-title">${escapeHtml(data.title)}</h1>
      ${toolbarRowHTML}
      <ul class="boring-list">
        ${itemsHTML}
      </ul>
    </div>
    ${renderExplainPanel()}
  `;
}

export function renderShoppingPage(data: ShoppingPageData): string {
  const showSearch = data.searchBox !== false;
  const searchInputHTML = showSearch ? `
    <input
      type="text"
      class="boring-search"
      id="boring-search-input"
      placeholder="search products..."
    >
  ` : '';
  const toolbarRowHTML = renderToolbarRow(searchInputHTML);

  const itemsHTML = data.items.map(item => {
    const imageHTML = item.image ? `
      <div class="boring-shopping-image">
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}">
      </div>
    ` : '';

    const metaParts = [
      item.brand ? `<span class="boring-shopping-brand">${escapeHtml(item.brand)}</span>` : '',
      item.price ? `<span class="boring-shopping-price">${escapeHtml(item.price)}</span>` : ''
    ].filter(Boolean).join('');

    const metaHTML = metaParts ? `
      <div class="boring-shopping-meta">${metaParts}</div>
    ` : '';

    return `
      <div class="boring-shopping-card">
        ${imageHTML}
        <div class="boring-shopping-info">
          <div class="boring-shopping-title">${escapeHtml(item.title)}</div>
          ${metaHTML}
        </div>
        <button
          class="boring-shopping-add"
          data-action="add-to-basket"
          data-item-id="${escapeHtml(item.href)}"
          data-item-title="${escapeHtml(item.title)}"
          data-item-price="${escapeHtml(item.price || '')}"
          data-item-brand="${escapeHtml(item.brand || '')}"
          data-item-image="${escapeHtml(item.image || '')}"
          data-item-href="${escapeHtml(item.href)}"
        >
          add to basket
        </button>
      </div>
    `;
  }).join('');

  const emptyHTML = data.items.length === 0
    ? `<div class="boring-shopping-empty">no products found yet.</div>`
    : '';

  const checkoutUrl = data.checkoutUrl ? escapeHtml(data.checkoutUrl) : '';

  return `
    <div class="boring-container boring-shopping">
      <div class="boring-header">
        <button class="boring-back-btn" data-action="back">← back</button>
        <span class="boring-mode-label">${(data.modeLabel || 'shopping').toLowerCase()}</span>
      </div>
      <h1 class="boring-title">${escapeHtml(data.title)}</h1>
      ${toolbarRowHTML}
      <section class="boring-basket" data-checkout-url="${checkoutUrl}">
        <div class="boring-basket-header">
          <div>
            <div class="boring-basket-title">basket</div>
            <div class="boring-basket-meta">
              <span class="boring-basket-count">0</span> items ·
              <span class="boring-basket-total">—</span>
            </div>
          </div>
          <button class="boring-basket-checkout" data-action="checkout" data-checkout-url="${checkoutUrl}">
            checkout
          </button>
        </div>
        <div class="boring-basket-list"></div>
        <div class="boring-basket-empty">your basket is empty.</div>
      </section>
      <div class="boring-shopping-grid">
        ${itemsHTML}
        ${emptyHTML}
      </div>
    </div>
    ${renderExplainPanel()}
  `;
}

export function renderNewsPage(data: NewsPageData): string {
  const searchInputHTML = data.searchBox ? `
    <input
      type="text"
      class="boring-search"
      id="boring-search-input"
      placeholder="search news..."
    >
  ` : '';
  const toolbarRowHTML = renderToolbarRow(searchInputHTML);

  const itemsHTML = data.items.map(item => {
    const metaParts = [
      item.source ? escapeHtml(item.source) : '',
      item.time ? escapeHtml(item.time) : ''
    ].filter(Boolean);
    const metaText = metaParts.join(' · ');

    return `
      <li class="boring-news-item">
        <a href="${escapeHtml(item.href)}" class="boring-news-link">
          <span class="boring-news-title">${escapeHtml(item.title)}</span>
          ${metaText ? `<span class="boring-news-meta">${metaText}</span>` : ''}
        </a>
      </li>
    `;
  }).join('');

  return `
    <div class="boring-container">
      <div class="boring-header">
        <button class="boring-back-btn" data-action="back">← back</button>
        <span class="boring-mode-label">${(data.modeLabel || 'news').toLowerCase()}</span>
      </div>
      <h1 class="boring-title">${escapeHtml(data.title)}</h1>
      ${toolbarRowHTML}
      <ul class="boring-news-list">
        ${itemsHTML}
      </ul>
    </div>
    ${renderExplainPanel()}
  `;
}

export function renderArticlePage(data: ArticlePageData): string {
  const bylineHTML = data.byline ? `
    <div class="boring-byline">${escapeHtml(data.byline)}</div>
  ` : '';
  const toolbarRowHTML = renderToolbarRow('');

  return `
    <div class="boring-container">
      <div class="boring-header">
        <button class="boring-back-btn" data-action="back">← back</button>
        <span class="boring-mode-label">${(data.modeLabel || 'article view').toLowerCase()}</span>
      </div>
      <h1 class="boring-title">${escapeHtml(data.title)}</h1>
      ${toolbarRowHTML}
      ${bylineHTML}
      <div class="boring-content">
        ${data.contentHTML}
      </div>
    </div>
    ${renderExplainPanel()}
  `;
}

export function renderVideoPage(data: VideoPageData): string {
  const toolbarRowHTML = renderToolbarRow('');
  return `
    <div class="boring-container boring-video-only">
      <div class="boring-header">
        <button class="boring-back-btn" data-action="back">← back</button>
        <span class="boring-mode-label">${(data.modeLabel || 'video').toLowerCase()}</span>
      </div>
      ${toolbarRowHTML}
      <div class="boring-player-wrapper">
        ${data.playerHTML}
      </div>
    </div>
    ${renderExplainPanel()}
  `;
}

export function renderFallback(url: string): string {
  const toolbarRowHTML = renderToolbarRow('');
  return `
    <div class="boring-container">
      <div class="boring-header">
        <button class="boring-back-btn" data-action="back">← back</button>
        <span class="boring-mode-label">fallback view</span>
      </div>
      ${toolbarRowHTML}
      <div class="boring-fallback">
        <h2>minimal view not available</h2>
        <p>this page doesn't have a custom minimal view yet.</p>
        <a href="${escapeHtml(url)}" class="boring-search-btn" data-action="reload">
          reload original page
        </a>
      </div>
    </div>
    ${renderExplainPanel()}
  `;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
