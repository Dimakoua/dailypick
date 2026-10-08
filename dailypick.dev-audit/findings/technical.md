# Specialist Finding: Technical SEO (`seo-technical`)

**Target:** `https://dailypick.dev`  
**Score:** 84 / 100  
**Weight:** 22%

## 1. Crawlability & Indexability
- **Robots.txt Analysis:**
  - Status: 200 OK (RFC 9309 compliant).
  - Groups defined: 6.
  - Sitemaps declared: `https://dailypick.dev/sitemap.xml`.
  - Disallowed paths: `/blog/page/`, `/blog/?*`, `/Readme/`, `/feedback/`, `/seo-instructions/`, `/apps/brand/`, `/apps/roster/`, `/apps/whats-new/`, `/GZIP-COMPRESSION/`.
  - Crawl budget protection: Adequate. No wasteful parameters crawled.
- **AI Crawler Directives:**
  - `GPTBot`: Disallow `/` (Protects model training scraping).
  - `OAI-SearchBot`: Allow `/` (Enables ChatGPT Search indexing & citations).
  - `PerplexityBot`: Allow `/` (Enables Perplexity citations).
  - `Google-Extended`: Allow `/` (Enables Gemini grounding).
  - `Claude-SearchBot`: Evaluated under generic `*` rule; allows search citations.

## 2. Sitemap Discrepancy (Finding #1)
- **Status:** **FAIL (High Severity)**
- **Evidence:** `sitemap_discovery.py` validated `sitemap.xml`. Cross-referencing against HTML revealed 13 localized subpages (`/apps/what-should-i-eat-*/{hindi,french,spanish,mandarin,punjabi,tamil,chinese}/`) with `<meta name="robots" content="noindex, follow">` that are actively listed in `sitemap.xml`.
- **Impact:** Conflicting crawler directives waste crawl budget and lower sitemap reliability scores in Search Console.
- **Remediation:** Filter `noindex` pages out of `public/sitemap.njk`.

## 3. Server Architecture & Security
- **Server:** Cloudflare Workers Edge Network.
- **Protocols:** HTTP/3, TLS 1.3, Brotli & Gzip compression.
- **Cache Header:** `CF-Cache-Status: HIT` with Cloudflare Worker edge delivery.
- **Soft-404 Response:** Validated; random probe URL returns genuine HTTP 404.
