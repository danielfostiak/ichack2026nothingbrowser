// Amazon adapter - shopping grid extraction

import { Adapter, AdapterResult } from './types';
import { ShoppingItem, ShoppingPageData } from '../ui/templates';

function isAmazon(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return host.includes('amazon.') && !host.includes('amazonaws.');
}

function normalizeUrl(href: string, base: URL): string | null {
  if (!href) return null;
  try {
    return new URL(href, base.origin).toString();
  } catch {
    return null;
  }
}

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
      console.warn('[Amazon Adapter] JSON-LD parse failed:', error);
    }
  });
  return items;
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
    if (typeof value.text === 'string') return value.text;
  }
  return undefined;
}

function extractPrice(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    const currency = value.priceCurrency || value.currency || '';
    const price =
      value.price ??
      value.lowPrice ??
      value.highPrice ??
      value.value ??
      value.current?.value ??
      value.current?.text ??
      value.text;
    if (price !== undefined && price !== null) {
      const priceText = String(price);
      return currency ? `${currency} ${priceText}` : priceText;
    }
  }
  return undefined;
}

function itemsFromJsonLd(nodes: any[], base: URL): ShoppingItem[] {
  const items: ShoppingItem[] = [];
  const seen = new Set<string>();

  const pushItem = (item: ShoppingItem | null) => {
    if (!item || !item.href || seen.has(item.href)) return;
    seen.add(item.href);
    items.push(item);
  };

  const productFromNode = (node: any): ShoppingItem | null => {
    const name = extractText(node.name);
    const url = extractText(node.url);
    if (!name || !url) return null;
    const href = normalizeUrl(url, base);
    if (!href) return null;
    const image = extractText(node.image);
    const brand = extractText(node.brand);
    const price = extractPrice(node.offers || node.offer || node.priceSpecification);

    return {
      title: name.trim(),
      href,
      image: image ? normalizeUrl(image, base) || image : undefined,
      brand,
      price
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
    if (type === 'Product' || type === 'ProductGroup') {
      pushItem(productFromNode(node));
      return;
    }

    if (type === 'ItemList' && Array.isArray(node.itemListElement)) {
      node.itemListElement.forEach((el: any) => {
        const candidate = el.item || el;
        if (!candidate) return;
        pushItem(productFromNode(candidate));
      });
    }

    Object.keys(node).forEach(key => walk(node[key]));
  };

  nodes.forEach(walk);
  return items;
}

function itemsFromDom(doc: Document, base: URL): ShoppingItem[] {
  const items: ShoppingItem[] = [];
  const seen = new Set<string>();

  const cards = doc.querySelectorAll('div[data-component-type="s-search-result"], div[data-asin]');
  cards.forEach(card => {
    const asin = card.getAttribute('data-asin') || '';
    if (!asin) return;

    const link =
      (card.querySelector('h2 a.a-link-normal') as HTMLAnchorElement | null) ||
      (card.querySelector('h2 a') as HTMLAnchorElement | null) ||
      (card.querySelector('a.a-link-normal.s-no-outline') as HTMLAnchorElement | null) ||
      (card.querySelector('a.a-link-normal') as HTMLAnchorElement | null);

    const href =
      normalizeUrl(link?.getAttribute('href') || '', base) ||
      normalizeUrl(`/dp/${asin}`, base);
    if (!href || seen.has(href)) return;

    const title =
      (card.querySelector('h2 span') as HTMLElement | null)?.textContent?.trim() ||
      (card.querySelector('span.a-size-medium') as HTMLElement | null)?.textContent?.trim() ||
      (card.querySelector('span.a-size-base-plus') as HTMLElement | null)?.textContent?.trim() ||
      link?.getAttribute('aria-label')?.trim() ||
      link?.textContent?.trim() ||
      '';
    if (!title) return;

    const image =
      (card.querySelector('img.s-image') as HTMLImageElement | null)?.getAttribute('src') ||
      (card.querySelector('img') as HTMLImageElement | null)?.getAttribute('src') ||
      undefined;

    const price =
      (card.querySelector('span.a-price > span.a-offscreen') as HTMLElement | null)?.textContent?.trim() ||
      (() => {
        const whole = (card.querySelector('span.a-price-whole') as HTMLElement | null)?.textContent?.trim() || '';
        const fraction = (card.querySelector('span.a-price-fraction') as HTMLElement | null)?.textContent?.trim() || '';
        return whole ? `${whole}${fraction ? `.${fraction}` : ''}` : '';
      })();

    const brand =
      (card.querySelector('span.a-size-base.a-color-secondary') as HTMLElement | null)?.textContent?.trim() ||
      (card.querySelector('span.a-size-base-plus.a-color-base') as HTMLElement | null)?.textContent?.trim() ||
      undefined;

    seen.add(href);
    items.push({
      title,
      href,
      image,
      price: price || undefined,
      brand
    });
  });

  return items;
}

export function extractAmazonProducts(doc: Document, url: URL): ShoppingPageData {
  const base = new URL(url.toString());

  const jsonLdItems = itemsFromJsonLd(extractJsonLd(doc), base);
  const domItems = jsonLdItems.length === 0 ? itemsFromDom(doc, base) : [];
  const items = [...jsonLdItems, ...domItems].slice(0, 60);

  const pageTitle =
    doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
    doc.title ||
    'Amazon';

  const checkoutUrl = normalizeUrl('/gp/cart/view.html', base) || `${base.origin}/gp/cart/view.html`;

  return {
    title: pageTitle.replace(/\s*Amazon\s*$/i, '').trim() || 'Amazon',
    items,
    modeLabel: 'Shopping',
    searchBox: true,
    checkoutUrl
  };
}

export const amazonAdapter: Adapter = {
  id: 'amazon-products',
  priority: 75,
  match: (url) => isAmazon(url),
  extract: (url, doc): AdapterResult => {
    const data = extractAmazonProducts(doc, url);
    return {
      template: 'shopping',
      data
    };
  }
};
