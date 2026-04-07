#!/usr/bin/env node
/**
 * scripts/screenshot.js
 *
 * Small utility to read internal links from `apps/whats-new/index.html`
 * and capture viewport screenshots at the recommended sizes.
 *
 * Usage:
 *   npm install --save-dev puppeteer
 *   node scripts/screenshot.js --base-url http://localhost:8787
 *
 * Options:
 *   --base-url   Base URL to prepend to internal paths (default: http://localhost:8787)
 *   --out-dir    Output directory for screenshots (default: apps/whats-new/screenshots)
 *   --source     Local HTML source to parse for links (default: apps/whats-new/index.html)
 *   --sizes      Comma-separated sizes (default: 1600x900,1200x720)
 *   --format     png|jpeg (default: png)
 *   --wait       Additional wait after load in ms (default: 1000)
 */

const fs = require('fs');
const path = require('path');

function parseArgs() {
  const raw = process.argv.slice(2);
  const args = {};
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = raw[i + 1];
    if (next && !next.startsWith('--')) { args[key] = next; i++; } else { args[key] = true; }
  }
  return args;
}

const args = parseArgs();
const baseUrl = (args['base-url'] || args.baseUrl || 'http://localhost:8787').replace(/\/$/, '');
const outDir = args['out-dir'] || args.outDir || 'apps/whats-new/screenshots';
const source = args.source || 'apps/whats-new/index.html';
const sizesArg = args.sizes || '1600x900,1200x720';
const format = (args.format || 'png').toLowerCase();
const waitMs = parseInt(args.wait || '1000', 10) || 1000;

const sizes = sizesArg.split(',').map(s => {
  const [w, h] = s.split('x').map(Number);
  return { width: Number(w) || 1600, height: Number(h) || 900 };
});

// skip patterns (comma-separated) — default skip blog and the whats-new page itself
const skipArg = args.skip || args['skip-patterns'] || '';
const defaultSkips = ['/blog', '/apps/whats-new'];
const skipPatterns = skipArg ? skipArg.split(',').map(s => s.trim()).filter(Boolean) : [];
const allSkipPatterns = Array.from(new Set(defaultSkips.concat(skipPatterns)));

// Attempt to dismiss cookie-consent banners/popups in the page and any frames.
async function dismissCookieBanners(page) {
  async function tryEvaluate(ctx) {
    try {
      return await ctx.evaluate(() => {
        // Prefer explicit data attributes if present on the page
        try {
          const acceptEls = Array.from(document.querySelectorAll('[data-cookie-accept]'));
          if (acceptEls.length) {
            for (const el of acceptEls) { try { el.click(); } catch (e) {} }
            return true;
          }
          const declineEls = Array.from(document.querySelectorAll('[data-cookie-decline]'));
          if (declineEls.length) {
            for (const el of declineEls) { try { el.click(); } catch (e) {} }
            return true;
          }
        } catch (e) {}

        const keywords = ['accept', 'agree', 'accept all', 'agree all', 'got it', 'dismiss', 'decline', 'close', 'ok', 'understand', 'allow', 'allow all', 'accept cookies', 'accept & continue'];
        function textOf(el) {
          return (el.innerText || el.textContent || el.value || el.getAttribute('aria-label') || el.getAttribute('title') || '').toLowerCase().trim();
        }
        const els = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"], [role="button"]'));
        for (const el of els) {
          const txt = textOf(el);
          if (!txt) continue;
          for (const kw of keywords) {
            if (txt.includes(kw)) {
              try { el.click(); } catch (e) {}
              return true;
            }
          }
        }
        const cookieNodes = Array.from(document.querySelectorAll('[id*="cookie"], [class*="cookie"], [data-testid*="cookie"], [data-test*="cookie"], [data-cy*="cookie"]'));
        for (const node of cookieNodes) {
          const btn = node.querySelector('button, a, [role="button"], input[type="button"], input[type="submit"]');
          if (btn) { try { btn.click(); } catch(e){}; return true; }
          const closeBtn = node.querySelector('.close, .cookie-close, .cookie__close, [aria-label*="close"]');
          if (closeBtn) { try { closeBtn.click(); } catch(e){}; return true; }
        }
        return false;
      });
    } catch (e) {
      return false;
    }
  }

  // Try main page
  const mainTried = await tryEvaluate(page);
  if (mainTried) {
    if (typeof page.waitForTimeout === 'function') await page.waitForTimeout(300);
    else await new Promise(r => setTimeout(r, 300));
    return true;
  }

  // Try frames
  const frames = page.frames ? page.frames() : [];
  for (const f of frames) {
    try {
      const r = await tryEvaluate(f);
      if (r) {
        if (typeof page.waitForTimeout === 'function') await page.waitForTimeout(300);
        else await new Promise(r => setTimeout(r, 300));
        return true;
      }
    } catch (e) {}
  }
  return false;
}

(async function main() {
  try {
    const sourcePath = path.resolve(process.cwd(), source);
    if (!fs.existsSync(sourcePath)) {
      console.error('Source file not found:', sourcePath);
      process.exit(1);
    }

    const html = fs.readFileSync(sourcePath, 'utf8');
    const hrefRegex = /href\s*=\s*"([^"]+)"/g;
    const urls = new Set();
    let m;
    while ((m = hrefRegex.exec(html)) !== null) {
      const rawHref = m[1].trim();
      // skip image references inside screenshots folder
      if (rawHref.startsWith('/apps/whats-new/screenshots')) continue;
      if (rawHref.startsWith('/')) {
        urls.add(rawHref);
      } else if (rawHref.startsWith('#')) {
        urls.add('/apps/whats-new/' + rawHref);
      }
    }

    // filter out skip patterns
    const filtered = new Set();
    for (const u of urls) {
      const shouldSkip = allSkipPatterns.some(p => p && (u === p || u.startsWith(p) || u.includes(p)));
      if (!shouldSkip) filtered.add(u);
    }

    if (filtered.size === 0) {
      console.error('No internal links found after applying skip patterns:', allSkipPatterns);
      process.exit(1);
    }

    // replace urls with filtered set
    const finalUrls = filtered;

    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    const urlList = Array.from(finalUrls);
    for (const urlPath of urlList) {
      const fullUrl = baseUrl + (urlPath.startsWith('/') ? urlPath : '/' + urlPath);
      // slugify for filename
      let slug = urlPath.replace(/^\/+|\/+$/g, '');
      slug = slug.replace(/[#?&=]/g, '-').replace(/[^a-zA-Z0-9-_]+/g, '-');
      if (!slug) slug = 'root';
      console.log('Visiting', fullUrl);
      try {
        await page.goto(fullUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        // some Puppeteer versions don't include page.waitForTimeout — provide a safe fallback
        if (typeof page.waitForTimeout === 'function') {
          await page.waitForTimeout(waitMs);
        } else {
          await new Promise((r) => setTimeout(r, waitMs));
        }

        // attempt to dismiss cookie consent popups before taking screenshots
        try {
          await dismissCookieBanners(page);
        } catch (e) {
          // ignore dismissal errors and continue
        }
        for (const size of sizes) {
          await page.setViewport({ width: size.width, height: size.height, deviceScaleFactor: 1 });
          const filename = `${slug}-${size.width}x${size.height}.${format}`;
          const outPath = path.join(outDir, filename);
          await page.screenshot({ path: outPath, type: format === 'jpeg' ? 'jpeg' : 'png', fullPage: false });
          console.log('  saved', outPath);
        }
      } catch (err) {
        console.error('  failed for', fullUrl, err.message.replace(/\n/g, ' '));
      }
    }

    await browser.close();
    console.log('All done.');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
