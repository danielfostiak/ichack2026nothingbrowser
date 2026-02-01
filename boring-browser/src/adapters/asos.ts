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

function parseSrcset(value: string): string | undefined {
  if (!value) return undefined;
  const first = value.split(',')[0]?.trim();
  if (!first) return undefined;
  return first.split(' ')[0]?.trim() || undefined;
}

function extractImageValue(value: any, node: any): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') {
    return resolveImageTemplate(value, node);
  }
  if (Array.isArray(value)) {
    const first = value.find(v => typeof v === 'string');
    return first ? resolveImageTemplate(first, node) : undefined;
  }
  if (typeof value === 'object') {
    if (typeof value.url === 'string') return resolveImageTemplate(value.url, node);
    if (typeof value.src === 'string') return resolveImageTemplate(value.src, node);
    if (typeof value.urlTemplate === 'string') return resolveImageTemplate(value.urlTemplate, node);
    if (typeof value.imageUrlTemplate === 'string') return resolveImageTemplate(value.imageUrlTemplate, node);
  }
  return undefined;
}

function resolveImageTemplate(template: string, node: any): string {
  let resolved = template;
  const imageId =
    node?.imageId ||
    node?.imageID ||
    node?.image?.id ||
    node?.image?.imageId ||
    node?.media?.images?.[0]?.id ||
    node?.media?.images?.[0]?.imageId ||
    node?.colourwayImage?.id ||
    node?.colourwayImageId ||
    (Array.isArray(node?.imageIds) ? node.imageIds[0] : node?.imageIds) ||
    node?.productId ||
    node?.id;

  const productId = node?.productId || node?.id;

  if (imageId) {
    resolved = resolved
      .replace(/\{imageId\}/gi, String(imageId))
      .replace(/\{image_id\}/gi, String(imageId))
      .replace(/\{\{imageId\}\}/gi, String(imageId))
      .replace(/\{\{image_id\}\}/gi, String(imageId))
      .replace(/\$image\$/gi, String(imageId))
      .replace(/\$imageid\$/gi, String(imageId))
      .replace(/\$imageId\$/gi, String(imageId));
  }

  if (productId) {
    resolved = resolved
      .replace(/\{productId\}/gi, String(productId))
      .replace(/\{product_id\}/gi, String(productId));
  }

  return resolved;
}

function extractImageFromElement(img: HTMLImageElement | null): string | undefined {
  if (!img) return undefined;

  if (img.currentSrc) return img.currentSrc;

  const candidates = [
    img.getAttribute('src'),
    img.getAttribute('data-src'),
    img.getAttribute('data-lazy'),
    img.getAttribute('data-lazy-src'),
    img.getAttribute('data-original'),
    img.getAttribute('data-srcset'),
    img.getAttribute('srcset'),
    img.getAttribute('data-image-src'),
    img.getAttribute('data-image'),
    img.getAttribute('data-img'),
    img.getAttribute('data-zoom-image'),
    img.getAttribute('data-imagesrc'),
    img.getAttribute('data-image-url')
  ].filter(Boolean) as string[];

  for (const raw of candidates) {
    const value = raw.includes(',') ? parseSrcset(raw) || raw : raw;
    if (value) return value;
  }

  const styleAttr = img.getAttribute('style') || '';
  const bgMatch = styleAttr.match(/background-image:\s*url\(["']?([^"')]+)["']?\)/i);
  if (bgMatch?.[1]) return bgMatch[1];

  return undefined;
}

function extractImageFromTile(tile: Element | null): string | undefined {
  if (!tile) return undefined;

  const img = tile.querySelector('img') as HTMLImageElement | null;
  const fromImg = extractImageFromElement(img);
  if (fromImg) return fromImg;

  const picture = tile.querySelector('picture');
  if (picture) {
    const source = picture.querySelector('source') as HTMLSourceElement | null;
    const srcset =
      source?.getAttribute('srcset') ||
      source?.getAttribute('data-srcset') ||
      source?.getAttribute('data-src');
    const parsed = srcset ? parseSrcset(srcset) || srcset : undefined;
    if (parsed) return parsed;
  }

  const attrCandidates = [
    'data-image-url',
    'data-image',
    'data-img',
    'data-thumbnail',
    'data-thumb',
    'data-src',
    'data-srcset',
    'data-lazy',
    'data-lazy-src'
  ];
  for (const attr of attrCandidates) {
    const raw = (tile as HTMLElement).getAttribute?.(attr);
    if (raw) {
      const parsed = raw.includes(',') ? parseSrcset(raw) || raw : raw;
      if (parsed) return parsed;
    }
  }

  const styleAttr = (tile as HTMLElement).getAttribute?.('style') || '';
  const bgMatch = styleAttr.match(/background-image:\s*url\(["']?([^"')]+)["']?\)/i);
  if (bgMatch?.[1]) return bgMatch[1];

  return undefined;
}

function normalizeTitle(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function extractTitleFromTile(tile: Element, fallbackAnchor?: HTMLAnchorElement | null): string | undefined {
  const title =
    (tile.querySelector('[data-auto-id="productTileDescription"]') as HTMLElement | null)?.textContent?.trim() ||
    (tile.querySelector('[data-testid*="productTileDescription"]') as HTMLElement | null)?.textContent?.trim() ||
    (tile.querySelector('[data-testid*="productTitle"]') as HTMLElement | null)?.textContent?.trim() ||
    (tile.querySelector('[data-testid*="productName"]') as HTMLElement | null)?.textContent?.trim() ||
    (tile.querySelector('[data-qa*="productName"]') as HTMLElement | null)?.textContent?.trim() ||
    fallbackAnchor?.getAttribute('aria-label')?.trim() ||
    (tile.querySelector('img') as HTMLImageElement | null)?.alt?.trim() ||
    fallbackAnchor?.textContent?.trim() ||
    '';

  return title || undefined;
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

function extractReviewsValue(node: any): string | undefined {
  if (!node || typeof node !== 'object') return undefined;
  const rating =
    node.rating ??
    node.ratingValue ??
    node.averageRating ??
    node.reviewAverage ??
    node.review?.ratingValue ??
    node.reviewRating?.ratingValue;
  const count =
    node.reviewCount ??
    node.ratingCount ??
    node.totalReviewCount ??
    node.numberOfReviews;

  if (!rating && !count) return undefined;
  const ratingText = rating ? `${rating}★` : '';
  const countText = count ? `(${count})` : '';
  return `${ratingText} ${countText}`.trim();
}
function productFromJsonLd(node: any, base: URL): ShoppingItem | null {
  const name = extractText(node.name);
  const url = extractText(node.url);
  if (!name || !url) return null;

  const image = extractImageValue(node.image, node);
  const brand = extractText(node.brand);
  const offers = node.offers || node.offer || node.priceSpecification;
  const price = extractPrice(offers);
  const reviews = extractReviewsValue(node);

  const fullUrl = normalizeUrl(url, base);
  if (!fullUrl) return null;

  return {
    title: name.trim(),
    href: fullUrl,
    price,
    brand,
    image: image ? normalizeUrl(image, base) || image : undefined,
    reviews
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
      const reviews = extractReviewsValue(node);
      const template =
        node.imageUrlTemplate ||
        node.imageTemplate ||
        node.imageUrl ||
        node.image ||
        node.primaryImage ||
        node.mainImage ||
        node.colourwayImage?.url ||
        node.colourwayImageUrl ||
        node.media?.imageUrlTemplate ||
        node.media?.images?.[0]?.urlTemplate ||
        node.media?.images?.[0]?.imageUrlTemplate ||
        node.media?.images?.[0]?.url;

      const image = extractImageValue(template, node);

      if (name && url) {
        const fullUrl = normalizeUrl(String(url), base);
        if (fullUrl && fullUrl.includes('asos.com')) {
          pushItem({
            title: String(name).trim(),
            href: fullUrl,
            price,
            brand: brand ? String(brand).trim() : undefined,
            image: image ? normalizeUrl(String(image), base) || String(image) : undefined,
            reviews
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

    const title = extractTitleFromTile(tile, anchor) || '';
    if (!title) return;

    const priceText =
      (tile.querySelector('[data-auto-id="productTilePrice"]') as HTMLElement | null)?.textContent?.trim() ||
      (tile.querySelector('[data-testid*="price"]') as HTMLElement | null)?.textContent?.trim() ||
      (tile.querySelector('[data-qa*="price"]') as HTMLElement | null)?.textContent?.trim() ||
      (tile.querySelector('[data-auto-id="productTilePrice"] span') as HTMLElement | null)?.textContent?.trim() ||
      '';

    const reviewsText =
      (tile.querySelector('[data-testid*="rating"]') as HTMLElement | null)?.textContent?.trim() ||
      (tile.querySelector('[data-qa*="rating"]') as HTMLElement | null)?.textContent?.trim() ||
      (tile.querySelector('[data-auto-id*="rating"]') as HTMLElement | null)?.textContent?.trim() ||
      undefined;

    const image = extractImageFromTile(tile);

    seen.add(href);
    items.push({
      title,
      href,
      price: priceText || undefined,
      image: image ? normalizeUrl(image, base) || image : undefined,
      reviews: reviewsText
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

    const image = extractImageFromTile(link as Element);

    seen.add(fullUrl);
    items.push({
      title,
      href: fullUrl,
      image: image ? normalizeUrl(image, base) || image : undefined
    });
  });

  return items;
}

function enrichImagesFromDom(items: ShoppingItem[], doc: Document, base: URL) {
  const imageByHref = new Map<string, string>();
  const imageByTitle = new Map<string, string>();
  const imageByPath = new Map<string, string>();
  const imageByProductId = new Map<string, string>();

  const anchors = doc.querySelectorAll('a[href*="/prd/"], a[href*="/product/"]');
  anchors.forEach(anchor => {
    const href = normalizeUrl(anchor.getAttribute('href') || '', base);
    if (!href) return;

    const tile =
      (anchor.closest('[data-auto-id="productTile"]') as HTMLElement | null) ||
      (anchor.closest('[data-testid*="product"]') as HTMLElement | null) ||
      (anchor.closest('article') as HTMLElement | null) ||
      (anchor.closest('li') as HTMLElement | null);

    const img =
      (anchor.querySelector('img') as HTMLImageElement | null) ||
      (tile?.querySelector('img') as HTMLImageElement | null);

    const image = extractImageFromTile(tile || anchor);
    if (image) {
      const normalized = normalizeUrl(image, base) || image;
      if (!imageByHref.has(href)) {
        imageByHref.set(href, normalized);
      }

      const pathKey = (() => {
        try {
          const url = new URL(href);
          return `${url.origin}${url.pathname}`;
        } catch {
          return href;
        }
      })();
      if (!imageByPath.has(pathKey)) {
        imageByPath.set(pathKey, normalized);
      }

      const productIdMatch = href.match(/\/prd\/(\d+)/i);
      if (productIdMatch?.[1] && !imageByProductId.has(productIdMatch[1])) {
        imageByProductId.set(productIdMatch[1], normalized);
      }

      const title = tile ? extractTitleFromTile(tile, anchor) : undefined;
      if (title) {
        const key = normalizeTitle(title);
        if (!imageByTitle.has(key)) {
          imageByTitle.set(key, normalized);
        }
      }
    }
  });

  items.forEach(item => {
    if (!item.href) return;
    if (!item.image || item.image.includes('{')) {
      const match = imageByHref.get(item.href);
      if (match) {
        item.image = match;
        return;
      }

      const pathKey = (() => {
        try {
          const url = new URL(item.href);
          return `${url.origin}${url.pathname}`;
        } catch {
          return item.href;
        }
      })();
      const pathMatch = imageByPath.get(pathKey);
      if (pathMatch) {
        item.image = pathMatch;
        return;
      }

      const productIdMatch = item.href.match(/\/prd\/(\d+)/i);
      if (productIdMatch?.[1]) {
        const productMatch = imageByProductId.get(productIdMatch[1]);
        if (productMatch) {
          item.image = productMatch;
          return;
        }
      }

      if (item.title) {
        const titleMatch = imageByTitle.get(normalizeTitle(item.title));
        if (titleMatch) {
          item.image = titleMatch;
          return;
        }
      }
    }
  });
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
  enrichImagesFromDom(combined, doc, base);
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
    modeLabel: 'shopping',
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
          modeLabel: 'shopping',
          searchBox: true
        }
      };
    }

    return {
      template: 'shopping',
      data
    };
  }
};
