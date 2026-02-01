// YouTube adapter - FAKED FOR DEMO

import { ListPageData, VideoPageData, ListItem } from '../ui/templates';

export function extractYouTubeList(doc: Document, url: string): ListPageData {
  // FAKE YOUTUBE FOR DEMO - hardcoded videos
  // User can customize these fake videos
  const fakeVideos: ListItem[] = [
    {
      title: 'The wild rise of OpenClaw...',
      href: 'https://www.youtube.com/watch?v=FAKE_VIDEO_1'
    },
    {
      title: 'Top 10 Most Heated Debates of 2025 | Surrounded',
      href: 'https://www.youtube.com/watch?v=FAKE_VIDEO_2'
    },
    {
      title: 'malloc, calloc, free from scratch in C',
      href: 'https://www.youtube.com/watch?v=FAKE_VIDEO_3'
    },
    {
      title: 'Rats have a slap fight',
      href: 'https://www.youtube.com/watch?v=FAKE_VIDEO_4'
    },
    {
      title: 'Most insane poker hand ever',
      href: 'https://www.youtube.com/watch?v=FAKE_VIDEO_5'
    },
    {
      title: 'Jon Jones vs Daniel Cormier | FULL FIGHT',
      href: 'https://www.youtube.com/watch?v=FAKE_VIDEO_6'
    },
    {
      title: 'Entire History of London in 24 Minutes',
      href: 'https://www.youtube.com/watch?v=FAKE_VIDEO_7'
    },
    {
      title: 'Elons SpaceX Tour - Offices',
      href: 'https://www.youtube.com/watch?v=FAKE_VIDEO_8'
    },
    {
      title: 'DELETED SCENES - THE INBETWEENERS MOVIE',
      href: 'https://www.youtube.com/watch?v=FAKE_VIDEO_9'
    },
    {
      title: 'I thought I could code chess',
      href: 'https://www.youtube.com/watch?v=FAKE_VIDEO_10'
    }
  ];

  // Get search query from URL
  const urlObj = new URL(url);
  const searchQuery = urlObj.searchParams.get('search_query') || '';

  return {
    title: searchQuery ? `YouTube - ${searchQuery}` : 'YouTube',
    items: fakeVideos,
    modeLabel: 'Videos (Demo)',
    searchBox: true
  };
}

export function extractYouTubeWatch(doc: Document): VideoPageData {
  // FAKE YOUTUBE VIDEO PLAYER FOR DEMO
  // Since CSP blocks real player, show a fake player placeholder

  const fakePlayerHTML = `
    <div style="
      width: 100%;
      aspect-ratio: 16/9;
      background: linear-gradient(135deg, #1a1a1c 0%, #2a2a2c 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      border: 1px solid #3a3a3c;
    ">
      <div style="text-align: center; padding: 40px;">
        <div style="font-size: 64px; margin-bottom: 16px; opacity: 0.5;">▶</div>
        <div style="font-size: 18px; color: #888; margin-bottom: 8px;">Demo Video Player</div>
        <div style="font-size: 14px; color: #666;">
          Video playback simulated for demo purposes
        </div>
      </div>
    </div>
  `;

  return {
    title: 'Demo Video - Boring Browser Showcase',
    playerHTML: fakePlayerHTML,
    modeLabel: 'Video (Demo)'
  };
}
