// Adapter template - copy this file to add a new site adapter.

import { Adapter, AdapterResult } from './types';
import { ListPageData } from '../ui/templates';

function isTargetSite(url: URL): boolean {
  return url.hostname.toLowerCase().includes('example.com');
}

function extractExampleList(_doc: Document, url: URL): ListPageData {
  return {
    title: `example site - ${url.hostname}`.toLowerCase(),
    items: [
      { title: 'example item', href: url.toString() }
    ],
    modeLabel: 'example list',
    searchBox: false
  };
}

export const exampleAdapter: Adapter = {
  id: 'example-site',
  priority: 50,
  match: (url) => isTargetSite(url),
  extract: (url, doc): AdapterResult => {
    const data = extractExampleList(doc, url);
    return {
      template: 'list',
      data
    };
  }
};
