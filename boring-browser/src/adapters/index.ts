// Adapter registry and main transform function

import { Adapter, AdapterResult } from './types';
import { youtubeAdapter } from './youtube';
import { googleAdapter } from './google';
import { duckDuckGoAdapter } from './duckduckgo';
import { bbcAdapter } from './bbc';
import { asosAdapter } from './asos';
import { amazonAdapter } from './amazon';
import { newsGenericAdapter } from './newsGeneric';
import { genericArticleAdapter } from './articleGeneric';

// Add new adapters here to extend coverage.
const adapters: Adapter[] = [
  youtubeAdapter,
  googleAdapter,
  duckDuckGoAdapter,
  bbcAdapter,
  asosAdapter,
  amazonAdapter,
  newsGenericAdapter,
  genericArticleAdapter
].sort((a, b) => (b.priority || 0) - (a.priority || 0));

export function runTransform(url: string, doc: Document): AdapterResult {
  const urlObj = new URL(url);

  for (const adapter of adapters) {
    try {
      if (!adapter.match(urlObj, doc)) continue;
      const result = adapter.extract(urlObj, doc);
      if (result) {
        return result;
      }
    } catch (error) {
      console.error(`[Adapter Error] ${adapter.id}`, error);
    }
  }

  return {
    template: 'fallback',
    data: { url }
  };
}
