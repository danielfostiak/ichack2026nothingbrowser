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
adapters/        → Adapter registry + extractors
  index.ts       → Adapter registry (match + extract)
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
- [src/adapters/index.ts](src/adapters/index.ts) - Adapter registry
- [src/adapters/adapterTemplate.ts](src/adapters/adapterTemplate.ts) - Adapter starter file
- [src/ui/templates.ts](src/ui/templates.ts) - UI rendering functions
- [src/ui/styles.css](src/ui/styles.css) - Shared visual theme

## Adding Adapters + Templates (Only Workflow)

All pages render through adapters and templates. To add a new site, you only need:

1. **Create a new adapter** by copying:
   - `src/adapters/adapterTemplate.ts` → `src/adapters/mySite.ts`

2. **Implement `match` and `extract`** in your adapter:
   ```typescript
   import { Adapter, AdapterResult } from './types';
   import { ListPageData } from '../ui/templates';

   export const mySiteAdapter: Adapter = {
     id: 'my-site',
     priority: 60,
     match: (url) => url.hostname.includes('mysite.com'),
     extract: (url, doc): AdapterResult => {
       const data: ListPageData = {
         title: 'My Site',
         items: [
           { title: 'Example', href: url.toString() }
         ],
         modeLabel: 'My Site'
       };
       return { template: 'list', data };
     }
   };
   ```

3. **Add/extend templates**:
   - Existing templates live in `src/ui/templates.ts`
   - Shared styles live in `src/ui/styles.css`

4. **Register the adapter**:
   - Add your adapter to the list in `src/adapters/index.ts`

5. **Rebuild**: `npm run build`

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
