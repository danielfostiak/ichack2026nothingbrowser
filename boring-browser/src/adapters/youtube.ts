// YouTube adapter - real list extraction + real embed playback

import { Adapter, AdapterResult } from './types';
import { ListPageData, VideoPageData, ListItem } from '../ui/templates';

function isYouTube(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  return hostname.includes('youtube.com') || hostname.includes('youtu.be');
}

function extractVideoId(url: URL): string | null {
  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname;

  if (hostname.includes('youtu.be')) {
    const id = pathname.replace('/', '').trim();
    return id || null;
  }

  if (pathname.startsWith('/watch')) {
    return url.searchParams.get('v');
  }

  if (pathname.startsWith('/shorts/')) {
    const parts = pathname.split('/');
    return parts[2] || null;
  }

  if (pathname.startsWith('/embed/')) {
    const parts = pathname.split('/');
    return parts[2] || null;
  }

  return null;
}

function isYouTubeWatch(url: URL): boolean {
  return extractVideoId(url) !== null;
}

function extractJsonFromText(source: string, marker: string): any | null {
  const idx = source.indexOf(marker);
  if (idx === -1) return null;

  const eqIdx = source.indexOf('=', idx);
  const braceIdx = source.indexOf('{', eqIdx);
  if (eqIdx === -1 || braceIdx === -1) return null;

  let depth = 0;
  let inString = false;
  let stringChar = '';
  let escape = false;
  let endIdx = -1;

  for (let i = braceIdx; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\\\') {
        escape = true;
      } else if (ch === stringChar) {
        inString = false;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      continue;
    }

    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (depth === 0) {
      endIdx = i;
      break;
    }
  }

  if (endIdx === -1) return null;

  const jsonText = source.slice(braceIdx, endIdx + 1);
  try {
    return JSON.parse(jsonText);
  } catch (error) {
    console.warn('[YouTube Adapter] Failed to parse initial data JSON:', error);
    return null;
  }
}

function extractInitialData(doc: Document): any | null {
  const win = doc.defaultView as any;
  if (win && win.ytInitialData) {
    return win.ytInitialData;
  }

  const scripts = doc.querySelectorAll('script');
  for (const script of scripts) {
    const text = script.textContent || '';
    if (!text.includes('ytInitialData')) continue;
    const data = extractJsonFromText(text, 'ytInitialData');
    if (data) return data;
  }

  const html = doc.documentElement?.innerHTML || '';
  if (html.includes('ytInitialData')) {
    return extractJsonFromText(html, 'ytInitialData');
  }

  return null;
}

function collectVideoRenderers(data: any): any[] {
  const results: any[] = [];
  const stack = [data];

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;

    if (Array.isArray(node)) {
      for (const item of node) {
        stack.push(item);
      }
      continue;
    }

    if (typeof node !== 'object') continue;

    if (node.videoRenderer) results.push(node.videoRenderer);
    if (node.gridVideoRenderer) results.push(node.gridVideoRenderer);
    if (node.compactVideoRenderer) results.push(node.compactVideoRenderer);
    if (node.richItemRenderer?.content?.videoRenderer) {
      results.push(node.richItemRenderer.content.videoRenderer);
    }

    for (const key of Object.keys(node)) {
      stack.push(node[key]);
    }
  }

  return results;
}

function getTitleFromRenderer(renderer: any): string | null {
  const title = renderer.title;
  if (!title) return null;
  if (title.simpleText) return title.simpleText;
  if (Array.isArray(title.runs)) {
    return title.runs.map((run: any) => run.text).join('');
  }
  return null;
}

function getThumbnailFromRenderer(renderer: any): string | undefined {
  const thumbs =
    renderer.thumbnail?.thumbnails ||
    renderer.richThumbnail?.movingThumbnailRenderer?.movingThumbnailDetails?.thumbnails ||
    [];

  if (!Array.isArray(thumbs) || thumbs.length === 0) return undefined;
  return thumbs[thumbs.length - 1]?.url;
}

export function extractYouTubeList(doc: Document, url: URL): ListPageData {
  const searchQuery = url.searchParams.get('search_query') || '';
  const title = searchQuery ? `YouTube - ${searchQuery}` : 'YouTube';

  const data = extractInitialData(doc);
  const renderers = data ? collectVideoRenderers(data) : [];
  const items: ListItem[] = [];
  const seen = new Set<string>();

  const pushItem = (videoId: string, itemTitle: string) => {
    if (!videoId || seen.has(videoId) || !itemTitle) return;
    seen.add(videoId);
    items.push({
      title: itemTitle,
      href: `https://www.youtube.com/watch?v=${videoId}`
    });
  };

  renderers.forEach(renderer => {
    const videoId = renderer.videoId;
    const titleText = getTitleFromRenderer(renderer);
    if (!videoId || !titleText) return;
    pushItem(videoId, titleText);
  });

  if (items.length === 0) {
    const nodes = doc.querySelectorAll(
      'ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer'
    );

    nodes.forEach(node => {
      const anchor = node.querySelector('a#video-title, a#video-title-link, a#thumbnail') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      if (!href.includes('/watch')) return;
      const videoUrl = new URL(href, 'https://www.youtube.com');
      const videoId = videoUrl.searchParams.get('v');
      if (!videoId) return;

      const titleText =
        (node.querySelector('#video-title') as HTMLElement | null)?.textContent?.trim() ||
        anchor.getAttribute('title')?.trim() ||
        anchor.textContent?.trim() ||
        '';

      pushItem(videoId, titleText);
    });
  }

  if (items.length === 0) {
    items.push({
      title: 'No videos found yet — try searching above.',
      href: `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery || 'trending')}`
    });
  }

  return {
    title,
    items,
    modeLabel: 'Videos',
    searchBox: true
  };
}

export function extractYouTubeWatch(doc: Document, url: URL): VideoPageData {
  const videoId = extractVideoId(url);
  const title =
    doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
    doc.title ||
    'YouTube Video';

  if (!videoId) {
    return {
      title: 'Video unavailable',
      playerHTML: '<div>Could not parse YouTube video ID.</div>',
      modeLabel: 'Video'
    };
  }

  const playerHTML = `
    <div id="boring-player-slot" data-video-id="${videoId}">
      <div class="boring-video-placeholder">Loading video…</div>
    </div>
  `;

  return {
    title,
    playerHTML,
    modeLabel: 'Video'
  };
}

export const youtubeAdapter: Adapter = {
  id: 'youtube',
  priority: 100,
  match: (url) => isYouTube(url),
  extract: (url, doc): AdapterResult => {
    if (isYouTubeWatch(url)) {
      return {
        template: 'video',
        data: extractYouTubeWatch(doc, url)
      };
    }

    return {
      template: 'list',
      data: extractYouTubeList(doc, url)
    };
  }
};
