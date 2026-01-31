// Adapter registry and main transform function

import { PageMode, classifyPage } from './classify';
import { extractGenericArticle } from './articleGeneric';
import { extractBBCList } from './bbc';
import { extractYouTubeList, extractYouTubeWatch } from './youtube';
import { extractGoogleSearch } from './google';
import { extractASOSProducts } from './asos';
import {
  renderArticlePage,
  renderListPage,
  renderVideoPage,
  renderFallback
} from '../ui/templates';

export function runTransform(url: string, doc: Document): string {
  const mode = classifyPage(url, doc);

  try {
    switch (mode) {
      case PageMode.YOUTUBE_WATCH: {
        const data = extractYouTubeWatch(doc);
        return renderVideoPage(data);
      }

      case PageMode.YOUTUBE_LIST: {
        const data = extractYouTubeList(doc, url);
        return renderListPage(data);
      }

      case PageMode.BBC_HOME_LIST: {
        const data = extractBBCList(doc);
        return renderListPage(data);
      }

      case PageMode.GOOGLE_SEARCH: {
        const data = extractGoogleSearch(doc, url);
        return renderListPage(data);
      }

      case PageMode.ASOS_PRODUCTS: {
        const data = extractASOSProducts(doc, url);
        return renderListPage(data);
      }

      case PageMode.ARTICLE_GENERIC: {
        const data = extractGenericArticle(doc);
        if (data) {
          return renderArticlePage(data);
        }
        return renderFallback(url);
      }

      case PageMode.FALLBACK:
      default:
        // Try generic article as fallback
        const articleData = extractGenericArticle(doc);
        if (articleData) {
          return renderArticlePage(articleData);
        }
        return renderFallback(url);
    }
  } catch (error) {
    console.error('Transform error:', error);
    return renderFallback(url);
  }
}

export { PageMode } from './classify';
