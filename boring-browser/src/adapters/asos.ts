// ASOS adapter for product listings

import { ListPageData, ListItem } from '../ui/templates';

export function extractASOSProducts(doc: Document, url: string): ListPageData {
  const items: ListItem[] = [];
  const seen = new Set<string>();

  console.log('[ASOS Adapter] Starting extraction from:', url);

  // Ultra-aggressive product extraction
  // Try EVERY possible way to find product links on ASOS

  // Strategy 1: Find ALL links and filter for product URLs
  const allLinks = doc.querySelectorAll('a[href]');
  console.log('[ASOS Adapter] Found', allLinks.length, 'total links');

  allLinks.forEach((link, index) => {
    const href = link.getAttribute('href');
    if (!href) return;

    // ASOS product URLs typically contain /prd/ or /product/
    const isProductLink = href.includes('/prd/') ||
                         href.includes('/product/') ||
                         href.match(/\/\d{7,}/);  // 7+ digit product IDs

    if (!isProductLink) return;

    // Build absolute URL
    let fullUrl = href;
    if (href.startsWith('/')) {
      fullUrl = 'https://www.asos.com' + href;
    } else if (href.startsWith('http') && !href.includes('asos.com')) {
      return; // External link
    }

    // Get title - try multiple approaches
    let title = '';
    let image = '';

    // Method 1: Check for img with alt text
    const img = link.querySelector('img');
    if (img) {
      title = img.getAttribute('alt') || '';
      image = img.getAttribute('src') || img.getAttribute('data-src') || '';

      // Clean up image URL
      if (image) {
        // Remove query params for cleaner URLs
        image = image.split('?')[0];
        // Make absolute if needed
        if (image.startsWith('//')) {
          image = 'https:' + image;
        } else if (image.startsWith('/')) {
          image = 'https://www.asos.com' + image;
        }
      }
    }

    // Method 2: Look for text in child elements
    if (!title) {
      const textElements = link.querySelectorAll('p, span, div, h2, h3');
      for (const el of textElements) {
        const text = el.textContent?.trim();
        if (text && text.length > 5 && text.length < 200) {
          title = text;
          break;
        }
      }
    }

    // Method 3: Use link's direct text content
    if (!title) {
      title = link.textContent?.trim() || '';
    }

    // Method 4: Use aria-label
    if (!title || title.length < 5) {
      title = link.getAttribute('aria-label') || '';
    }

    // Clean up title
    title = title.trim();

    // Filter out noise
    if (!title || title.length < 3 || title.length > 200) return;
    if (title.toLowerCase().includes('skip to') ||
        title.toLowerCase().includes('navigation') ||
        title.toLowerCase().includes('menu')) return;

    // Skip duplicates by URL
    if (seen.has(fullUrl)) return;
    seen.add(fullUrl);

    console.log('[ASOS Adapter] Found product:', {
      title: title.substring(0, 50),
      url: fullUrl.substring(0, 60),
      hasImage: !!image
    });

    items.push({
      title: title,
      href: fullUrl,
      image: image || undefined
    });
  });

  console.log('[ASOS Adapter] Extracted', items.length, 'products');

  // If still nothing, try even more aggressive extraction
  if (items.length === 0) {
    console.log('[ASOS Adapter] No products found, trying ultra-aggressive extraction');

    // Look for ANY images that might be products
    const allImages = doc.querySelectorAll('img');
    console.log('[ASOS Adapter] Found', allImages.length, 'images');

    allImages.forEach(img => {
      const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
      const alt = img.getAttribute('alt') || '';

      // Find parent link
      let parentLink = img.closest('a');
      if (!parentLink) return;

      const href = parentLink.getAttribute('href');
      if (!href) return;

      // Build URL
      let fullUrl = href;
      if (href.startsWith('/')) {
        fullUrl = 'https://www.asos.com' + href;
      }

      // Filter for ASOS links
      if (!fullUrl.includes('asos.com')) return;
      if (seen.has(fullUrl)) return;
      seen.add(fullUrl);

      let image = src;
      if (image.startsWith('//')) {
        image = 'https:' + image;
      } else if (image.startsWith('/')) {
        image = 'https://www.asos.com' + image;
      }

      const title = alt || `ASOS Product ${items.length + 1}`;

      items.push({
        title: title,
        href: fullUrl,
        image: image || undefined
      });
    });

    console.log('[ASOS Adapter] Ultra-aggressive extraction found', items.length, 'items');
  }

  // Get page title
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/').filter(p => p);
  const category = pathParts[0] || 'Products';
  const pageTitle = category.charAt(0).toUpperCase() + category.slice(1).replace(/-/g, ' ');

  // Limit results
  const limitedItems = items.slice(0, 50);

  if (limitedItems.length === 0) {
    console.log('[ASOS Adapter] WARNING: No products extracted at all!');
    console.log('[ASOS Adapter] Page has', doc.body?.children.length || 0, 'body children');
    console.log('[ASOS Adapter] Sample HTML:', doc.body?.innerHTML.substring(0, 500));
  }

  return {
    title: `asos - ${pageTitle.toLowerCase()}`,
    items: limitedItems.length > 0 ? limitedItems : [{
      title: 'no products found - asos page may not have loaded yet',
      href: 'https://www.asos.com'
    }],
    modeLabel: 'shopping',
    searchBox: false
  };
}
