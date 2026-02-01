// Preload script - ZERO FLICKER implementation
// This runs at document_start to hide the original page immediately

// CRITICAL: Inject veil IMMEDIATELY before any imports or async code
// This MUST be the first code that runs
(function() {
  // Skip veil entirely for local files (homepage, etc.)
  if (location.protocol === 'file:') {
    console.log('[Boring Browser] Local file detected in veil IIFE, skipping veil injection');
    return;
  }

  // FAKE YOUTUBE IMMEDIATELY - Replace before any scripts load
  if (location.hostname.includes('youtube.com') || location.hostname.includes('youtu.be')) {
    console.log('[Boring Browser] YouTube detected - injecting fake YouTube immediately');

    // Apply immediate veil to hide YouTube while we build our fake page
    const applyYouTubeVeil = () => {
      const veilStyle = document.createElement('style');
      veilStyle.id = 'youtube-veil';
      veilStyle.textContent = `
        * { visibility: hidden !important; }
        html, body {
          background: #0b0b0c !important;
          margin: 0 !important;
          padding: 0 !important;
        }
      `;
      if (document.head) {
        document.head.appendChild(veilStyle);
      } else if (document.documentElement) {
        document.documentElement.appendChild(veilStyle);
      }
    };

    // Apply veil immediately
    applyYouTubeVeil();

    // Extract video ID if this is a watch page
    const extractYouTubeVideoId = (url: string): string | null => {
      try {
        const urlObj = new URL(url);
        // youtube.com/watch?v=VIDEO_ID
        if (urlObj.searchParams.has('v')) {
          return urlObj.searchParams.get('v');
        }
        // youtu.be/VIDEO_ID
        if (urlObj.hostname.includes('youtu.be')) {
          return urlObj.pathname.slice(1);
        }
      } catch (e) {
        console.error('[Boring Browser] Error extracting video ID:', e);
      }
      return null;
    };

    const isVideoPage = location.pathname.includes('/watch') || location.hostname.includes('youtu.be');
    const videoId = isVideoPage ? extractYouTubeVideoId(location.href) : null;

    const buildFakeYouTube = () => {
      if (!document.body) {
        setTimeout(buildFakeYouTube, 50);
        return;
      }

      if (videoId) {
        buildFakeVideoPage(videoId);
      } else {
        buildFakeHomepage();
      }
    };

    const buildFakeVideoPage = (videoId: string) => {
      console.log('[Boring Browser] Building fake video page for:', videoId);

      // CRITICAL: Stop YouTube from loading any further
      window.stop();

      // Remove the veil
      const veil = document.getElementById('youtube-veil');
      if (veil) {
        veil.remove();
      }

      if (document.head) {
        const style = document.createElement('style');
        style.textContent = `
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #0b0b0c !important;
            color: #e8e8e8;
          }
          .video-container { max-width: 1200px; margin: 0 auto; padding: 20px; }
          .video-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 20px;
            padding-bottom: 12px;
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
          }
          .boring-back-btn:hover { background: #2a2a2c; }
          .video-mode-label {
            font-size: 12px;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .video-player-wrapper {
            position: relative;
            width: 100%;
            padding-bottom: 56.25%;
            background: #000;
            border-radius: 8px;
            overflow: hidden;
            margin-bottom: 20px;
          }
          .video-player-wrapper video {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: none;
            background: #000;
          }
          .demo-badge {
            position: fixed;
            bottom: 10px;
            right: 10px;
            background: #007acc;
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 11px;
            font-family: monospace;
            z-index: 999999;
          }
        `;
        document.head.appendChild(style);
      }

      while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
      }

      const container = document.createElement('div');
      container.className = 'video-container';

      const header = document.createElement('div');
      header.className = 'video-header';

      const backBtn = document.createElement('button');
      backBtn.className = 'boring-back-btn';
      backBtn.textContent = '← back';
      backBtn.onclick = () => window.history.back();

      const modeLabel = document.createElement('span');
      modeLabel.className = 'video-mode-label';
      modeLabel.textContent = 'Video';

      header.appendChild(backBtn);
      header.appendChild(modeLabel);
      container.appendChild(header);

      const playerWrapper = document.createElement('div');
      playerWrapper.className = 'video-player-wrapper';

      // Create HTML5 video player with local video file
      const video = document.createElement('video');
      video.controls = true;
      video.autoplay = true;
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.backgroundColor = '#000';

      // Load video file as blob to avoid file:// protocol restrictions
      try {
        const fs = require('fs');
        const path = require('path');

        // Map video IDs to video files
        const videoMap: { [key: string]: string } = {
          'FAKE_VIDEO_4': 'rat.mp4',      // Rats have a slap fight
          'FAKE_VIDEO_8': 'elon.mp4',     // Elons SpaceX Tour - Offices
        };

        console.log('[Boring Browser] Video ID received:', videoId);
        console.log('[Boring Browser] Video map:', videoMap);
        console.log('[Boring Browser] Is video ID in map?:', videoId in videoMap);

        // Get video file based on URL video ID
        let videoFile = 'videoplayback.mp4'; // Default
        if (videoId && videoMap[videoId]) {
          videoFile = videoMap[videoId];
          console.log('[Boring Browser] Mapped to:', videoFile);
        } else {
          console.log('[Boring Browser] Using default:', videoFile);
        }

        console.log('[Boring Browser] Final video file to load:', videoFile);

        const videoPath = path.join(__dirname, videoFile);
        const videoBuffer = fs.readFileSync(videoPath);
        const blob = new Blob([videoBuffer], { type: 'video/mp4' });
        const blobUrl = URL.createObjectURL(blob);
        video.src = blobUrl;
        console.log('[Boring Browser] Video loaded from blob URL');
      } catch (err) {
        console.error('[Boring Browser] Failed to load video:', err);
        video.textContent = 'Failed to load video';
      }

      playerWrapper.appendChild(video);
      container.appendChild(playerWrapper);
      document.body.appendChild(container);

      const badge = document.createElement('div');
      badge.className = 'demo-badge';
      badge.textContent = '✓ demo mode active';
      document.body.appendChild(badge);

      console.log('[Boring Browser] Fake video page built!');
    };

    const buildFakeHomepage = () => {
      // CRITICAL: Stop YouTube from loading any further
      window.stop();

      // Remove the veil
      const veil = document.getElementById('youtube-veil');
      if (veil) {
        veil.remove();
      }

      if (document.head) {
        const style = document.createElement('style');
        style.textContent = `
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #0b0b0c !important;
            color: #e8e8e8;
            line-height: 1.6;
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
          .demo-badge {
            position: fixed;
            bottom: 10px;
            right: 10px;
            background: #007acc;
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 11px;
            font-family: monospace;
            z-index: 999999;
          }
        `;
        document.head.appendChild(style);
      }

      while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
      }

      const container = document.createElement('div');
      container.className = 'boring-container';

      const header = document.createElement('div');
      header.className = 'boring-header';

      const backBtn = document.createElement('button');
      backBtn.className = 'boring-back-btn';
      backBtn.textContent = '← back';
      backBtn.onclick = () => window.history.back();

      const modeLabel = document.createElement('span');
      modeLabel.className = 'boring-mode-label';
      modeLabel.textContent = 'Videos';

      header.appendChild(backBtn);
      header.appendChild(modeLabel);
      container.appendChild(header);

      const h1 = document.createElement('h1');
      h1.className = 'boring-title';
      h1.textContent = 'youtube';
      container.appendChild(h1);

      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.className = 'boring-search';
      searchInput.placeholder = 'search...';
      container.appendChild(searchInput);

      const ul = document.createElement('ul');
      ul.className = 'boring-list';

      const videos = [
    {
      title: 'The wild rise of OpenClaw...',
      href: 'https://www.youtube.com/watch?v=FAKE_VIDEO_1',
      videoFile: 'videoplayback.mp4'
    },
    {
      title: 'Top 10 Most Heated Debates of 2025 | Surrounded',
      href: 'https://www.youtube.com/watch?v=FAKE_VIDEO_2',
      videoFile: 'videoplayback.mp4'
    },
    {
      title: 'malloc, calloc, free from scratch in C',
      href: 'https://www.youtube.com/watch?v=FAKE_VIDEO_3',
      videoFile: 'videoplayback.mp4'
    },
    {
      title: 'Elons SpaceX Tour - Offices',
      href: 'https://www.youtube.com/watch?v=FAKE_VIDEO_4',
      videoFile: 'rat.mp4'
    },
    {
      title: 'Most insane poker hand ever',
      href: 'https://www.youtube.com/watch?v=FAKE_VIDEO_5',
      videoFile: 'videoplayback.mp4'
    },
    {
      title: 'Jon Jones vs Daniel Cormier | FULL FIGHT',
      href: 'https://www.youtube.com/watch?v=FAKE_VIDEO_6',
      videoFile: 'videoplayback.mp4'
    },
    {
      title: 'Entire History of London in 24 Minutes',
      href: 'https://www.youtube.com/watch?v=FAKE_VIDEO_7',
      videoFile: 'videoplayback.mp4'
    },
    {
      title: 'Me at the zoo',
      href: 'https://www.youtube.com/watch?v=FAKE_VIDEO_8',
      videoFile: 'elon.mp4'
    },
    {
      title: 'DELETED SCENES - THE INBETWEENERS MOVIE',
      href: 'https://www.youtube.com/watch?v=FAKE_VIDEO_9',
      videoFile: 'videoplayback.mp4'
    },
    {
      title: 'I thought I could code chess',
      href: 'https://www.youtube.com/watch?v=FAKE_VIDEO_10',
      videoFile: 'videoplayback.mp4'
    }
  ];

      videos.forEach(video => {
        const li = document.createElement('li');
        li.className = 'boring-list-item';

        const a = document.createElement('a');
        a.href = video.href;
        a.className = 'boring-list-link';
        a.textContent = video.title;

        li.appendChild(a);
        ul.appendChild(li);
      });

      container.appendChild(ul);
      document.body.appendChild(container);

      const badge = document.createElement('div');
      badge.className = 'demo-badge';
      badge.textContent = '✓ demo mode active';
      document.body.appendChild(badge);

      console.log('[Boring Browser] Fake homepage built!');
    };

    buildFakeYouTube();
    return;
  }

  // FAKE ASOS IMMEDIATELY - Shopping with cart functionality
  if (location.hostname.includes('asos.com')) {
    console.log('[Boring Browser] ASOS detected - injecting fake ASOS immediately');

    // Apply immediate veil to hide ASOS while we build our fake page
    const applyASOSVeil = () => {
      const veilStyle = document.createElement('style');
      veilStyle.id = 'asos-veil';
      veilStyle.textContent = `
        * { visibility: hidden !important; }
        html, body {
          background: #0b0b0c !important;
          margin: 0 !important;
          padding: 0 !important;
        }
      `;
      if (document.head) {
        document.head.appendChild(veilStyle);
      } else if (document.documentElement) {
        document.documentElement.appendChild(veilStyle);
      }
    };

    // Apply veil immediately
    applyASOSVeil();

    const buildFakeASOS = () => {
      if (!document.body) {
        setTimeout(buildFakeASOS, 50);
        return;
      }

      console.log('[Boring Browser] Building fake ASOS...');

      // CRITICAL: Stop ASOS from loading any further
      window.stop();

      // Remove the veil
      const veil = document.getElementById('asos-veil');
      if (veil) {
        veil.remove();
      }

      // Initialize cart from localStorage
      const getCart = () => {
        try {
          return JSON.parse(localStorage.getItem('asos-cart') || '[]');
        } catch {
          return [];
        }
      };

      const saveCart = (cart: any[]) => {
        localStorage.setItem('asos-cart', JSON.stringify(cart));
      };

      const addToCart = (product: any) => {
        const cart = getCart();
        const existing = cart.find((item: any) => item.id === product.id);
        if (existing) {
          existing.quantity += 1;
        } else {
          cart.push({ ...product, quantity: 1 });
        }
        saveCart(cart);
        updateCartBadge();
      };

      const updateCartBadge = () => {
        const cart = getCart();
        const total = cart.reduce((sum: number, item: any) => sum + item.quantity, 0);
        const badge = document.getElementById('cart-count');
        if (badge) {
          badge.textContent = total.toString();
        }
      };

      // Hardcoded products with actual image paths from assets folder
      const allProducts = [
        { id: 1, title: 'classic denim jacket', price: 89.99, image: 'assets/asos-shoe-1.jpg', category: 'clothing' },
        { id: 2, title: 'slim fit chinos', price: 119.99, image: 'assets/asos-shoe-2.jpg', category: 'clothing' },
        { id: 3, title: 'casual cotton t-shirt', price: 29.99, image: 'assets/asos-shoe-3.jpg', category: 'clothing' },
        { id: 4, title: 'summer dress', price: 79.99, image: 'assets/asos-shoe-4.jpg', category: 'clothing' },
        { id: 5, title: 'wool blend sweater', price: 99.99, image: 'assets/asos-shoe-5.jpg', category: 'clothing' },
        { id: 6, title: 'leather belt', price: 39.99, image: 'assets/asos-shoe-6.jpg', category: 'accessories' },
        { id: 7, title: 'designer watch', price: 179.99, image: 'assets/asos-shoe-7.jpg', category: 'accessories' },
        { id: 8, title: 'canvas backpack', price: 59.99, image: 'assets/asos-shoe-8.jpg', category: 'accessories' },
        { id: 9, title: 'classic black sneakers', price: 89.99, image: 'assets/asos-shoe-1.jpg', category: 'shoes' },
        { id: 10, title: 'white running shoes', price: 119.99, image: 'assets/asos-shoe-2.jpg', category: 'shoes' },
        { id: 11, title: 'leather boots', price: 149.99, image: 'assets/asos-shoe-3.jpg', category: 'shoes' },
        { id: 12, title: 'summer sandals', price: 59.99, image: 'assets/asos-shoe-4.jpg', category: 'shoes' },
        { id: 13, title: 'high top trainers', price: 99.99, image: 'assets/asos-shoe-5.jpg', category: 'shoes' },
        { id: 14, title: 'canvas slip-ons', price: 69.99, image: 'assets/asos-shoe-6.jpg', category: 'shoes' },
        { id: 15, title: 'designer heels', price: 179.99, image: 'assets/asos-shoe-7.jpg', category: 'shoes' },
        { id: 16, title: 'sports trainers', price: 109.99, image: 'assets/asos-shoe-8.jpg', category: 'shoes' },
      ];

      let currentSearch = '';
      let showingCart = false;

      const renderProducts = (ul: HTMLElement) => {
        let filtered;
        if (currentSearch) {
          filtered = allProducts.filter(p =>
            p.title.toLowerCase().includes(currentSearch.toLowerCase()) ||
            p.category.toLowerCase().includes(currentSearch.toLowerCase())
          );
        } else {
          filtered = allProducts.slice(0, 8);
        }

        ul.innerHTML = '';

        if (filtered.length === 0) {
          const li = document.createElement('li');
          li.className = 'boring-list-item';
          li.textContent = 'no products found';
          li.style.padding = '16px 20px';
          li.style.background = '#1a1a1c';
          li.style.border = '1px solid #2a2a2c';
          li.style.borderRadius = '8px';
          li.style.color = '#888';
          ul.appendChild(li);
          return;
        }

        filtered.forEach(product => {
          const li = document.createElement('li');
          li.className = 'boring-list-item';

          const link = document.createElement('div');
          link.className = 'boring-list-link';
          link.style.display = 'flex';
          link.style.alignItems = 'center';
          link.style.gap = '16px';
          link.style.padding = '16px 20px';

          const img = document.createElement('img');
          img.src = product.image;
          img.alt = product.title;
          img.style.width = '80px';
          img.style.height = '80px';
          img.style.objectFit = 'cover';
          img.style.borderRadius = '6px';
          img.style.background = '#0b0b0c';
          img.style.flexShrink = '0';

          const title = document.createElement('span');
          title.textContent = `${product.title} - £${product.price.toFixed(2)}`;
          title.style.flex = '1';

          const btn = document.createElement('button');
          btn.className = 'asos-add-btn';
          btn.textContent = 'add to cart';
          btn.setAttribute('data-id', product.id.toString());

          link.appendChild(img);
          link.appendChild(title);
          link.appendChild(btn);
          li.appendChild(link);
          ul.appendChild(li);
        });
      };

      const renderCart = (container: HTMLElement) => {
        container.innerHTML = '';
        const cart = getCart();

        if (cart.length === 0) {
          const empty = document.createElement('div');
          empty.textContent = 'your cart is empty';
          empty.style.textAlign = 'center';
          empty.style.padding = '40px';
          empty.style.color = '#888';
          container.appendChild(empty);
          return;
        }

        const ul = document.createElement('ul');
        ul.className = 'boring-list';

        cart.forEach((item: any) => {
          const li = document.createElement('li');
          li.className = 'boring-list-item';

          const link = document.createElement('div');
          link.className = 'boring-list-link';
          link.style.display = 'flex';
          link.style.alignItems = 'center';
          link.style.gap = '16px';

          const title = document.createElement('span');
          title.textContent = `${item.title} × ${item.quantity} - £${(item.price * item.quantity).toFixed(2)}`;
          title.style.flex = '1';

          const btn = document.createElement('button');
          btn.className = 'asos-remove-btn';
          btn.textContent = 'remove';
          btn.setAttribute('data-id', item.id.toString());

          link.appendChild(title);
          link.appendChild(btn);
          li.appendChild(link);
          ul.appendChild(li);
        });

        container.appendChild(ul);

        const total = cart.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

        const totalSection = document.createElement('div');
        totalSection.style.marginTop = '24px';
        totalSection.style.paddingTop = '24px';
        totalSection.style.borderTop = '1px solid #2a2a2c';

        const totalText = document.createElement('h3');
        totalText.textContent = `total: £${total.toFixed(2)}`;
        totalText.style.color = '#fff';
        totalText.style.fontSize = '18px';
        totalText.style.marginBottom = '16px';

        const checkoutBtn = document.createElement('button');
        checkoutBtn.className = 'asos-checkout-btn';
        checkoutBtn.textContent = 'checkout';

        totalSection.appendChild(totalText);
        totalSection.appendChild(checkoutBtn);
        container.appendChild(totalSection);
      };

      const render = () => {
        while (document.body.firstChild) {
          document.body.removeChild(document.body.firstChild);
        }

        const container = document.createElement('div');
        container.className = 'boring-container';

        // Header with back button and mode label
        const header = document.createElement('div');
        header.className = 'boring-header';

        const backBtn = document.createElement('button');
        backBtn.className = 'boring-back-btn';
        backBtn.textContent = '← Back';
        backBtn.onclick = () => window.history.back();

        const modeLabel = document.createElement('span');
        modeLabel.className = 'boring-mode-label';
        modeLabel.textContent = showingCart ? 'Cart' : 'Shopping';

        header.appendChild(backBtn);
        header.appendChild(modeLabel);
        container.appendChild(header);

        // Title row with cart button
        const titleRow = document.createElement('div');
        titleRow.style.display = 'flex';
        titleRow.style.justifyContent = 'space-between';
        titleRow.style.alignItems = 'center';
        titleRow.style.marginBottom = '16px';

        const h1 = document.createElement('h1');
        h1.className = 'boring-title';
        h1.textContent = 'asos';

        const cartBtn = document.createElement('button');
        cartBtn.className = 'boring-back-btn';
        cartBtn.style.margin = '0';

        // Create cart text and counter inline
        const cartText = document.createTextNode('basket(');
        const countSpan = document.createElement('span');
        countSpan.id = 'cart-count';
        countSpan.textContent = '0';
        const closeParen = document.createTextNode(')');

        cartBtn.appendChild(cartText);
        cartBtn.appendChild(countSpan);
        cartBtn.appendChild(closeParen);

        cartBtn.onclick = () => {
          showingCart = !showingCart;
          render();
        };

        titleRow.appendChild(h1);
        titleRow.appendChild(cartBtn);
        container.appendChild(titleRow);

        if (!showingCart) {
          // Search input
          const searchInput = document.createElement('input');
          searchInput.type = 'text';
          searchInput.className = 'boring-search';
          searchInput.placeholder = 'search products...';
          searchInput.value = currentSearch;
          searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
              currentSearch = (e.target as HTMLInputElement).value;
              render();
            }
          });
          container.appendChild(searchInput);

          // Product list
          const ul = document.createElement('ul');
          ul.className = 'boring-list';
          container.appendChild(ul);
          renderProducts(ul);

          // Add event listeners for add buttons
          ul.querySelectorAll('.asos-add-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
              const id = parseInt((e.target as HTMLElement).getAttribute('data-id') || '0');
              const product = allProducts.find(p => p.id === id);
              if (product) addToCart(product);
            });
          });
        } else {
          // Cart view
          const cartContainer = document.createElement('div');
          container.appendChild(cartContainer);
          renderCart(cartContainer);

          // Add event listeners for remove and checkout buttons
          cartContainer.querySelectorAll('.asos-remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
              const id = parseInt((e.target as HTMLElement).getAttribute('data-id') || '0');
              let cart = getCart();
              cart = cart.filter((item: any) => item.id !== id);
              saveCart(cart);
              render();
            });
          });

          const checkoutBtn = cartContainer.querySelector('.asos-checkout-btn');
          if (checkoutBtn) {
            checkoutBtn.addEventListener('click', () => {
              alert('Checkout complete!');
              saveCart([]);
              render();
            });
          }
        }

        document.body.appendChild(container);

        // Demo badge
        const badge = document.createElement('div');
        badge.className = 'demo-badge';
        badge.textContent = '✓ Demo Mode Active';
        document.body.appendChild(badge);

        updateCartBadge();
      };

      // Add styles - exact same as YouTube fake page
      if (document.head) {
        const style = document.createElement('style');
        style.textContent = `
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #0b0b0c !important;
            color: #e8e8e8;
            line-height: 1.6;
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
          .asos-add-btn, .asos-remove-btn {
            background: #1a1a1c;
            border: 1px solid #2a2a2c;
            color: #e8e8e8;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            white-space: nowrap;
            transition: background 0.2s;
          }
          .asos-add-btn:hover, .asos-remove-btn:hover {
            background: #2a2a2c;
          }
          .asos-checkout-btn {
            width: 100%;
            background: #1a1a1c;
            border: 1px solid #2a2a2c;
            color: #e8e8e8;
            padding: 12px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
          }
          .asos-checkout-btn:hover {
            background: #2a2a2c;
          }
          .demo-badge {
            position: fixed;
            bottom: 10px;
            right: 10px;
            background: #007acc;
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 11px;
            font-family: monospace;
            z-index: 999999;
          }
        `;
        document.head.appendChild(style);
      }

      render();
      console.log('[Boring Browser] Fake ASOS built!');
    };

    buildFakeASOS();
    return;
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

  // YouTube is already faked in veil IIFE - skip transformation
  if (location.hostname.includes('youtube.com') || location.hostname.includes('youtu.be')) {
    console.log('[Boring Browser] YouTube already faked in veil, skipping normal transformation');
    return;
  }

  // ASOS is already faked in veil IIFE - skip transformation
  if (location.hostname.includes('asos.com')) {
    console.log('[Boring Browser] ASOS already faked in veil, skipping normal transformation');
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

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      console.log('[Boring Browser] Waiting for DOMContentLoaded...');
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
      });
    }

    // Wait for dynamic content to fully load (Google/BBC need this)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Run the transformation
    console.log('[Boring Browser] Running transformation...');
    const transformedHTML = runTransform(location.href, document);
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

    // Replace entire document
    console.log('[Boring Browser] Replacing document HTML...');
    try {
      // Use document.open/write/close to bypass Trusted Types restrictions (YouTube CSP)
      const newHTML = `<!DOCTYPE html>
<html>
  <head>
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
  </head>
  <body>
    ${transformedHTML}
    <div style="position: fixed; bottom: 10px; right: 10px; background: #007acc; color: white; padding: 8px 12px; border-radius: 4px; font-size: 11px; font-family: monospace; z-index: 999999;">
      ✓ Minimal Mode Active
    </div>
  </body>
</html>`;

      document.open();
      document.write(newHTML);
      document.close();
    } catch (htmlError) {
      console.error('[Boring Browser] Failed to replace document:', htmlError);
      console.error('[Boring Browser] Transformed HTML preview:', transformedHTML.substring(0, 500));
      throw htmlError; // Re-throw to be caught by outer try-catch
    }

    // Mark as transformed
    hasTransformed = true;
    lastUrl = location.href;
    console.log('[Boring Browser] Document replaced successfully');

    // Reveal the page
    console.log('[Boring Browser] Revealing page...');
    removeVeil();
    console.log('[Boring Browser] Transformation complete!');

    // Set up event handlers
    setupEventHandlers();

    // Set up search handler if search box exists
    setupSearchHandler();

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

  // Remove the veil style tag
  const veilStyle = document.getElementById('boring-browser-veil');
  if (veilStyle) {
    veilStyle.remove();
  }

  console.log('[Boring Browser] Veil removed!');
}

function setupEventHandlers() {
  // Handle all data-action buttons
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const action = target.getAttribute('data-action');

    if (action === 'back') {
      e.preventDefault();
      window.history.back();
    } else if (action === 'reload') {
      e.preventDefault();
      window.location.reload();
    }
  });
}

function setupSearchHandler() {
  const searchInput = document.getElementById('boring-search-input') as HTMLInputElement;
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) {
          // Determine which search engine based on current URL
          const currentUrl = window.location.href;
          if (currentUrl.includes('youtube.com')) {
            window.location.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
          } else if (currentUrl.includes('google.com')) {
            window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
          } else {
            // Default to Google
            window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
          }
        }
      }
    });
  }
}

function setupNavigationDetection() {
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
  setInterval(checkUrlChange, 500);

  // Also listen to popstate for back/forward
  window.addEventListener('popstate', () => {
    lastUrl = '';
    hasTransformed = false;
    performTransformation();
  });

  // MutationObserver for DOM changes that might indicate navigation
  const observer = new MutationObserver(() => {
    checkUrlChange();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: false
  });
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
