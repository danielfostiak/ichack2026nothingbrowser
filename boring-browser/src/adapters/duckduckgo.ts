// DuckDuckGo Search adapter

import { Adapter, AdapterResult } from './types';
import { ListPageData, ListItem } from '../ui/templates';

function normalizeDuckDuckGoUrl(href: string, baseUrl: URL): string | null {
  if (!href) return null;

  // DuckDuckGo redirect links: /l/?uddg=<url>
  if (href.startsWith('/l/?') || href.includes('duckduckgo.com/l/?')) {
    try {
      const redirectUrl = new URL(href, baseUrl);
      const uddg = redirectUrl.searchParams.get('uddg');
      if (uddg) {
        return decodeURIComponent(uddg);
      }
    } catch {
      return null;
    }
  }

  if (href.startsWith('//')) {
    return `https:${href}`;
  }

  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function isDuckDuckGoHost(urlString: string): boolean {
  try {
    const hostname = new URL(urlString).hostname.toLowerCase();
    return hostname.includes('duckduckgo.com');
  } catch {
    return false;
  }
}

export function extractDuckDuckGoResults(doc: Document, url: string): ListPageData {
  const items: ListItem[] = [];
  const seen = new Set<string>();

  const urlObj = new URL(url);
  const query = urlObj.searchParams.get('q') || 'search results';

  const selector = [
    'a[data-testid="result-title-a"]',
    'a.result__a',
    'a.result__title',
    '#links .result__a',
    '.results .result__a',
    '.result__title a'
  ].join(',');

  const pushResult = (anchor: HTMLAnchorElement) => {
    const title = anchor.textContent?.trim() || '';
    if (!title) return;

    const rawHref = anchor.getAttribute('href') || anchor.href;
    const href = normalizeDuckDuckGoUrl(rawHref, urlObj);
    if (!href) return;
    if (isDuckDuckGoHost(href)) return;

    if (seen.has(href)) return;
    seen.add(href);

    items.push({
      title,
      href
    });
  };

  const links = doc.querySelectorAll(selector);
  links.forEach(link => {
    pushResult(link as HTMLAnchorElement);
  });

  if (items.length === 0) {
    const resultNodes = doc.querySelectorAll('.result, .results .result, #links .result');
    resultNodes.forEach(node => {
      const anchor = node.querySelector('a.result__a, a.result__title, h2 a, h3 a') as HTMLAnchorElement | null;
      if (anchor) {
        pushResult(anchor);
      }
    });
  }

  return {
    title: `search: ${query}`.toLowerCase(),
    items: items.length > 0 ? items : [{
      title: 'No results found - try a different search',
      href: 'https://duckduckgo.com'
    }],
    modeLabel: 'duckduckgo',
    searchBox: true
  };
}

function isDuckDuckGoSearch(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  if (!hostname.includes('duckduckgo.com')) return false;

  if (url.searchParams.has('q')) return true;

  return url.pathname === '/html' || url.pathname === '/' || url.pathname === '/html/';
}

export const duckDuckGoAdapter: Adapter = {
  id: 'duckduckgo-search',
  priority: 85,
  match: (url) => isDuckDuckGoSearch(url),
  extract: (url, doc): AdapterResult => {
    const data = extractDuckDuckGoResults(doc, url.toString());
    return {
      template: 'list',
      data
    };
  }
};
