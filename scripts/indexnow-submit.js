#!/usr/bin/env node
/**
 * Daily Pick Automated IndexNow Submitter
 * Submits updated URLs to the IndexNow protocol endpoint (Bing, Yandex, Seznam, Naver).
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const HOST = 'dailypick.dev';
const KEY = 'f8a3f09b-39f0-4d58-9f2d-cf9a56b1c2a5';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const SITEMAP_PATH = path.join(__dirname, '..', 'dist', 'sitemap.xml');

function extractUrlsFromSitemap(xmlContent) {
  const urls = [];
  const regex = /<loc>(https:\/\/[^<]+)<\/loc>/g;
  let match;
  while ((match = regex.exec(xmlContent)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

async function submitIndexNow(urlList) {
  if (!urlList || urlList.length === 0) {
    console.log('[IndexNow] No URLs to submit.');
    return;
  }

  // IndexNow accepts up to 10,000 URLs per batch
  const batch = urlList.slice(0, 10000);
  const payload = JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList: batch,
  });

  const options = {
    hostname: 'api.indexnow.org',
    port: 443,
    path: '/indexnow',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[IndexNow] Successfully submitted ${batch.length} URLs (Status: ${res.statusCode}).`);
          resolve(true);
        } else {
          console.warn(`[IndexNow] Submission returned status ${res.statusCode}: ${responseBody}`);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.error(`[IndexNow] Request failed: ${err.message}`);
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  if (!fs.existsSync(SITEMAP_PATH)) {
    console.warn(`[IndexNow] Sitemap not found at ${SITEMAP_PATH}. Build the site first.`);
    return;
  }

  const sitemapXml = fs.readFileSync(SITEMAP_PATH, 'utf-8');
  const urls = extractUrlsFromSitemap(sitemapXml);
  console.log(`[IndexNow] Discovered ${urls.length} URLs in sitemap.`);

  if (isDryRun) {
    console.log(`[IndexNow] [DRY RUN] Would submit ${urls.length} URLs to api.indexnow.org for host ${HOST}. Sample:`);
    console.log(urls.slice(0, 5).join('\n'));
    return;
  }

  await submitIndexNow(urls);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[IndexNow] Fatal error:', err);
  });
}

module.exports = { submitIndexNow, extractUrlsFromSitemap };
