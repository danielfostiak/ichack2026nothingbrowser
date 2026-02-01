# ICHack2026: Anti-Dopamine Browser - AI Coding Guide

## Project Overview
An Electron-based browser that strips distracting elements from websites (YouTube, Amazon, news sites) and presents content in a minimal, "boring" interface to reduce dopamine-driven browsing behaviors.

## Architecture: Two-Phase Rendering Pattern

### Core Concept: Scrape → Template
Sites with `template.html` (Amazon, shopping) use a unique state machine:
1. **Phase 1 (scraping)**: Load real site in **hidden** BrowserView (`hidePage=true`, `opacity:0`)
2. **Phase 2 (template)**: Extract data via `inject.js`, load custom `template.html`, send data

### Key Files
- `main.js` (lines 1-402): Main process orchestration, state machine, IPC handlers
- `boring-modules/<site>/inject.js`: Extraction logic (returns structured data)
- `boring-modules/<site>/template.html` + `template.js`: Render extracted data in minimal UI

### State Variables (main.js)
```javascript
scrapingState = null | { phase:'scraping', module } | { phase:'template', module, data }
checkoutInProgress = false  // blocks scraping state machine
hidePage = false  // triggers opacity:0 injection in dom-ready
```

## Site Module System

### Detection
`getSiteModule(hostname)` maps domains → module names (youtube, amazon, news, shopping)

### Two Rendering Paths
1. **Template sites** (`hasTemplate()` = true): Amazon, shopping sites
   - Uses scrape→template flow
   - `inject.js` returns data object (not rendering)
   - Example: `boring-modules/amazon/inject.js` returns `{ type, products, origin }`

2. **Overlay sites** (`hasTemplate()` = false): YouTube, news
   - Injects CSS/JS overlays directly onto real page
   - `inject.js` modifies DOM in-place
   - Applied in `injectBoringMode()` after navigation

### Adding New Sites
1. Create `boring-modules/<site>/` directory
2. Add to `getSiteModule()` hostname detection
3. **For overlay**: `inject.js` + `style.css` (modify real DOM)
4. **For template**: `inject.js` (return data), `template.html`, `template.js`

## Critical Electron Patterns

### BrowserView Architecture
- `mainWindow`: UI chrome (64px top bar, see `index.html`)
- `view`: Persistent BrowserView showing web content
- View bounds: `{ x:0, y:64, width:w, height:h-64 }` (hidden during scraping: off-screen or opacity:0)

### Preload Scripts (contextIsolation)
- `ui_preload.js`: Address bar/buttons → `window.api.*`
- `view_preload.js`: Template sites → `window.boringAPI.*`, article extraction → Readability
- `reader_preload.js`: Reader mode window → `window.readerAPI.*`

### Session Persistence
```javascript
session.fromPartition("persist:main")  // cookies/logins persist across restarts
```

## Amazon Checkout Flow (main.js lines 281-374)
1. Set `checkoutInProgress=true`, `hidePage=true`
2. For each cart item:
   - Load product page (`/dp/{ASIN}`)
   - Poll for `#add-to-cart-form` (up to 8s)
   - Extract form fields + CSRF tokens
   - POST to `/gp/buy/shared/ajax/addToCart`
3. Navigate to `/cart` (visible), set `checkoutInProgress=false`

**Why**: Amazon requires real session cookies + CSRF tokens; must POST from actual logged-in session.

## Reader Mode
- Uses `@mozilla/readability` + `dompurify` for article extraction
- Triggered via "Reader Mode" button → `ipcMain.on("reader:extract")`
- Opens separate BrowserWindow with sanitized article content
- Images hidden by default; user can reveal with "Reveal images" button

## Development Workflow

### Run
```bash
npm start  # launches Electron app
```

### Key Navigation Events (main.js)
- `will-navigate`: Renderer-initiated (link clicks) → set scraping state
- `did-navigate`: Update URL bar
- `did-finish-load`: Execute state machine (scrape/template phases)
- `dom-ready`: Inject `opacity:0` if `hidePage=true`

### Debugging State Machine
Look for console logs: `[Boring Mode]`, `[Checkout]`

## Global Styling
- `boring-modules/global.css`: OKLCH monochrome theme (lines 1-359)
- CSS variables: `--bg`, `--fg`, `--card`, `--border`, `--muted-fg`, `--hover-border`
- Applied to all sites when boring mode enabled

## Known Patterns

### LocalStorage in Templates
`template.js` files use localStorage for:
- Cart persistence: `boring-amazon-cart`
- Search history: `boring-amazon-last-search`

### IPC Message Flow
```
UI → Main: nav:go, nav:back, boring:toggle, reader:extract
Main → View: boring:data (template data), extract-article (reader trigger)
View → Main: article-extracted (reader result), boring:checkout (cart items)
Main → UI: ui:url, ui:toast, ui:boring-state
```

## Next.js Sub-Project
`distraction-free-youtube/` is a standalone Next.js app (unused in Electron build). Ignore unless explicitly working on web version.

## Anti-Patterns to Avoid
- Don't modify `inject.js` to render DOM for template sites (return data only)
- Don't call `view.setBounds()` during scraping (must stay hidden/off-screen)
- Don't forget to set `hidePage=false` after template loads (or page stays invisible)
- Don't mix overlay and template approaches for the same site
