// Google Search adapter

import { Adapter, AdapterResult } from './types';
import { ListPageData, ListItem } from '../ui/templates';

export function extractGoogleSearch(doc: Document, url: string): ListPageData {
  const items: ListItem[] = [];
  const seen = new Set<string>();

  // Get search query from URL
  const urlObj = new URL(url);
  const query = urlObj.searchParams.get('q') || 'search results';

  // Find all h3 elements (Google uses h3 for result titles)
  const h3Elements = doc.querySelectorAll('h3');

  h3Elements.forEach(h3 => {
    // Get the parent link
    const link = h3.closest('a[href]') as HTMLAnchorElement;
    if (!link) return;

    let href = link.href;
    const title = h3.textContent?.trim() || '';

    // Skip if no title or too short
    if (!title || title.length < 5) return;

    // Skip javascript links
    if (!href || href.startsWith('javascript:')) return;

    // Clean up Google redirect URLs (/url?q=...)
    if (href.includes('/url?')) {
      try {
        const urlParams = new URL(href).searchParams;
        const actualUrl = urlParams.get('url') || urlParams.get('q');
        if (actualUrl) {
          href = actualUrl;
        }
      } catch (e) {
        // If parsing fails, skip this result
        return;
      }
    }

    // Skip Google-internal pages (search, accounts, maps, etc.)
    try {
      const parsedUrl = new URL(href);
      const hostname = parsedUrl.hostname.toLowerCase();

      // Skip Google's own navigation pages (but allow legitimate sites)
      if (hostname.includes('google.com') ||
          hostname.includes('gstatic.com')) {
        return;
      }
    } catch (e) {
      // Invalid URL, skip
      return;
    }

    // Skip duplicates by URL
    if (seen.has(href)) return;
    seen.add(href);

    items.push({
      title: title,
      href: href
    });
  });

  return {
    title: `search: ${query}`.toLowerCase(),
    items: items.length > 0 ? items : [{
      title: 'No results found - try a different search',
      href: 'https://www.google.com'
    }],
    modeLabel: 'google search',
    searchBox: true
  };
}

function isGoogleSearch(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  if (!hostname.includes('google.com') && !hostname.includes('google.')) {
    return false;
  }

  if (url.pathname.includes('/search') || url.searchParams.has('q')) {
    return true;
  }

  return false;
}

export const googleAdapter: Adapter = {
  id: 'google-search',
  priority: 90,
  match: (url) => isGoogleSearch(url),
  extract: (url, doc): AdapterResult => {
    const data = extractGoogleSearch(doc, url.toString());
    return {
      template: 'list',
      data
    };
  }
};
