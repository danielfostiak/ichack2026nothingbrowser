// ASOS adapter - shopping grid extraction

import { Adapter, AdapterResult } from './types';
import { ListItem, ShoppingItem, ShoppingPageData } from '../ui/templates';

function isASOS(url: URL): boolean {
  return url.hostname.toLowerCase().includes('asos.com');
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
      console.warn('[ASOS Adapter] JSON-LD parse failed:', error);
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

function productFromJsonLd(node: any, base: URL): ShoppingItem | null {
  const name = extractText(node.name);
  const url = extractText(node.url);
  if (!name || !url) return null;

  const image = extractText(node.image);
  const brand = extractText(node.brand);
  const offers = node.offers || node.offer || node.priceSpecification;
  const price = extractPrice(offers);

  const fullUrl = normalizeUrl(url, base);
  if (!fullUrl) return null;

  return {
    title: name.trim(),
    href: fullUrl,
    price,
    brand,
    image: image ? normalizeUrl(image, base) || image : undefined
  };
}

function itemsFromJsonLd(nodes: any[], base: URL): ShoppingItem[] {
  const items: ShoppingItem[] = [];
  const seen = new Set<string>();

  const pushItem = (item: ShoppingItem | null) => {
    if (!item) return;
    if (!item.href || seen.has(item.href)) return;
    seen.add(item.href);
    items.push(item);
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
      pushItem(productFromJsonLd(node, base));
      return;
    }

    if (type === 'ItemList' && Array.isArray(node.itemListElement)) {
      node.itemListElement.forEach((el: any) => {
        if (!el) return;
        const candidate = el.item || el;
        if (candidate && (candidate['@type'] === 'Product' || candidate.name)) {
          pushItem(productFromJsonLd(candidate, base));
        } else if (el.url && el.name) {
          const href = normalizeUrl(String(el.url), base);
          if (href && !seen.has(href)) {
            seen.add(href);
            items.push({
              title: String(el.name).trim(),
              href
            });
          }
        }
      });
    }

    Object.keys(node).forEach(key => walk(node[key]));
  };

  nodes.forEach(walk);
  return items;
}

function itemsFromNextData(doc: Document, base: URL): ShoppingItem[] {
  const script = doc.querySelector('#__NEXT_DATA__');
  if (!script?.textContent) return [];
  try {
    const data = JSON.parse(script.textContent);
    const items: ShoppingItem[] = [];
    const seen = new Set<string>();

    const pushItem = (item: ShoppingItem) => {
      if (!item.href || seen.has(item.href)) return;
      seen.add(item.href);
      items.push(item);
    };

    const collectFromNode = (node: any) => {
      if (!node || typeof node !== 'object') return;

      const name =
        node.name ||
        node.productName ||
        node.title ||
        node.displayName ||
        node.productTitle;
      const url =
        node.url ||
        node.link ||
        node.productUrl ||
        node.pdpUrl ||
        node.urlString;
      const brand = node.brandName || node.brand?.name || node.brand;
      const price = extractPrice(
        node.price ||
          node.currentPrice ||
          node.priceValue ||
          node.priceText ||
          node.priceInfo ||
          node.priceSummary
      );
      const image =
        node.imageUrl ||
        node.image ||
        node.primaryImage ||
        node.mainImage ||
        node.imageUrlTemplate ||
        (node.media && node.media.images && node.media.images[0]?.url);

      if (name && url) {
        const fullUrl = normalizeUrl(String(url), base);
        if (fullUrl && fullUrl.includes('asos.com')) {
          pushItem({
            title: String(name).trim(),
            href: fullUrl,
            price,
            brand: brand ? String(brand).trim() : undefined,
            image: image ? normalizeUrl(String(image), base) || String(image) : undefined
          });
        }
      }
    };

    const walk = (node: any) => {
      if (!node) return;
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (typeof node !== 'object') return;

      collectFromNode(node);

      Object.keys(node).forEach(key => walk(node[key]));
    };

    walk(data);
    return items;
  } catch (error) {
    console.warn('[ASOS Adapter] __NEXT_DATA__ parse failed:', error);
    return [];
  }
}

function itemsFromDom(doc: Document, base: URL): ShoppingItem[] {
  const items: ShoppingItem[] = [];
  const seen = new Set<string>();

  const tiles = doc.querySelectorAll(
    '[data-auto-id="productTile"], [data-testid*="product"], [data-test*="product"], [data-qa*="product"], article, li'
  );
  tiles.forEach(tile => {
    const anchor = tile.querySelector('a[href*="/prd/"], a[href*="/product/"]') as HTMLAnchorElement | null;
    if (!anchor) return;
    const href = normalizeUrl(anchor.getAttribute('href') || '', base);
    if (!href || seen.has(href)) return;

    const title =
      (tile.querySelector('[data-auto-id="productTileDescription"]') as HTMLElement | null)?.textContent?.trim() ||
      (tile.querySelector('[data-testid*="productTileDescription"]') as HTMLElement | null)?.textContent?.trim() ||
      (tile.querySelector('[data-testid*="productTitle"]') as HTMLElement | null)?.textContent?.trim() ||
      (tile.querySelector('[data-testid*="productName"]') as HTMLElement | null)?.textContent?.trim() ||
      (tile.querySelector('[data-qa*="productName"]') as HTMLElement | null)?.textContent?.trim() ||
      anchor.getAttribute('aria-label')?.trim() ||
      (tile.querySelector('img') as HTMLImageElement | null)?.alt?.trim() ||
      anchor.textContent?.trim() ||
      '';
    if (!title) return;

    const priceText =
      (tile.querySelector('[data-auto-id="productTilePrice"]') as HTMLElement | null)?.textContent?.trim() ||
      (tile.querySelector('[data-testid*="price"]') as HTMLElement | null)?.textContent?.trim() ||
      (tile.querySelector('[data-qa*="price"]') as HTMLElement | null)?.textContent?.trim() ||
      (tile.querySelector('[data-auto-id="productTilePrice"] span') as HTMLElement | null)?.textContent?.trim() ||
      '';

    const image =
      (tile.querySelector('img') as HTMLImageElement | null)?.getAttribute('src') ||
      (tile.querySelector('img') as HTMLImageElement | null)?.getAttribute('data-src') ||
      undefined;

    seen.add(href);
    items.push({
      title,
      href,
      price: priceText || undefined,
      image: image ? normalizeUrl(image, base) || image : undefined
    });
  });

  if (items.length > 0) return items;

  // Fallback: scan all links for ASOS product IDs
  const links = doc.querySelectorAll('a[href]');
  links.forEach(link => {
    const href = link.getAttribute('href') || '';
    if (!href.includes('/prd/') && !href.includes('/product/')) return;
    const fullUrl = normalizeUrl(href, base);
    if (!fullUrl || seen.has(fullUrl)) return;

    const title =
      link.getAttribute('aria-label')?.trim() ||
      (link.querySelector('img') as HTMLImageElement | null)?.alt?.trim() ||
      link.textContent?.trim() ||
      '';
    if (!title) return;

    const image =
      (link.querySelector('img') as HTMLImageElement | null)?.getAttribute('src') ||
      (link.querySelector('img') as HTMLImageElement | null)?.getAttribute('data-src') ||
      undefined;

    seen.add(fullUrl);
    items.push({
      title,
      href: fullUrl,
      image: image ? normalizeUrl(image, base) || image : undefined
    });
  });

  return items;
}

function extractCategoryLinks(doc: Document, base: URL): ListItem[] {
  const items: ListItem[] = [];
  const seen = new Set<string>();
  const baseParts = base.pathname.split('/').filter(Boolean);
  const gender = baseParts.find(part => part === 'men' || part === 'women');

  const blacklist = [
    'skip to main content',
    'download our new app',
    'help',
    'my account',
    'my orders',
    'sign in',
    'join',
    'shopping bag',
    'saved items',
    'wishlist',
    'checkout'
  ];

  const anchors = doc.querySelectorAll('a[href]');
  anchors.forEach(anchor => {
    const href = anchor.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

    const fullUrl = normalizeUrl(href, base);
    if (!fullUrl) return;

    const url = new URL(fullUrl);
    if (!url.hostname.includes('asos.com')) return;
    if (url.hostname.startsWith('my.')) return;
    if (url.pathname.includes('/prd/') || url.pathname.includes('/product/')) return;

    const pathParts = url.pathname.split('/').filter(Boolean);
    if (gender && !pathParts.includes(gender)) return;

    const text =
      anchor.textContent?.trim() ||
      anchor.getAttribute('aria-label')?.trim() ||
      '';
    if (!text || text.length < 3 || text.length > 60) return;

    const lower = text.toLowerCase();
    if (blacklist.some(term => lower.includes(term))) return;
    if (lower === 'view all' || lower === 'view all products') return;

    if (seen.has(fullUrl)) return;
    seen.add(fullUrl);
    items.push({ title: text, href: fullUrl });
  });

  return items.slice(0, 80);
}

export function extractASOSProducts(doc: Document, url: URL): ShoppingPageData {
  const base = new URL(url.toString());

  const jsonLdItems = itemsFromJsonLd(extractJsonLd(doc), base);
  const nextDataItems = jsonLdItems.length === 0 ? itemsFromNextData(doc, base) : [];
  const domItems = jsonLdItems.length === 0 && nextDataItems.length === 0 ? itemsFromDom(doc, base) : [];

  const combined = [...jsonLdItems, ...nextDataItems, ...domItems];
  const items = combined.slice(0, 60);

  const pageTitle =
    doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
    doc.title ||
    'ASOS';

  const checkoutLink =
    doc.querySelector('a[href*="/bag"]')?.getAttribute('href') ||
    doc.querySelector('a[href*="checkout"]')?.getAttribute('href') ||
    '/bag';
  const checkoutUrl = normalizeUrl(checkoutLink || '/bag', base) || `${base.origin}/bag`;

  return {
    title: pageTitle.replace(/\s+\|\s+ASOS.*/i, '').trim() || 'ASOS',
    items,
    modeLabel: 'Shopping',
    searchBox: true,
    checkoutUrl
  };
}

export const asosAdapter: Adapter = {
  id: 'asos-products',
  priority: 70,
  match: (url) => isASOS(url),
  extract: (url, doc): AdapterResult => {
    const data = extractASOSProducts(doc, url);
    if (data.items.length > 0) {
      return {
        template: 'shopping',
        data
      };
    }

    const categories = extractCategoryLinks(doc, url);
    if (categories.length > 0) {
      return {
        template: 'list',
        data: {
          title: data.title || 'ASOS',
          items: categories,
          modeLabel: 'Shopping',
          searchBox: false
        }
      };
    }

    return {
      template: 'shopping',
      data
    };
  }
};
