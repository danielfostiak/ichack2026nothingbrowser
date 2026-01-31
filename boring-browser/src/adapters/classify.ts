// Page classification system

export enum PageMode {
  YOUTUBE_WATCH = 'YOUTUBE_WATCH',
  YOUTUBE_LIST = 'YOUTUBE_LIST',
  BBC_HOME_LIST = 'BBC_HOME_LIST',
  GOOGLE_SEARCH = 'GOOGLE_SEARCH',
  ASOS_PRODUCTS = 'ASOS_PRODUCTS',
  ARTICLE_GENERIC = 'ARTICLE_GENERIC',
  FALLBACK = 'FALLBACK'
}

export function classifyPage(url: string, doc: Document): PageMode {
  const hostname = new URL(url).hostname.toLowerCase();
  const pathname = new URL(url).pathname.toLowerCase();

  // YouTube classification
  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
    if (pathname.includes('/watch')) {
      return PageMode.YOUTUBE_WATCH;
    }
    return PageMode.YOUTUBE_LIST;
  }

  // Google Search classification
  if (hostname.includes('google.com') || hostname.includes('google.')) {
    if (pathname.includes('/search') || new URL(url).searchParams.has('q')) {
      return PageMode.GOOGLE_SEARCH;
    }
  }

  // BBC News classification
  if (hostname.includes('bbc.co.uk') || hostname.includes('bbc.com')) {
    // BBC homepage or news section listing
    if (pathname === '/news' || pathname === '/news/' || pathname === '/' || pathname.match(/^\/news\/?$/)) {
      return PageMode.BBC_HOME_LIST;
    }
    // BBC article pages typically have longer paths
    if (pathname.includes('/news/') && pathname.split('/').length > 3) {
      return PageMode.ARTICLE_GENERIC;
    }
  }

  // ASOS classification
  if (hostname.includes('asos.com')) {
    // ASOS product listings and category pages
    return PageMode.ASOS_PRODUCTS;
  }

  // Generic article detection
  if (looksLikeArticle(doc)) {
    return PageMode.ARTICLE_GENERIC;
  }

  return PageMode.FALLBACK;
}

function looksLikeArticle(doc: Document): boolean {
  // Check for article tag
  if (doc.querySelector('article')) {
    return true;
  }

  // Check for Open Graph article type
  const ogType = doc.querySelector('meta[property="og:type"]');
  if (ogType && ogType.getAttribute('content') === 'article') {
    return true;
  }

  // Check for reasonable article structure (h1 + multiple paragraphs)
  const h1 = doc.querySelector('h1');
  const paragraphs = doc.querySelectorAll('p');

  if (h1 && paragraphs.length >= 3) {
    // Check if there's substantial text content
    let totalTextLength = 0;
    paragraphs.forEach(p => {
      totalTextLength += p.textContent?.length || 0;
    });

    if (totalTextLength > 500) {
      return true;
    }
  }

  return false;
}
