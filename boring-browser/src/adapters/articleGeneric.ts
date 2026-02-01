// Generic article adapter using Mozilla Readability

import { Readability } from '@mozilla/readability';
import { Adapter, AdapterResult } from './types';
import { ArticlePageData } from '../ui/templates';

function extractGenericArticle(doc: Document): ArticlePageData | null {
  // Clone document for Readability (it modifies the DOM)
  const documentClone = doc.cloneNode(true) as Document;

  const reader = new Readability(documentClone);
  const article = reader.parse();

  if (!article) {
    return null;
  }

  return {
    title: article.title || 'untitled article',
    byline: article.byline || undefined,
    contentHTML: article.content || '<p>No content available</p>',
    modeLabel: 'article'
  };
}

function looksLikeArticle(doc: Document): boolean {
  if (doc.querySelector('article')) {
    return true;
  }

  const ogType = doc.querySelector('meta[property="og:type"]');
  if (ogType && ogType.getAttribute('content') === 'article') {
    return true;
  }

  const h1 = doc.querySelector('h1');
  const paragraphs = doc.querySelectorAll('p');

  if (h1 && paragraphs.length >= 3) {
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

export const genericArticleAdapter: Adapter = {
  id: 'generic-article',
  priority: 10,
  match: (_url, doc) => looksLikeArticle(doc),
  extract: (_url, doc): AdapterResult | null => {
    const data = extractGenericArticle(doc);
    if (!data) return null;

    return {
      template: 'article',
      data
    };
  }
};

export { extractGenericArticle };
