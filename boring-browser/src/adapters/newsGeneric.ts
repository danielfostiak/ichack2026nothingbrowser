// Generic news list adapter

import { Adapter, AdapterResult } from './types';
import { NewsItem, NewsPageData } from '../ui/templates';

function extractJsonLd(doc: Document): any[] {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  const items: any[] = [];
  scripts.forEach(script => {
    const text = script.textContent?.trim();
    if (!text) return;
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        items.push(...parsed);
      } else {
        items.push(parsed);
      }
    } catch (error) {
      console.warn('[News Adapter] JSON-LD parse failed:', error);
    }
  });
  return items;
}

function normalizeUrl(href: string, base: URL): string | null {
  if (!href) return null;
  try {
    return new URL(href, base.origin).toString();
  } catch {
    return null;
  }
}

function extractText(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const first = value.find(v => typeof v === 'string');
    return first || undefined;
  }
  if (typeof value === 'object') {
    if (typeof value.name === 'string') return value.name;
    if (typeof value.headline === 'string') return value.headline;
  }
  return undefined;
}

function extractTime(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (typeof value.datePublished === 'string') return value.datePublished;
    if (typeof value.dateModified === 'string') return value.dateModified;
  }
  return undefined;
}

function itemsFromJsonLd(nodes: any[], base: URL, fallbackSource?: string): NewsItem[] {
  const items: NewsItem[] = [];
  const seen = new Set<string>();

  const pushItem = (item: NewsItem | null) => {
    if (!item || !item.href || !item.title) return;
    if (seen.has(item.href)) return;
    seen.add(item.href);
    items.push(item);
  };

  const articleFromNode = (node: any): NewsItem | null => {
    const title = extractText(node.headline || node.name);
    const url = extractText(node.url);
    if (!title || !url) return null;
    const href = normalizeUrl(url, base);
    if (!href) return null;

    const source =
      extractText(node.publisher?.name) ||
      extractText(node.source?.name) ||
      fallbackSource;
    const time = extractTime(node.datePublished || node.dateModified);

    return {
      title: title.trim(),
      href,
      source,
      time
    };
  };

  const walk = (node: any) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node !== 'object') return;

    const type = node['@type'];
    if (type === 'NewsArticle' || type === 'Article') {
      pushItem(articleFromNode(node));
      return;
    }

    if (type === 'ItemList' && Array.isArray(node.itemListElement)) {
      node.itemListElement.forEach((el: any) => {
        if (!el) return;
        const candidate = el.item || el;
        if (!candidate) return;
        if (candidate['@type'] === 'NewsArticle' || candidate['@type'] === 'Article') {
          pushItem(articleFromNode(candidate));
        } else if (candidate.url && (candidate.headline || candidate.name)) {
          pushItem(articleFromNode(candidate));
        }
      });
    }

    Object.keys(node).forEach(key => walk(node[key]));
  };

  nodes.forEach(walk);
  return items;
}

function itemsFromDom(doc: Document, base: URL, fallbackSource?: string): NewsItem[] {
  const items: NewsItem[] = [];
  const seen = new Set<string>();

  const headlineNodes = doc.querySelectorAll('h2, h3, h4');
  headlineNodes.forEach(node => {
    const anchor =
      (node.closest('a[href]') as HTMLAnchorElement | null) ||
      (node.querySelector('a[href]') as HTMLAnchorElement | null);
    if (!anchor) return;

    const href = normalizeUrl(anchor.getAttribute('href') || '', base);
    if (!href || seen.has(href)) return;
    if (!href.includes(base.hostname)) return;

    const title = node.textContent?.trim() || anchor.textContent?.trim() || '';
    if (title.length < 10 || title.length > 200) return;

    const timeEl =
      node.closest('article')?.querySelector('time') ||
      node.parentElement?.querySelector('time') ||
      anchor.parentElement?.querySelector('time');
    const time =
      timeEl?.getAttribute('datetime')?.trim() || timeEl?.textContent?.trim() || undefined;

    seen.add(href);
    items.push({
      title,
      href,
      source: fallbackSource,
      time
    });
  });

  return items;
}

function looksLikeNewsList(doc: Document): boolean {
  const ogType = doc.querySelector('meta[property="og:type"]')?.getAttribute('content');
  if (ogType === 'article') {
    return false;
  }

  const jsonLd = extractJsonLd(doc);
  const jsonLdItems = itemsFromJsonLd(jsonLd, new URL(doc.location?.href || 'https://example.com'));
  if (jsonLdItems.length >= 5) return true;

  const headlineCount = doc.querySelectorAll('h2, h3').length;
  return headlineCount >= 8;
}

export const newsGenericAdapter: Adapter = {
  id: 'news-generic',
  priority: 30,
  match: (url, doc) => {
    if (!url.hostname) return false;
    return looksLikeNewsList(doc);
  },
  extract: (url, doc): AdapterResult | null => {
    const siteName =
      doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ||
      doc.title ||
      url.hostname;

    const base = new URL(url.toString());
    const jsonLdItems = itemsFromJsonLd(extractJsonLd(doc), base, siteName);
    const domItems = jsonLdItems.length === 0 ? itemsFromDom(doc, base, siteName) : [];
    const items = [...jsonLdItems, ...domItems].slice(0, 60);

    if (items.length < 5) {
      return null;
    }

    const data: NewsPageData = {
      title: siteName,
      items,
      modeLabel: 'News',
      searchBox: false
    };

    return {
      template: 'news',
      data
    };
  }
};

