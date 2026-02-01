/**
 * Amazon extraction — executed in the hidden BrowserView via executeJavaScript.
 * Returns structured data; does NO rendering.  The result is passed to template.html.
 */
(async function () {
  var currency = window.location.hostname.includes('amazon.co.uk') ? '£' : '$';

  // --- Helpers ---

  function cleanProductUrl(href) {
    var match = href.match(/\/dp\/([A-Z0-9]+)/) || href.match(/\/gp\/product\/([A-Z0-9]+)/);
    if (match) return window.location.origin + '/dp/' + match[1];
    return href;
  }

  function readPrice(container) {
    var wholeEl = container.querySelector('.a-price .a-price-whole');
    var fracEl  = container.querySelector('.a-price .a-price-fraction');
    if (!wholeEl) return '';
    var whole = wholeEl.textContent.trim().replace(/\s+/g, '');
    whole = whole.replace(/[.,]$/, '');
    var price = currency + whole;
    if (fracEl) {
      var frac = fracEl.textContent.trim().replace(/\s+/g, '');
      if (frac) price += '.' + frac;
    }
    return price;
  }

  function readRating(container) {
    var el = container.querySelector('.a-icon-alt');
    if (!el) return '';
    var m = el.textContent.match(/([\d.]+)/);
    return m ? m[1] + ' / 5' : '';
  }

  function readReviewCount(container) {
    var el = container.querySelector(
      'a[href*="customerReviews"] .a-size-base, ' +
      'a[href*="customerReviews"] span, ' +
      '[data-component-type="s-customer-reviews"] span.a-size-base, ' +
      'span.a-size-base.s-underline-text'
    );
    if (!el) return '';
    var text = el.textContent.replace(/[\s,]/g, '').trim();
    return /\d+/.test(text) ? text : '';
  }

  function readDescription(container, titleText) {
    var spans = container.querySelectorAll('span[class*="a-size-base"]');
    for (var i = 0; i < spans.length; i++) {
      var text = spans[i].textContent.trim();
      if (text.length < 15) continue;
      if (text === titleText) continue;
      if (spans[i].closest('.a-price')) continue;
      if (spans[i].closest('[class*="a-icon"]')) continue;
      return text.length > 150 ? text.substring(0, 150) + '\u2026' : text;
    }
    return '';
  }

  function readImage(container) {
    var img = container.querySelector(
      'img[class*="s-product-image"], ' +
      '[data-component-type="s-product-image"] img, ' +
      'img[src*="images/I/"]'
    );
    if (img && img.src) return img.src;
    var imgs = container.querySelectorAll('img[src]');
    for (var i = 0; i < imgs.length; i++) {
      if (imgs[i].src.length > 50 && !imgs[i].src.includes('1x1')) return imgs[i].src;
    }
    return '';
  }

  function isSponsored(el) {
    if (!el) return false;
    if (el.getAttribute('data-component-type') === 's-sponsored-result') return true;
    if (el.querySelector('[data-component-type="sp-sponsored-result"]')) return true;
    if (el.querySelector('[aria-label*="Sponsored"], [aria-label*="sponsored"]')) return true;
    if (el.querySelector('span.s-label-popover, span.s-sponsored-label-text')) return true;
    var spans = el.querySelectorAll('span');
    for (var i = 0; i < spans.length; i++) {
      var t = spans[i].textContent.trim();
      if (t === 'Sponsored' || t === 'Sponsored product') return true;
    }
    return !!el.querySelector('[class*="sponsored"], [class*="Sponsored"]');
  }

  // --- Listing extraction ---

  function extractProducts() {
    var products = [];
    var seen = {};

    var container = document.querySelector('#search, [role="main"], #main') || document;

    function getTitleFromCard(card, linkEl) {
      var titleEl = card.querySelector(
        'h2 a span, span.a-size-medium.a-color-base.a-text-normal, ' +
        'span.a-size-base-plus.a-color-base.a-text-normal, span.a-size-base-plus, ' +
        'span.a-size-medium, span.a-text-normal'
      );
      var title = titleEl ? titleEl.textContent.trim() : '';
      if (!title && linkEl) title = linkEl.textContent.trim();
      if (!title) {
        var img = card.querySelector('img[alt]');
        if (img && img.getAttribute('alt')) title = img.getAttribute('alt').trim();
      }
      return title.replace(/\s+/g, ' ').trim();
    }

    function getLinkFromCard(card) {
      return card.querySelector('a[href*="/dp/"], a[href*="/gp/product/"]');
    }

    function addFromCard(card, linkEl) {
      if (!card) return;
      if (isSponsored(card)) return;

      var asin = card.getAttribute('data-asin');
      var href = linkEl ? linkEl.getAttribute('href') : '';
      if (!asin && href) {
        var asinMatch = href.match(/\/dp\/([A-Z0-9]+)/) || href.match(/\/gp\/product\/([A-Z0-9]+)/);
        if (asinMatch) asin = asinMatch[1];
      }

      if (!asin || seen[asin]) return;
      seen[asin] = true;

      var title = getTitleFromCard(card, linkEl);
      if (title.length < 3) return;

      var url = href ? cleanProductUrl(href) : (window.location.origin + '/dp/' + asin);
      var price = readPrice(card);
      var rating = readRating(card);
      var reviews = readReviewCount(card);

      // Skip cards that are likely sponsored/empty (no price and no rating/reviews)
      if (!price && !rating && !reviews) return;

      products.push({
        asin:        asin,
        title:       title,
        url:         url,
        price:       price,
        rating:      rating,
        reviews:     reviews,
        description: readDescription(card, title),
        image:       readImage(card)
      });
    }

    var titleLinks = container.querySelectorAll(
      'h2 a[href*="/dp/"], h2 a[href*="/gp/product/"]'
    );

    titleLinks.forEach(function (linkEl) {
      var card = linkEl.closest('[data-asin], [data-component-type="s-search-result"]');
      addFromCard(card, linkEl);
    });

    var candidates = container.querySelectorAll('[data-component-type="s-search-result"], [data-asin]');
    candidates.forEach(function (card) {
      var linkEl = getLinkFromCard(card);
      addFromCard(card, linkEl);
    });

    return products;
  }

  // --- Product detail extraction ---

  function extractProductDetails() {
    var product = {
      name:    '',
      price:   '',
      rating:  '',
      details: [],
      url:     window.location.href,
      image:   ''
    };

    var titleEl = document.querySelector('#productTitle span, #productTitle');
    if (titleEl) product.name = titleEl.textContent.trim();

    var priceContainer = document.querySelector('[data-feature-name="price"], #price_display_Amazon_Feature_Price_Desktop');
    if (priceContainer) product.price = readPrice(priceContainer);
    if (!product.price) product.price = readPrice(document);

    var ratingEl = document.querySelector('[data-hook="review-star-rating"] .a-icon-alt, #ratingValue');
    if (ratingEl) {
      var m = ratingEl.textContent.match(/([\d.]+)/);
      if (m) product.rating = m[1] + ' / 5';
    }

    document.querySelectorAll('#feature-bullets li, [data-feature-name="feature-bullets"] li').forEach(function (li) {
      if (product.details.length >= 5) return;
      var text = li.textContent.trim();
      if (text.length > 5 && !/click here/i.test(text)) product.details.push(text);
    });

    if (product.details.length === 0) {
      var descEl = document.querySelector('#productDescription span, [data-feature-name="product-description"] span');
      if (descEl) {
        var text = descEl.textContent.trim();
        if (text.length > 10) product.details.push(text.substring(0, 400));
      }
    }

    var dpMatch = product.url.match(/(https?:\/\/[^/]+\/dp\/[A-Z0-9]+)/);
    if (dpMatch) product.url = dpMatch[1];

    // Hero image
    var heroImg = document.querySelector('#landingImage, .a-img-container img[src*="images/I/"]');
    if (heroImg && heroImg.src) product.image = heroImg.src;

    return product;
  }

  // --- Cart extraction ---

  function extractCartItems() {
    var items = [];
    var seen = {};
    var cartContainers = document.querySelectorAll(
      '#sc-active-cart .sc-list-item, .sc-list-item, .sc-cart-item'
    );

    cartContainers.forEach(function (el) {
      var asin = el.getAttribute('data-asin') || '';

      var linkEl = el.querySelector('a[href*="/dp/"], a[href*="/gp/product/"]');
      var href = linkEl ? linkEl.getAttribute('href') : '';
      if (!asin && href) {
        var asinMatch = href.match(/\/dp\/([A-Z0-9]+)/) || href.match(/\/gp\/product\/([A-Z0-9]+)/);
        if (asinMatch) asin = asinMatch[1];
      }

      if (!asin || seen[asin]) return;
      seen[asin] = true;

      var titleEl = el.querySelector(
        '.sc-product-title, span.sc-product-title, .a-truncate-full, .a-truncate-cut, .a-size-medium'
      );
      var title = titleEl ? titleEl.textContent.trim() : '';
      if (!title && linkEl) title = linkEl.textContent.trim();
      title = title.replace(/\s+/g, ' ').trim();

      var priceEl = el.querySelector('.sc-price, .sc-product-price, .a-price .a-offscreen');
      var price = priceEl ? priceEl.textContent.trim() : '';

      var qty = '';
      var qtySelect = el.querySelector('select[name="quantity"], select[name="quantityBox"]');
      if (qtySelect) qty = qtySelect.value || '';
      if (!qty) {
        var qtyText = el.querySelector('.sc-quantity-text, .a-dropdown-prompt');
        if (qtyText) qty = qtyText.textContent.trim();
      }

      var imgEl = el.querySelector('img.sc-product-image, img[alt][src]');
      var image = imgEl && imgEl.src ? imgEl.src : '';

      items.push({
        asin: asin,
        title: title,
        price: price,
        quantity: qty,
        url: href ? cleanProductUrl(href) : (window.location.origin + '/dp/' + asin),
        image: image
      });
    });

    return items;
  }

  // --- Wait helpers ---
  // Amazon renders search results and product pages via JS *after* DOMContentLoaded/load.
  // Poll until the expected elements appear or a timeout is hit.

  function waitForSelector(selector, timeout) {
    return new Promise(function (resolve) {
      var deadline = Date.now() + timeout;
      (function tick() {
        if (document.querySelectorAll(selector).length > 0 || Date.now() >= deadline) {
          resolve();
        } else {
          setTimeout(tick, 250);
        }
      })();
    });
  }

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  // Scroll the page to trigger Amazon's lazy-load / infinite-scroll for additional results,
  // then wait briefly so the new cards render into the DOM.
  async function scrollAndCollect() {
    var lastHeight = 0;
    var maxScrolls = 4; // Faster: fewer scroll attempts
    var scrollCount = 0;
    var stableCount = 0; // Track how many times height hasn't changed

    while (scrollCount < maxScrolls && stableCount < 2) {
      var currentHeight = document.body.scrollHeight;

      // Early exit if we already have plenty of items
      var currentCount = extractProducts().length;
      if (currentCount >= 36) break;

      window.scrollTo(0, currentHeight);
      await sleep(350);
      window.scrollTo(0, currentHeight - 250);
      await sleep(150);
      window.scrollTo(0, document.body.scrollHeight);
      await sleep(450);

      scrollCount++;

      if (document.body.scrollHeight === lastHeight) {
        stableCount++;
      } else {
        stableCount = 0;
        lastHeight = document.body.scrollHeight;
      }
    }

    console.log('[Boring Mode] Scrolled ' + scrollCount + ' times, loaded ' +
                document.querySelectorAll('[data-component-type="s-search-result"], [data-asin], h2 a[href*="/dp/"]').length + ' potential items');
  }

  // --- Detect page type and return data ---

  var isProduct = /\/dp\/[A-Z0-9]+/.test(window.location.pathname);
  var isHome   = window.location.pathname === '/' || window.location.pathname === '';
  var isCart   = /\/cart/.test(window.location.pathname) || /\/gp\/cart/.test(window.location.pathname);

  if (isProduct) {
    // Wait for title element — signals the product page has rendered
    await waitForSelector('#productTitle', 5000);
    return { type: 'product', origin: window.location.origin, product: extractProductDetails() };
  } else if (isHome) {
    return { type: 'homepage', origin: window.location.origin };
  } else if (isCart) {
    await waitForSelector('.sc-list-item, #sc-active-cart, .sc-cart-item', 7000);
    return { type: 'cart', origin: window.location.origin, items: extractCartItems() };
  } else {
    // Wait for the first batch of search-result cards to appear
    await waitForSelector('[data-component-type="s-search-result"], [data-asin], h2 a[href*="/dp/"], span.a-size-medium.a-color-base.a-text-normal', 3500);
    // Scroll down to pull in lazy-loaded results
    await scrollAndCollect();
    // Scroll back to top so the template starts at the top
    window.scrollTo(0, 0);

    return {
      type:     'listing',
      origin:   window.location.origin,
      products: extractProducts(),
      query:    new URLSearchParams(window.location.search).get('k') || ''
    };
  }
})();
