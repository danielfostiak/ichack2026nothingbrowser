/**
 * News Sites Boring Mode Injection (BBC, The Guardian)
 * Extracts article content and morphs into clean reader template
 */

(function() {
  'use strict';

  console.log('[Boring Mode] News module loaded');

  let currentView = 'list'; // 'list' or 'article'
  let currentArticle = null;

  // Detect if we're on an article page
  function isArticlePage() {
    const url = window.location.href;
    const pathname = window.location.pathname;

    // BBC article patterns
    if (url.includes('bbc.com') || url.includes('bbc.co.uk')) {
      return pathname.includes('/article/') ||
             pathname.includes('/news/') && pathname.split('/').length > 3;
    }

    // Guardian article patterns
    if (url.includes('theguardian.com')) {
      return pathname.split('/').filter(p => p).length >= 3;
    }

    return false;
  }

  // Extract article content from BBC
  function extractBBCArticle() {
    const article = {
      title: '',
      author: '',
      source: 'BBC News',
      date: '',
      content: []
    };

    // Try multiple selectors for title
    const titleEl = document.querySelector('h1, [id*="main-heading"], [data-component="headline"]');
    if (titleEl) article.title = titleEl.textContent.trim();

    // Try to find byline/author
    const authorEl = document.querySelector('[data-component="byline"], [class*="byline"], [class*="author"]');
    if (authorEl) article.author = authorEl.textContent.trim();

    // Try to find date
    const dateEl = document.querySelector('time, [data-component="timestamp"], [class*="date"]');
    if (dateEl) article.date = dateEl.textContent.trim() || dateEl.getAttribute('datetime') || '';

    // Extract article body paragraphs
    const bodySelectors = [
      'article p',
      '[data-component="text-block"]',
      '[class*="article"] p',
      'main p',
      '[role="main"] p'
    ];

    for (const selector of bodySelectors) {
      const paragraphs = document.querySelectorAll(selector);
      if (paragraphs.length > 0) {
        paragraphs.forEach(p => {
          const text = p.textContent.trim();
          // Filter out navigation, metadata, etc (keep only substantial paragraphs)
          if (text.length > 50 && !text.startsWith('Related Topics') && !text.startsWith('Share')) {
            article.content.push(text);
          }
        });
        if (article.content.length > 0) break;
      }
    }

    return article;
  }

  // Extract article content from The Guardian
  function extractGuardianArticle() {
    const article = {
      title: '',
      author: '',
      source: 'The Guardian',
      date: '',
      content: []
    };

    // Title
    const titleEl = document.querySelector('h1, [class*="headline"]');
    if (titleEl) article.title = titleEl.textContent.trim();

    // Author
    const authorEl = document.querySelector('[rel="author"], [class*="byline"], [class*="contributor"]');
    if (authorEl) article.author = authorEl.textContent.trim();

    // Date
    const dateEl = document.querySelector('time');
    if (dateEl) article.date = dateEl.textContent.trim() || dateEl.getAttribute('datetime') || '';

    // Content
    const contentEl = document.querySelector('[class*="article-body"], [class*="content__article-body"]');
    if (contentEl) {
      const paragraphs = contentEl.querySelectorAll('p');
      paragraphs.forEach(p => {
        const text = p.textContent.trim();
        if (text.length > 50) {
          article.content.push(text);
        }
      });
    }

    return article;
  }

  // Extract list of articles from news homepage
  function extractArticleList() {
    const articles = [];
    const url = window.location.href;

    if (url.includes('bbc')) {
      // BBC News homepage
      const articleEls = document.querySelectorAll('[data-component="article-item"], [data-testid*="card"], [class*="promo"]');

      articleEls.forEach((el, index) => {
        if (index >= 20) return; // Limit to 20 articles

        const titleEl = el.querySelector('h2, h3, [class*="headline"], [class*="title"]');
        const linkEl = el.querySelector('a[href*="/news/"], a[href*="/article/"]');
        const descEl = el.querySelector('p, [class*="summary"], [class*="description"]');

        if (titleEl && linkEl) {
          articles.push({
            title: titleEl.textContent.trim(),
            url: linkEl.href,
            description: descEl ? descEl.textContent.trim() : '',
            source: 'BBC News'
          });
        }
      });
    } else if (url.includes('theguardian')) {
      // The Guardian homepage
      const articleEls = document.querySelectorAll('[data-link-name="article"], [class*="card"]');

      articleEls.forEach((el, index) => {
        if (index >= 20) return;

        const titleEl = el.querySelector('h2, h3, [class*="headline"]');
        const linkEl = el.querySelector('a');
        const descEl = el.querySelector('p');

        if (titleEl && linkEl) {
          articles.push({
            title: titleEl.textContent.trim(),
            url: linkEl.href,
            description: descEl ? descEl.textContent.trim() : '',
            source: 'The Guardian'
          });
        }
      });
    }

    return articles;
  }

  // Render article reader view
  function renderArticleView(article) {
    const overlay = document.createElement('div');
    overlay.className = 'boring-overlay';
    overlay.innerHTML = `
      <div class="boring-article">
        <button class="boring-back" onclick="history.back()">
          ← Back
        </button>

        <div class="boring-article-header">
          <h1 class="boring-article-title">${escapeHtml(article.title)}</h1>
          <div class="boring-article-meta">
            ${article.source}
            ${article.author ? ` · ${escapeHtml(article.author)}` : ''}
            ${article.date ? ` · ${escapeHtml(article.date)}` : ''}
          </div>
        </div>

        <div class="boring-article-body">
          ${article.content.map(p => `<p>${escapeHtml(p)}</p>`).join('')}
        </div>
      </div>
    `;

    document.body.classList.add('boring-mode-active');
    document.body.appendChild(overlay);
    console.log('[Boring Mode] Article view rendered');
  }

  // Render article list view
  function renderArticleList(articles) {
    const overlay = document.createElement('div');
    overlay.className = 'boring-overlay';

    const hostname = window.location.hostname;
    const siteName = hostname.includes('bbc') ? 'BBC News' :
                     hostname.includes('guardian') ? 'The Guardian' : 'News';

    overlay.innerHTML = `
      <div class="boring-container">
        <div class="boring-header">
          <h1 class="boring-title">${siteName}</h1>
          <p class="boring-subtitle">Clean, distraction-free news reading</p>
        </div>

        <div class="boring-grid">
          ${articles.map(article => `
            <a href="${article.url}" class="boring-card">
              <h3 class="boring-card-title">${escapeHtml(article.title)}</h3>
              ${article.description ? `<p class="boring-card-meta">${escapeHtml(truncate(article.description, 150))}</p>` : ''}
              <p class="boring-card-meta">${article.source}</p>
            </a>
          `).join('')}
        </div>

        ${articles.length === 0 ? `
          <div class="boring-empty">
            <p>No articles found. This might be an article page - content should appear above.</p>
          </div>
        ` : ''}
      </div>
    `;

    document.body.classList.add('boring-mode-active');
    document.body.appendChild(overlay);
    console.log(`[Boring Mode] Article list rendered (${articles.length} articles)`);
  }

  // Helper: Escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Helper: Truncate text
  function truncate(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  // Main initialization
  function init() {
    // Remove any existing overlay
    const existingOverlay = document.querySelector('.boring-overlay');
    if (existingOverlay) existingOverlay.remove();

    if (isArticlePage()) {
      // Extract and render article
      console.log('[Boring Mode] Detected article page, extracting content...');
      const url = window.location.href;
      const article = url.includes('bbc') ? extractBBCArticle() : extractGuardianArticle();

      if (article.content.length > 0) {
        renderArticleView(article);
      } else {
        console.warn('[Boring Mode] No article content extracted, showing original page');
      }
    } else {
      // Extract and render article list
      console.log('[Boring Mode] Detected news homepage, extracting article list...');
      const articles = extractArticleList();
      renderArticleList(articles);
    }
  }

  // Run after page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 500));
  } else {
    setTimeout(init, 500);
  }

  console.log('[Boring Mode] News module initialized');
})();
