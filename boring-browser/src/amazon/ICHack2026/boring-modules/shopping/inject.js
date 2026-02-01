/**
 * Shopping Sites Boring Mode Injection (ASOS, Zara, Shopify)
 * Morphs shopping sites into clean product grid template
 */

(function() {
  'use strict';

  console.log('[Boring Mode] Shopping module loaded');

  // Detect if we're on a product detail page
  function isProductPage() {
    const url = window.location.href;
    const pathname = window.location.pathname;

    if (url.includes('asos.com')) {
      return pathname.includes('/prd/');
    }
    if (url.includes('zara.com')) {
      return pathname.includes('/product/') || pathname.match(/\/\d+\.html/);
    }

    return false;
  }

  // Extract products from listing pages
  function extractProducts() {
    const products = [];
    const url = window.location.href;

    if (url.includes('asos.com')) {
      const productEls = document.querySelectorAll('[data-auto-id="productTile"], article');

      productEls.forEach((el, index) => {
        if (index >= 24) return; // Limit to 24 products

        const titleEl = el.querySelector('[data-auto-id="productTileDescription"], h2, h3');
        const linkEl = el.querySelector('a[href*="/prd/"]');
        const priceEl = el.querySelector('[data-auto-id="productTilePrice"], [class*="price"]');
        const brandEl = el.querySelector('[data-auto-id="productTileBrand"]');

        if (titleEl && linkEl) {
          products.push({
            title: titleEl.textContent.trim(),
            url: linkEl.href,
            price: priceEl ? priceEl.textContent.trim() : '',
            brand: brandEl ? brandEl.textContent.trim() : 'ASOS'
          });
        }
      });
    } else if (url.includes('zara.com')) {
      const productEls = document.querySelectorAll('[class*="product-grid"] li, [class*="product"] article');

      productEls.forEach((el, index) => {
        if (index >= 24) return;

        const linkEl = el.querySelector('a');
        const titleEl = el.querySelector('h2, h3, [class*="product-name"]');
        const priceEl = el.querySelector('[class*="price"]');

        if (titleEl && linkEl) {
          products.push({
            title: titleEl.textContent.trim(),
            url: linkEl.href,
            price: priceEl ? priceEl.textContent.trim() : '',
            brand: 'Zara'
          });
        }
      });
    }

    return products;
  }

  // Extract product details from product page
  function extractProductDetails() {
    const product = {
      brand: '',
      name: '',
      price: '',
      details: '',
      url: window.location.href
    };

    const url = window.location.href;

    if (url.includes('asos.com')) {
      const brandEl = document.querySelector('[class*="brand"], [data-auto-id*="brand"]');
      if (brandEl) product.brand = brandEl.textContent.trim();

      const nameEl = document.querySelector('h1, [data-auto-id*="product-title"]');
      if (nameEl) product.name = nameEl.textContent.trim();

      const priceEl = document.querySelector('[data-auto-id*="productPrice"], [class*="price"]');
      if (priceEl) product.price = priceEl.textContent.trim();

      const detailsEl = document.querySelector('[class*="product-description"], [class*="about"]');
      if (detailsEl) product.details = detailsEl.textContent.trim();

    } else if (url.includes('zara.com')) {
      product.brand = 'Zara';

      const nameEl = document.querySelector('h1, [class*="product-detail-info"] h1');
      if (nameEl) product.name = nameEl.textContent.trim();

      const priceEl = document.querySelector('[class*="price"]');
      if (priceEl) product.price = priceEl.textContent.trim();

      const detailsEl = document.querySelector('[class*="description"], [class*="product-detail-info"]');
      if (detailsEl) product.details = detailsEl.textContent.trim();
    }

    return product;
  }

  // Render product grid view
  function renderProductGrid(products) {
    const overlay = document.createElement('div');
    overlay.className = 'boring-overlay';

    const hostname = window.location.hostname;
    const siteName = hostname.includes('asos') ? 'ASOS' :
                     hostname.includes('zara') ? 'Zara' : 'Shop';

    overlay.innerHTML = `
      <div class="boring-container">
        <div class="boring-header">
          <h1 class="boring-title">${siteName}</h1>
          <p class="boring-subtitle">Clean, distraction-free shopping</p>
        </div>

        <div class="boring-grid">
          ${products.map(product => `
            <a href="${product.url}" class="boring-card">
              <div class="boring-product-brand">${escapeHtml(product.brand)}</div>
              <h3 class="boring-card-title">${escapeHtml(product.title)}</h3>
              <div class="boring-card-meta">${escapeHtml(product.price)}</div>
            </a>
          `).join('')}
        </div>

        ${products.length === 0 ? `
          <div class="boring-empty">
            <p>No products found. Try scrolling on the original page to load more content, then refresh.</p>
          </div>
        ` : ''}
      </div>
    `;

    document.body.classList.add('boring-mode-active');
    document.body.appendChild(overlay);
    console.log(`[Boring Mode] Product grid rendered (${products.length} products)`);
  }

  // Render product detail view
  function renderProductDetail(product) {
    const overlay = document.createElement('div');
    overlay.className = 'boring-overlay';
    overlay.innerHTML = `
      <div class="boring-container">
        <button class="boring-back" onclick="history.back()">
          ← Back to products
        </button>

        <div class="boring-product-detail">
          <div class="boring-product-brand">${escapeHtml(product.brand)}</div>
          <h1 class="boring-product-name">${escapeHtml(product.name)}</h1>
          <div class="boring-product-price">${escapeHtml(product.price)}</div>

          <button class="boring-button boring-button-primary" onclick="window.open('${product.url}', '_blank')">
            View on original site to purchase
          </button>

          ${product.details ? `
            <div class="boring-product-details">
              <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem; color: var(--fg);">Details</h3>
              <p style="color: var(--fg); line-height: 1.7;">${escapeHtml(product.details)}</p>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    document.body.classList.add('boring-mode-active');
    document.body.appendChild(overlay);
    console.log('[Boring Mode] Product detail rendered');
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

    if (isProductPage()) {
      // Render product detail
      console.log('[Boring Mode] Detected product page, extracting details...');
      const product = extractProductDetails();
      if (product.name) {
        renderProductDetail(product);
      } else {
        console.warn('[Boring Mode] Could not extract product details');
      }
    } else {
      // Render product grid
      console.log('[Boring Mode] Detected product listing, extracting products...');
      const products = extractProducts();
      renderProductGrid(products);
    }
  }

  // Run after page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1000));
  } else {
    setTimeout(init, 1000);
  }

  console.log('[Boring Mode] Shopping module initialized');
})();
