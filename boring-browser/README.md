# Boring Browser

A minimal Electron browser that transforms websites into clean, uniform UIs with **zero flicker**. Never see the original page during navigation or refresh - only our minimal interface.

## Features

- **Zero Flicker**: Original page DOM is hidden immediately at `document_start` and only revealed after transformation
- **Minimal UIs by Category**:
  - **News Lists**: BBC News homepage shows clean headline list
  - **Articles**: Any article page uses Mozilla Readability for clean reading
  - **YouTube**: Search/list view and clean video watch page
  - **Fallback**: Generic reader mode for unsupported sites
- **Browser Chrome**: Full URL bar, back/forward/refresh navigation
- **Minimal Mode Toggle**: Switch between transformed and original views

## Quick Start

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev

# Or just start if already built
npm start
```

## Testing the Demo

The browser launches with BBC News loaded. Try this workflow:

1. **BBC News Homepage**: See clean list of headlines (no original BBC layout visible)
2. **Click any headline**: Loads article in reader view
3. **Enter URL**: `youtube.com` → Shows search box and video list
4. **Search on YouTube**: Enter query and press Enter
5. **Click a video**: Watch page shows only player and back button
6. **SPA Navigation**: YouTube navigation (clicking related videos) works without flicker

## How It Works

### Architecture

```
main.ts          → Electron main process + BrowserView + chrome UI
preload.ts       → Document-start script that hides & transforms pages
adapters/        → Page classifiers and extractors
  classify.ts    → Determines page type (article, list, video, etc.)
  bbc.ts         → BBC News list extractor
  youtube.ts     → YouTube list and watch extractors
  articleGeneric.ts → Mozilla Readability integration
ui/
  templates.ts   → HTML generators for each view type
  styles.css     → Shared minimal theme
```

### Zero-Flicker Mechanism

1. **Immediate Veil** (document_start):
   ```typescript
   document.documentElement.style.visibility = 'hidden'
   ```

2. **Classification**: Determine page type (BBC list, article, YouTube, etc.)

3. **Extraction**: Use adapter to extract content (headlines, article text, video player)

4. **Render**: Replace entire `<html>` with our minimal UI

5. **Reveal**: Remove veil, show transformed page

6. **SPA Detection**: Monitor URL changes and re-transform without showing original

### Key Files

- [src/preload.ts](src/preload.ts) - The critical zero-flicker implementation
- [src/main.ts](src/main.ts) - Electron shell with BrowserView
- [src/adapters/classify.ts](src/adapters/classify.ts) - Page type detection
- [src/ui/templates.ts](src/ui/templates.ts) - UI rendering functions
- [src/ui/styles.css](src/ui/styles.css) - Shared visual theme

## Adding New Adapters

To add support for a new site:

1. **Add classification rule** in `src/adapters/classify.ts`:
   ```typescript
   export enum PageMode {
     // ...
     MY_SITE_LIST = 'MY_SITE_LIST'
   }

   export function classifyPage(url: string, doc: Document): PageMode {
     if (hostname.includes('mysite.com')) {
       return PageMode.MY_SITE_LIST;
     }
     // ...
   }
   ```

2. **Create extractor** in `src/adapters/mySite.ts`:
   ```typescript
   import { ListPageData } from '../ui/templates';

   export function extractMySiteList(doc: Document): ListPageData {
     // Extract links, titles, etc.
     return { title: 'My Site', items: [...], modeLabel: 'My Site' };
   }
   ```

3. **Register in index** `src/adapters/index.ts`:
   ```typescript
   import { extractMySiteList } from './mySite';

   export function runTransform(url: string, doc: Document): string {
     const mode = classifyPage(url, doc);

     switch (mode) {
       case PageMode.MY_SITE_LIST:
         return renderListPage(extractMySiteList(doc));
       // ...
     }
   }
   ```

4. **Rebuild**: `npm run build`

## Known Limitations

This is a hackathon-quality demo. Known issues:

- **YouTube Player**: May not always extract player correctly due to dynamic loading
- **SPA Detection**: Polling-based (500ms interval) rather than event-driven
- **No Security Hardening**: Not suitable for browsing untrusted sites
- **Limited Site Support**: Only BBC, YouTube, and generic articles work well
- **No Sandboxing**: Preload runs with `sandbox: false` for DOM access
- **No Caching**: Re-transforms on every navigation
- **Style Inheritance**: Some original page styles may leak through

## Performance Notes

- **Readability**: Can be slow on complex pages (300ms+ on large articles)
- **Veil Duration**: Typically 300-500ms from navigation to reveal
- **Build Time**: ~2 seconds for full rebuild

## Browser Controls

- **URL Bar**: Type URL and press Enter (auto-adds https://)
- **Back/Forward**: Navigate history
- **Refresh**: Reload current page with transformation
- **Minimal Mode Toggle**: Switch between transformed and original views (for debugging)

## Tech Stack

- Electron 28
- TypeScript 5
- esbuild (fast bundling)
- Mozilla Readability (article extraction)
- BrowserView API (not webview tags)

## License

MIT
