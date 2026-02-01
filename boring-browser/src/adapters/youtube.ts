// YouTube adapter - FAKED FOR DEMO

import { ListPageData, VideoPageData, ListItem } from '../ui/templates';

export function extractYouTubeList(doc: Document, url: string): ListPageData {
  // FAKE YOUTUBE FOR DEMO - hardcoded videos
  // User can customize these fake videos
  const fakeVideos: ListItem[] = [
    {
      title: 'building a browser from scratch - complete tutorial',
      href: 'https://www.youtube.com/watch?v=FAKE_VIDEO_1'
    },
    {
      title: 'electron app development - best practices 2026',
      href: 'https://www.youtube.com/watch?v=FAKE_VIDEO_2'
    },
    {
      title: 'typescript advanced patterns - full course',
      href: 'https://www.youtube.com/watch?v=FAKE_VIDEO_3'
    },
    {
      title: 'web performance optimization techniques',
      href: 'https://www.youtube.com/watch?v=FAKE_VIDEO_4'
    },
    {
      title: 'modern css layout - complete guide',
      href: 'https://www.youtube.com/watch?v=FAKE_VIDEO_5'
    },
    {
      title: 'javascript runtime deep dive',
      href: 'https://www.youtube.com/watch?v=FAKE_VIDEO_6'
    },
    {
      title: 'building minimal uis - design philosophy',
      href: 'https://www.youtube.com/watch?v=FAKE_VIDEO_7'
    },
    {
      title: 'content security policy explained',
      href: 'https://www.youtube.com/watch?v=FAKE_VIDEO_8'
    },
    {
      title: 'dom manipulation performance tips',
      href: 'https://www.youtube.com/watch?v=FAKE_VIDEO_9'
    },
    {
      title: 'zero-flicker page transitions',
      href: 'https://www.youtube.com/watch?v=FAKE_VIDEO_10'
    }
  ];

  // Get search query from URL
  const urlObj = new URL(url);
  const searchQuery = urlObj.searchParams.get('search_query') || '';

  return {
    title: searchQuery ? `youtube - ${searchQuery}` : 'youtube',
    items: fakeVideos,
    modeLabel: 'videos (demo)',
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
        <div style="font-size: 18px; color: #888; margin-bottom: 8px;">demo video player</div>
        <div style="font-size: 14px; color: #666;">
          video playback simulated for demo purposes
        </div>
      </div>
    </div>
  `;

  return {
    title: 'demo video - boring browser showcase',
    playerHTML: fakePlayerHTML,
    modeLabel: 'video (demo)'
  };
}
