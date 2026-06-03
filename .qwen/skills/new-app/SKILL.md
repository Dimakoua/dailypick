---
name: new-app
description: Scaffold a new mini-app for the Daily Pick project (Eleventy + Cloudflare Workers)
source: auto-skill
extracted_at: '2026-06-03T17:59:04.399Z'
---

# New App Scaffolding — Daily Pick

## Overview
Daily Pick is an Eleventy static site with ~112 browser-based mini-apps. Each app lives under `apps/<app-name>/` and is registered in `content/blog/_data/apps.js`.

## File Structure

Every app needs at minimum:
```
apps/<name>/index.html   # Page with frontmatter + HTML
apps/<name>/style.css    # App-specific styles (if interactive)
apps/<name>/script.js    # Client-side logic (if interactive)
```

## Step 1: Create the HTML page

Use this frontmatter template:

```yaml
---
layout: base_app.njk
title: "<App Name> – <Tagline> | Daily Pick"
description: "<One-line description for SEO>"
keywords: "<comma-separated keywords>"
canonical: "https://dailypick.dev/apps/<name>/"
ogImageAlt: "<Alt text for OG image>"
headExtra: |
  <link href="./style.css" rel="stylesheet" />
  <script defer="" src="./script.js"></script>
---
```

Key rules:
- `layout: base_app.njk` extends `base.njk` with `isApp: true`
- `headExtra` injects app-specific CSS and JS (deferred scripts)
- CSS link must come before JS scripts
- If the app uses shared libraries (e.g., `standup-data.js`), include them before `script.js`

## Step 2: HTML structure

Follow this pattern (from timer, countdown apps):

```html
<main data-page-type="<name>" aria-labelledby="<name>Heading" class="<name>-page">
    <!-- Hero section -->
    <section class="<name>-hero glass-card">
      <div>
        <p class="hero-eyebrow">Category</p>
        <h1 id="<name>Heading">App Name</h1>
        <p>Description paragraph.</p>
      </div>
    </section>

    <!-- Main content grid -->
    <section class="<name>-grid">
      <article aria-labelledby="section1Heading" class="section1-card glass-card">
        <!-- content -->
      </article>
      <article aria-labelledby="section2Heading" class="section2-card glass-card">
        <!-- content -->
      </article>
    </section>

    <!-- SEO content area (required for all apps) -->
    <section class="seo-content-area glass-card">
      <h2>App Name: Full Title for SEO</h2>
      <div class="seo-grid">
        <figure><img src="/assets/images/<name>/..." alt="..." loading="lazy" /><figcaption>...</figcaption></figure>
      </div>
      <div class="seo-toc"><h3>Table of Contents</h3><ol>...</ol></div>
      <section id="what-is-..."><h3>1. What is App Name?</h3><p>...</p></section>
      <!-- 8 TOC sections standard -->
    </section>
</main>
```

## Step 3: CSS patterns

Use these CSS custom properties (defined in `base.njk`):
- `--brand-radius`, `--brand-border`, `--brand-surface`, `--brand-shadow`
- `--brand-heading`, `--brand-text`, `--brand-subtle-text`, `--brand-accent`
- `--app-header-offset` (default `120px`)

CSS file template:
```css
:root {
  --<name>-max-width: 1180px;
}

.<name>-page {
  width: min(var(--<name>-max-width), 95vw);
  margin: calc(var(--app-header-offset, 120px)) auto 96px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}
```

Key patterns:
- `.glass-card` class for card panels (border + background + shadow)
- `.hero-eyebrow` for uppercase category labels
- Responsive breakpoints: 1100px, 900px, 720px, 600px
- Use `clamp()` for responsive font sizes
- Button styles: default (filled accent) and `.ghost` (transparent + dashed border)
- `font-variant-numeric: tabular-nums` for countdown/number displays

## Step 4: Register in apps.js

Add entry to `content/blog/_data/apps.js`:

```javascript
{
  id: "<name>",
  name: "<App Name>",
  path: "/apps/<name>/",
  category: "<category>",   // standup, agile, randomizer, games, food, lottery, fifa-2026, nav
  footerGroup: "<Group>",   // Stand-up, Tools, Randomizers, Games, Food, Lottery, Resources
  emoji: "🔣",
  description: "One-line description for the apps listing page."
}
```

Categories and their footer groups:
- `standup` → "Stand-up"
- `agile` → "Tools"
- `randomizer` → "Randomizers"
- `games` → "Games"
- `food` → "Food"
- `lottery` → "Lottery"
- `fifa-2026` → "Games"
- `nav` → "Resources"

## Step 5: Build and verify

```bash
npx @11ty/eleventy --quiet
```

Verify:
1. Build succeeds (exit code 0)
2. Output files exist in `dist/apps/<name>/`
3. App appears in `dist/` page data (grep for app id)
4. No hardcoded asset paths — use relative `./` for app-local assets

## Multiplayer apps (Durable Objects)

If the app needs real-time multiplayer:
1. Create `apps/<name>/<name>-session.js` extending `BaseEphemeralDO`
2. Add binding to `wrangler.toml` (increment migration tag)
3. Add route in `packages/worker/worker.js`
4. Follow the Planning Poker pattern (`apps/planning-poker/planning-poker-session.js`)

## Common patterns

**localStorage persistence:**
```javascript
const STORAGE_KEY = 'dp_<name>_<data>';
function load() { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
function save(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
```

**URL-based sharing (no backend):**
```javascript
// Encode
const params = new URLSearchParams({ key: value });
const shareUrl = `${location.origin}${location.pathname}?${params}`;
// Decode
const params = new URLSearchParams(location.search);
const value = params.get('key');
```

**Separate share/view page pattern (recommended for shareable apps):**

When an app creates shareable state, use two pages:
1. `index.html` — setup page with forms + event management (uses `base_app.njk` layout)
2. `view.html` — clean page showing just the shared content (uses `base.njk` layout)

Share links point to the view page:
```javascript
// In index.html's script.js — generate share URL pointing to view page
const basePath = location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');
const shareUrl = `${location.origin}${basePath}/view/?${params.toString()}`;
```

**Critical: Eleventy path resolution for view.html**

Eleventy renders `view.html` as `view/index.html` (directory-style URLs). This means:
- The view page lives at `/apps/<name>/view/` not `/apps/<name>/view.html`
- Relative asset paths (`./view.css`) in `view.html` will resolve to `/apps/<name>/view/view.css` — **wrong**
- **Fix:** Use absolute paths in `view.html`'s `headExtra`:
```yaml
headExtra: |
  <link href="/apps/<name>/view.css" rel="stylesheet" />
  <script defer="" src="/apps/<name>/view.js"></script>
```
- CSS/JS files are passthrough-copied to `/apps/<name>/view.css` and `/apps/<name>/view.js`
- Links back to the main page should use absolute paths: `href="/apps/<name>/"`

**View page JS pattern:**
```javascript
// view.js — standalone, reads URL params, no localStorage dependency
(() => {
  const params = new URLSearchParams(location.search);
  const name = params.get('name');
  const dateStr = params.get('date');
  // URLSearchParams.get() already decodes — no need for decodeURIComponent
  if (!name || !dateStr) { showError(); return; }
  const targetDate = new Date(dateStr);
  if (isNaN(targetDate.getTime())) { showError(); return; }
  // Show countdown / shared content
  // Update page title: document.title = `${name} – App | Daily Pick`;
})();
```

**Audio cues (Web Audio API):**
```javascript
function playTone(intensity) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const freq = intensity === 'bold' ? 1040 : intensity === 'medium' ? 880 : 720;
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(0.001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 1.25);
}
```

**Countdown ticker pattern:**
```javascript
let tickerInterval = null;
function startTicker() {
  stopTicker();
  update();
  tickerInterval = setInterval(update, 1000);
}
function stopTicker() {
  if (tickerInterval) { clearInterval(tickerInterval); tickerInterval = null; }
}
function update() {
  const diff = targetDate.getTime() - Date.now();
  const days = Math.floor(Math.abs(diff) / 86400000);
  const hours = Math.floor((Math.abs(diff) % 86400000) / 3600000);
  // ... update DOM
}
```
