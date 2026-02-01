// Google Search adapter

import { ListPageData, ListItem } from '../ui/templates';

export function extractGoogleSearch(doc: Document, url: string): ListPageData {
  console.log('[Google Adapter] Starting extraction from:', url);

  const items: ListItem[] = [];
  const seen = new Set<string>();

  // Get search query from URL
  const urlObj = new URL(url);
  const query = urlObj.searchParams.get('q') || 'search results';
  console.log('[Google Adapter] Search query:', query);

  // Strategy 1: Find all links and filter for search results
  const allLinks = doc.querySelectorAll('a[href]');
  console.log('[Google Adapter] Found', allLinks.length, 'total links');

  allLinks.forEach((link, index) => {
    const href = link.getAttribute('href');
    if (!href) return;

    // Skip javascript links
    if (href.startsWith('javascript:')) return;

    // Skip Google internal links
    if (href.startsWith('/search') ||
        href.startsWith('/preferences') ||
        href.startsWith('/advanced_search') ||
        href.startsWith('/setprefs') ||
        href.startsWith('#')) {
      return;
    }

    // Build absolute URL
    let fullUrl = href;
    try {
      if (href.startsWith('/url?')) {
        // Google redirect URL - extract the actual URL
        const urlParams = new URLSearchParams(href.substring(5));
        const actualUrl = urlParams.get('q') || urlParams.get('url');
        if (actualUrl) {
          fullUrl = actualUrl;
        } else {
          return;
        }
      } else if (href.startsWith('/')) {
        // Relative URL - skip these (they're Google internal)
        return;
      } else if (!href.startsWith('http')) {
        return;
      }

      // Validate URL
      const parsedUrl = new URL(fullUrl);
      const hostname = parsedUrl.hostname.toLowerCase();

      // Skip Google's own domains
      if (hostname.includes('google.com') ||
          hostname.includes('google.') ||
          hostname.includes('gstatic.com') ||
          hostname.includes('googleusercontent.com') ||
          hostname.includes('youtube.com') && link.textContent?.includes('Sign in')) {
        return;
      }

      // Must have a valid hostname
      if (!hostname || hostname.length < 3 || !hostname.includes('.')) {
        return;
      }
    } catch (e) {
      return;
    }

    // Get title - try multiple approaches
    let title = '';

    // Look for h3 inside the link or nearby
    const h3 = link.querySelector('h3') || link.closest('div')?.querySelector('h3');
    if (h3) {
      title = h3.textContent?.trim() || '';
    }

    // If no h3, try the link's text content
    if (!title) {
      title = link.textContent?.trim() || '';
    }

    // Clean up title
    title = title.replace(/\s+/g, ' ').trim();

    // Skip if no title or too short
    if (!title || title.length < 3 || title.length > 200) return;

    // Skip common noise
    if (title.toLowerCase().includes('sign in') ||
        title.toLowerCase().includes('images') ||
        title.toLowerCase().includes('videos') ||
        title.toLowerCase().includes('maps') ||
        title.toLowerCase().includes('news') ||
        title.toLowerCase().includes('shopping')) {
      return;
    }

    // Skip duplicates
    if (seen.has(fullUrl)) return;
    seen.add(fullUrl);

    // Skip duplicate titles
    if (items.some(item => item.title === title)) return;

    console.log('[Google Adapter] Found result:', { title: title.substring(0, 50), url: fullUrl.substring(0, 60) });

    items.push({
      title: title,
      href: fullUrl
    });
  });

  console.log('[Google Adapter] Extracted', items.length, 'results');

  // If we still don't have results, log some debug info
  if (items.length === 0) {
    console.log('[Google Adapter] No results found. Sample HTML:', doc.body?.innerHTML.substring(0, 1000));
  }

  return {
    title: `search: ${query}`,
    items: items.length > 0 ? items.slice(0, 20) : [{
      title: 'no results found - try a different search',
      href: 'https://www.google.com'
    }],
    modeLabel: 'google search',
    searchBox: true
  };
}
