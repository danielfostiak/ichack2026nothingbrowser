// BBC News adapter

import { ListPageData, ListItem } from '../ui/templates';

export function extractBBCList(doc: Document): ListPageData {
  const items: ListItem[] = [];
  const seen = new Set<string>();

  // Find all links on the page
  const links = doc.querySelectorAll('a[href]');

  links.forEach(link => {
    const href = link.getAttribute('href');
    const text = link.textContent?.trim() || '';

    if (!href || !text) return;

    // Filter for reasonable headline length
    if (text.length < 25 || text.length > 120) return;

    // Build absolute URL
    let fullUrl = href;
    if (href.startsWith('/')) {
      fullUrl = 'https://www.bbc.com' + href;
    } else if (!href.startsWith('http')) {
      return;
    }

    // Only include BBC links
    if (!fullUrl.includes('bbc.com') && !fullUrl.includes('bbc.co.uk')) return;

    // Skip duplicate titles
    if (seen.has(text)) return;
    seen.add(text);

    items.push({
      title: text,
      href: fullUrl
    });
  });

  // Limit to first 30 items
  const limitedItems = items.slice(0, 30);

  return {
    title: 'BBC News',
    items: limitedItems,
    modeLabel: 'News List'
  };
}
