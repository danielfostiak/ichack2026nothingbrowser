(function () {
  'use strict';

  var CART_KEY   = 'boring-amazon-cart';
  var SEARCH_KEY = 'boring-amazon-last-search';
  var cart    = [];
  var origin  = '';

  // --- Cart persistence ---
  function loadCart() {
    try { cart = JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch (e) { cart = []; }
  }
  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {}
  }
  function isInCart(asin) {
    return cart.some(function (item) { return item.asin === asin; });
  }
  function addToCart(item) {
    if (!isInCart(item.asin)) { cart.push(item); saveCart(); syncUI(); }
  }
  function removeFromCart(asin) {
    cart = cart.filter(function (item) { return item.asin !== asin; });
    saveCart(); syncUI();
  }

  // --- UI sync ---
  function syncUI() {
    var badge = document.getElementById('cart-badge');
    badge.textContent = 'Basket (' + cart.length + ')';
    badge.style.display = cart.length > 0 ? 'inline-block' : 'none';

    document.querySelectorAll('.card[data-asin]').forEach(function (card) {
      var btn = card.querySelector('.add-btn');
      if (!btn) return;
      if (isInCart(card.getAttribute('data-asin'))) {
        btn.textContent = 'Added \u2713';
        btn.classList.add('added');
      } else {
        btn.textContent = 'Add to basket';
        btn.classList.remove('added');
      }
    });
  }

  // --- Helpers ---
  function escapeHtml(text) {
    var d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }

  function normalizeTitle(title) {
    if (!title) return '';
    var trimmed = String(title).replace(/\s+/g, ' ').trim();
    if (trimmed.length > 120) return trimmed.slice(0, 117) + '…';
    return trimmed;
  }

  function formatRating(rating, reviews) {
    if (!rating) return '';
    var m = rating.match(/([\d.]+)/);
    var value = m ? m[1] : rating;
    var text = value + ' \u2605';
    if (reviews) text += ' (' + reviews + ')';
    return text;
  }

  function getAsinFromUrl(url) {
    if (!url) return '';
    var m = url.match(/\/dp\/([A-Z0-9]+)/) || url.match(/\/gp\/product\/([A-Z0-9]+)/);
    return m ? m[1] : '';
  }

  // --- Rendering ---
  function renderListing(data) {
    origin = data.origin || '';
    var products = data.products || [];

    if (data.query) document.getElementById('search-input').value = data.query;

    // Remember search URL for back-navigation from product detail
    if (data.query && origin) {
      localStorage.setItem(SEARCH_KEY, origin + '/s?k=' + encodeURIComponent(data.query));
    }

    var content = document.getElementById('content');
    if (products.length === 0) {
      content.innerHTML = '<p class="empty-msg">No products found.</p>';
      syncUI();
      return;
    }

    content.innerHTML = products.map(function (p) {
      var meta = escapeHtml(p.price || '');
      var ratingText = formatRating(p.rating || '', p.reviews || '');
      if (ratingText) meta += ' &middot; ' + escapeHtml(ratingText);

      var imgHtml = p.image
        ? '<img src="' + escapeHtml(p.image) + '" class="card-image" alt="">'
        : '';
      var descHtml = p.description
        ? '<div class="card-description">' + escapeHtml(p.description) + '</div>'
        : '';

      return '<div class="card" data-asin="' + escapeHtml(p.asin) + '">' +
        imgHtml +
        '<div class="card-text">' +
          '<button class="card-title" data-url="' + escapeHtml(p.url) + '">' + escapeHtml(normalizeTitle(p.title)) + '</button>' +
          '<div class="card-meta">' + meta + '</div>' +
          descHtml +
          '<button class="add-btn' + (isInCart(p.asin) ? ' added' : '') + '">' +
            (isInCart(p.asin) ? 'Added \u2713' : 'Add to basket') +
          '</button>' +
        '</div>' +
      '</div>';
    }).join('');

    content.innerHTML = '<div class="grid">' + content.innerHTML + '</div>';

    // Bind title buttons (navigate to product page via scraping flow)
    content.querySelectorAll('.card-title[data-url]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.boringAPI.navigate(btn.getAttribute('data-url'));
      });
    });

    // Bind add-to-basket buttons
    content.querySelectorAll('.add-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.card[data-asin]');
        if (!card) return;
        var asin = card.getAttribute('data-asin');
        if (isInCart(asin)) {
          removeFromCart(asin);
        } else {
          var product = products.find(function (p) { return p.asin === asin; });
          if (product) addToCart({ asin: product.asin, title: product.title, price: product.price, url: product.url });
        }
      });
    });

    syncUI();
  }

  function renderProduct(data) {
    origin = data.origin || '';
    var p = data.product;
    var content = document.getElementById('content');

    var imgHtml = p.image
      ? '<img src="' + escapeHtml(p.image) + '" class="product-image" alt="">'
      : '';
    var ratingHtml = p.rating
      ? '<div class="product-rating">' + escapeHtml(p.rating) + '</div>'
      : '';
    var detailsHtml = '';
    if (p.details && p.details.length > 0) {
      detailsHtml = '<div class="product-details">' +
        p.details.map(function (d) { return '<p>' + escapeHtml(d) + '</p>'; }).join('') +
      '</div>';
    }

    var detailAsin = getAsinFromUrl(p.url);

    content.innerHTML =
      '<button class="back-btn" id="back-btn">\u2190 Back</button>' +
      '<div class="product-detail">' +
        imgHtml +
        '<h2 class="product-name">' + escapeHtml(normalizeTitle(p.name)) + '</h2>' +
        '<div class="product-price">' + escapeHtml(p.price) + '</div>' +
        ratingHtml +
        detailsHtml +
        '<button class="add-btn" id="detail-add-btn">' +
          (isInCart(detailAsin) ? 'Added \u2713' : 'Add to basket') +
        '</button>' +
      '</div>';

    // Back button → re-navigate to last search (goes through scraping flow)
    document.getElementById('back-btn').addEventListener('click', function () {
      var lastSearch = localStorage.getItem(SEARCH_KEY);
      if (lastSearch) window.boringAPI.navigate(lastSearch);
    });

    // Add to basket on product detail
    if (detailAsin) {
      document.getElementById('detail-add-btn').addEventListener('click', function () {
        var btn = document.getElementById('detail-add-btn');
        if (isInCart(detailAsin)) {
          removeFromCart(detailAsin);
          btn.textContent = 'Add to basket';
          btn.classList.remove('added');
        } else {
          addToCart({ asin: detailAsin, title: p.name, price: p.price, url: p.url });
          btn.textContent = 'Added \u2713';
          btn.classList.add('added');
        }
      });
    }

    syncUI();
  }

  function renderHomepage(data) {
    origin = data.origin || '';
    document.getElementById('content').innerHTML = '';
    document.getElementById('search-input').focus();
    syncUI();
  }

  function renderCart(data) {
    origin = data.origin || '';
    var items = data.items || [];
    var content = document.getElementById('content');

    if (items.length === 0) {
      content.innerHTML = '<p class="empty-msg">Your basket is empty.</p>';
      syncUI();
      return;
    }

    var header = '<div class="cart-header">' +
      '<h2>Basket</h2>' +
      '<div class="cart-actions">' +
        '<button class="checkout-btn" id="cart-checkout">Proceed to checkout</button>' +
      '</div>' +
    '</div>';

    var list = items.map(function (item) {
      var imgHtml = item.image
        ? '<img src="' + escapeHtml(item.image) + '" class="card-image" alt="">'
        : '';
      var meta = escapeHtml(item.price || '');
      if (item.quantity) meta += ' &middot; Qty ' + escapeHtml(item.quantity);

      return '<div class="card" data-asin="' + escapeHtml(item.asin) + '">' +
        imgHtml +
        '<div class="card-text">' +
          '<button class="card-title" data-url="' + escapeHtml(item.url) + '">' + escapeHtml(normalizeTitle(item.title || 'Item')) + '</button>' +
          '<div class="card-meta">' + meta + '</div>' +
          '<button class="add-btn remove-btn" data-asin="' + escapeHtml(item.asin) + '">Remove</button>' +
        '</div>' +
      '</div>';
    }).join('');

    content.innerHTML = header + '<div class="grid">' + list + '</div>';

    content.querySelectorAll('.card-title[data-url]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.boringAPI.navigate(btn.getAttribute('data-url'));
      });
    });

    document.getElementById('cart-checkout').addEventListener('click', function () {
      if (cart.length > 0) window.boringAPI.checkout(cart);
    });

    content.querySelectorAll('.remove-btn[data-asin]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var asin = btn.getAttribute('data-asin');
        if (!asin) return;
        removeFromCart(asin);
        renderCart({ origin: origin, items: cart });
      });
    });

    syncUI();
  }

  // --- Search ---
  function doSearch() {
    var q = document.getElementById('search-input').value.trim();
    if (q && origin) window.boringAPI.navigate(origin + '/s?k=' + encodeURIComponent(q));
  }
  document.getElementById('search-btn').addEventListener('click', doSearch);
  document.getElementById('search-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doSearch();
  });

  // --- Basket ---
  document.getElementById('cart-badge').addEventListener('click', function () {
    renderCart({ origin: origin, items: cart });
  });

  // --- Init ---
  loadCart();
  syncUI();

  window.boringAPI.onData(function (data) {
    if (data.type === 'listing')  renderListing(data);
    else if (data.type === 'product') renderProduct(data);
    else if (data.type === 'homepage') renderHomepage(data);
    else if (data.type === 'cart') renderCart(data);
  });
})();
