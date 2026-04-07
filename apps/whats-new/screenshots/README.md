Add screenshot images here to appear on the What’s New page.

Naming convention:
- Use the app slug as the filename (lowercase, hyphens). Example: `ballgame.png`, `planning-poker.png`.

Recommended sizes & formats:
- Primary hero images: ~1600×900 (landscape) — PNG or WebP preferred.
- Small card previews: ~1200×720 or 1200×600.

Accessibility:
- Provide descriptive `alt` text for each image describing the visible UI.
- Keep `figcaption` short (1 sentence) and informative.

Examples:
- `/apps/whats-new/screenshots/ballgame.png`
- `/apps/whats-new/screenshots/planning-poker.png`

After adding images, run the site build (if needed) to see them render on the page.

Automated screenshots
---------------------

You can automatically capture screenshots for the pages linked from this What's New page using the included Node utility.

1. Install the screenshot tool dependency:

```bash
npm install --save-dev puppeteer
```

2. Start your local dev server (the script defaults to port 8787 for `wrangler dev`):

```bash
npm run dev
```

3. Run the screenshot script (adjust `--base-url` if your dev server uses a different host/port):

```bash
node scripts/screenshot.js --base-url http://localhost:8787 --out-dir apps/whats-new/screenshots --sizes 1600x900,1200x720
```

Options:
- `--base-url` : base server URL (default `http://localhost:8787`)
- `--out-dir`  : where screenshots are written (default `apps/whats-new/screenshots`)
- `--sizes`    : comma-separated sizes (e.g. `1600x900,1200x720`)
- `--format`   : `png` or `jpeg` (default `png`)
- `--wait`     : extra wait time in ms after page load (default `1000`)
 - `--skip`     : comma-separated URL prefixes or substrings to skip (default `/blog,/apps/whats-new`)

Notes:
- The script reads internal hrefs from `apps/whats-new/index.html` and will skip image paths in the screenshots folder.
- The utility outputs PNGs named like `apps-planning-poker-1600x900.png` into the chosen `--out-dir`.