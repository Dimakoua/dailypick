# Daily Pick SEO Prioritized Action Plan (claude-seo v2.4.2)

Every recommendation below has passed through claude-seo's 10-principle synthesis framework (**PERCEIVE → ANALYZE → VALIDATE → ACT**) and carries:
1. The first-principle observation it rests on (**THINK**)
2. Its dependency / unblock relationship (**CONNECT-system**)
3. An explicit falsifiability check: *"How would we know this failed?"* (**ACCEPT**)
4. A leading indicator to track progress without re-running full audits (**GROW**)

---

## Phase 1: Critical Fixes & Crawl Hygiene (Sprint 1: Days 1–3)

### 1.1 Purge 13 Noindexed Multilingual Pages from `sitemap.xml`
- **Status:** **COMPLETED ✅**
- **Priority:** **HIGH**
- **Impact Area:** Technical SEO & Indexability
- **Resolution:** Updated [`.eleventy.js`](file:///workspaces/dailypick/.eleventy.js#L145-L153) collection logic to filter out all items where `robots` contains `noindex` or `sitemap: false`. Excluded `dailypick.dev-audit/**` from Eleventy builds so internal docs never enter sitemaps.
- **Leading Indicator (GROW):** 0 noindex URLs in `sitemap.xml`; all 13 thin localized subpages purged from sitemap crawl queue.

---

### 1.2 Fix 2 Unlabeled Inputs to Achieve 100/100 Agent-UX Score
- **Status:** **COMPLETED ✅**
- **Priority:** **MEDIUM**
- **Impact Area:** AI Agent Browsing & Accessibility
- **Resolution:** Added `<label for="search-input" class="visually-hidden">` in [`_includes/header.html`](file:///workspaces/dailypick/_includes/header.html#L20) and `<label for="pwa-search-input" class="visually-hidden">` in [`_includes/pwa-search.html`](file:///workspaces/dailypick/_includes/pwa-search.html#L8).
- **Leading Indicator (GROW):** 0 unlabeled inputs across templates; `agent_ux_check.py` score reaches 100/100.

---

### 1.3 Blog Author Structured Data
- **Status:** **KEPT AS ORGANIZATION ✅**
- **Priority:** **LOW**
- **Impact Area:** Structured Data Consistency
- **Resolution:** Retained `BlogPosting` `author` as `@type: "Organization"` with `name: author` and `url: metadata.url` representing Daily Pick.
- **Leading Indicator (GROW):** BlogPosting schema passes rich result validation consistently.

---

## Phase 2: Dwell Time, User Signals & IndexNow Automation (Sprint 2: Week 2)

### 2.1 One-Click "Copy for Slack / Teams" Ritual Decision Sharing
- **Status:** **REMOVED (User Preference)**
- **Priority:** **LOW**
- **Impact Area:** Search Experience Optimization (SXO) & Viral Referral Loops
- **Resolution:** Removed the Slack / Teams copy action to keep wheel winning announcements clean, distraction-free, and natural across both personal and workplace wheels.
- **Leading Indicator (GROW):** Clean winning modal and inline experience restored.

---

### 2.2 Wire Automated IndexNow Deployment Pipeline
- **Status:** **COMPLETED ✅**
- **Priority:** **MEDIUM**
- **Impact Area:** Fast Indexing across Bing, Yandex & IndexNow Crawlers
- **Resolution:** Created [`scripts/indexnow-submit.js`](file:///workspaces/dailypick/scripts/indexnow-submit.js) with batch parsing and `--dry-run` flag support. Added `"indexnow": "node scripts/indexnow-submit.js"` script in [`package.json`](file:///workspaces/dailypick/package.json#L29).
- **Leading Indicator (GROW):** Automatic batch URL submission to `api.indexnow.org`.

---

## Phase 3: Programmatic Quality Upgrade & Competitor Conquest (Sprint 3: Weeks 3–4)

### 3.1 Elevate Programmatic City Food Wheels (>60% Unique Local Data)
- **Status:** **COMPLETED ✅**
- **Priority:** **HIGH**
- **Impact Area:** Doorway Page Penalty Removal & Helpful Content Indexation
- **Resolution:** Enriched [`apps/what-should-i-eat-new-york/index.html`](file:///workspaces/dailypick/apps/what-should-i-eat-new-york/index.html), [`apps/what-should-i-eat-la/index.html`](file:///workspaces/dailypick/apps/what-should-i-eat-la/index.html), and [`apps/what-should-i-eat-chicago/index.html`](file:///workspaces/dailypick/apps/what-should-i-eat-chicago/index.html) with authentic local dining neighborhoods, regional dish presets, local dining etiquette rules, and fixed heading hierarchies (`<h2>` subsections, single `<h1>`).
- **Leading Indicator (GROW):** >60% unique textual content per city wheel page, removing algorithmic doorway devaluation risk.

---

### 3.2 Launch Dedicated `/compare/` Competitor Alternative Hubs
- **Status:** **COMPLETED ✅**
- **Priority:** **MEDIUM**
- **Impact Area:** High-Intent Organic Keyword Conquest
- **Resolution:** Created [`compare/picker-wheel-alternative/index.html`](file:///workspaces/dailypick/compare/picker-wheel-alternative/index.html) and [`compare/wheel-decide-alternative/index.html`](file:///workspaces/dailypick/compare/wheel-decide-alternative/index.html) with side-by-side comparison tables, feature breakdowns, and CTA paths. Configured `.eleventy.js` to assign priority `0.8` to `/compare/` routes.
- **Leading Indicator (GROW):** High-intent comparison landing pages live and indexed.

---

### 3.3 Markdown Delivery & AI Content Negotiation
- **Status:** **COMPLETED ✅**
- **Priority:** **MEDIUM**
- **Impact Area:** LLM Search Crawlers & Agentic SEO
- **Resolution:** Created [`public/index.md`](file:///workspaces/dailypick/public/index.md). Updated [`packages/worker/worker.js`](file:///workspaces/dailypick/packages/worker/worker.js#L320-L365) to support HTTP content negotiation (`Accept: text/markdown` or `/index.md`) with `Content-Type: text/markdown; charset=utf-8` and `Vary: Accept`. Added `<link rel="alternate" type="text/markdown" href="/index.md" />` in [`index.html`](file:///workspaces/dailypick/index.html#L12) and [`_includes/base.njk`](file:///workspaces/dailypick/_includes/base.njk#L57), and attached `Link: </index.md>; rel="alternate"; type="text/markdown"` headers to root responses.
- **Leading Indicator (GROW):** Seamless markdown ingestion for Claude, ChatGPT, and AI agents.

---

## Phase 4: Ongoing Monitoring & Drift Baseline Cadence (Ongoing)

- **Bi-weekly Drift Comparison:** Run `claude-seo run drift_compare.py https://dailypick.dev --skip-cwv` on every major code release to detect unexpected title/meta/canonical/schema regressions.
- **AI Citation Audits:** Perform periodic GEO scans via `claude-seo run agentic_check.py` to maintain parity as LLM search crawlers evolve.
