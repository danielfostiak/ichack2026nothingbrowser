// Generic article adapter using Mozilla Readability

import { Readability } from '@mozilla/readability';
import { ArticlePageData } from '../ui/templates';

export function extractGenericArticle(doc: Document): ArticlePageData | null {
  // Clone document for Readability (it modifies the DOM)
  const documentClone = doc.cloneNode(true) as Document;

  const reader = new Readability(documentClone);
  const article = reader.parse();

  if (!article) {
    return null;
  }

  return {
    title: article.title || 'Untitled Article',
    byline: article.byline || undefined,
    contentHTML: article.content || '<p>No content available</p>',
    modeLabel: 'Article'
  };
}
