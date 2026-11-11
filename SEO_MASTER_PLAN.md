# Daily Pick SEO Master Plan: From "Crawled - Not Indexed" to Rank #1

> **Project Goal:** Eliminate all indexing barriers, resolve the "Crawled - currently not indexed" status across app pages, and execute an organic growth strategy to achieve Top 1 rankings for key tool and decision queries.

---

## 1. Executive Summary & Root Cause Diagnostic

Googlebot is currently crawling Daily Pick's tool pages, but refusing to index them in Search. A deep forensic audit reveals the 4 exact culprits:

| Issue | Severity | Location | Impact on Google Indexation |
| :--- | :---: | :--- | :--- |
| **Unrendered AI Tokens & Hallucinations** | **CRITICAL** | 43+ files in `/apps/` | Raw prompt artifacts (`[Image: Description]`) and fake feature tiers (`(Premium Users)`) trigger Google Spam/Helpful Content demotions. |
| **Orphaned / Dynamic-Only Internal Links** | **HIGH** | `_includes/base.njk` | Breadcrumbs & Related Apps were client-side JS only; Googlebot saw pages as isolated dead-ends on initial crawl. *(Resolved in base.njk)*. |
| **Authority Dilution (Multilingual Split)** | **MEDIUM** | `/apps/*/{french,hindi,etc}/` | 5+ language versions on a young domain split PageRank, causing Google to drop all variants. |
| **Thin Programmatic Copy** | **HIGH** | City meal spinners | Boilerplate text with substituted city names lacks true Information Gain (E-E-A-T). |

---

## 2. Four-Phase Action Plan to Rank #1

```
┌─────────────────────────┐     ┌─────────────────────────┐     ┌─────────────────────────┐     ┌─────────────────────────┐
│  Phase 1: Urgent Purge  │ ──> │ Phase 2: Topical Clust. │ ──> │ Phase 3: UX & Dwell     │ ──> │ Phase 4: Competitor Win │
│  • Strip AI placeholders│     │  • Regional City Hubs   │     │  • Custom slice inputs  │     │  • "Alternative" hubs   │
│  • Clean (Premium) claims│    │  • Breadcrumb schema    │     │  • Shareable query URLs │     │  • Backlink generation  │
│  • Noindex thin locales │     │  • Inter-city linking   │     │  • Instant spin & PWA   │     │  • Embed distribution   │
└─────────────────────────┘     └─────────────────────────┘     └─────────────────────────┘     └─────────────────────────┘
```

---

### Phase 1: Urgent Quality Cleanup, Scaled Doorway Pruning & Penalty Removal (Sprint 1)

*Goal: Remove all low-quality footprints and programmatic doorway pages that triggered Google's site-wide demotion and "Crawled - not indexed" validation failure.*

- [x] **1.1 Purge AI Placeholder Tokens & Synthetic Boilerplate**
  - Swept code across all tools to eliminate raw prompt tags and synthetic FAQ boilerplate ("This tool is considered the best option for your unique needs...").
- [x] **1.2 Remove Fabricated Feature Claims**
  - Removed all mentions of `**(Premium Users)**` across tool descriptions. Verified 0 remaining.
- [x] **1.3 Prune 13 Thin Multilingual Localized Folders**
  - Deleted all 13 thin localized subpages (`/hindi/`, `/french/`, `/mandarin/`, `/spanish/`, `/punjabi/`, `/tamil/`, `/chinese/`) and configured 301 redirects to `/apps/what-should-i-eat/`.
- [x] **1.4 Prune 34 Programmatic City Food Spinners & Consolidate to Master Food Wheel**
  - Pruned all 34 individual doorway city/cuisine wheels (`what-should-i-eat-*`).
  - Consolidated into a single, high-utility master tool: `/apps/what-should-i-eat/` with rich regional and cuisine presets (NYC, LA, European, Asian, Latin, Healthy).
  - Mapped all 34 old URLs to 301 redirects in `packages/worker/worker.js`.
- [x] **1.5 Prune Off-Topic Lottery Generators (12) & World Cup Clones (8)**
  - Pruned 12 lottery quick-pick pages and redirected to `/apps/random-number-generator/`.
  - Pruned 8 World Cup wheels and redirected to `/apps/wheel/`.
- [x] **1.6 Resolve Robots.txt & Sitemap Conflicts**
  - Removed `/apps/whats-new/`, `/apps/brand/`, and `/apps/roster/` from `sitemap.xml` to eliminate GSC "Blocked by robots.txt" error.
- [x] **1.7 Rebuild Pristine Sitemap (Down from 156 to 88 High-Value URLs)**
  - Rebuilt sitemap containing strictly core tools and cornerstone guides, eliminating 68 low-quality/unindexed URLs from the crawl queue.

---

### Phase 2: Topical Clustering & Internal Linking (Sprint 2)

*Goal: Pass maximum link equity across related pages and establish topical authority.*

- [x] **2.0 Pre-rendered Static Internal Links & Breadcrumbs**
  - Converted dynamic JS breadcrumbs and "Similar Apps" cross-links in `_includes/base.njk` to static HTML rendered at build time so search crawlers receive link equity immediately.
- [x] **2.1 Regional Food Wheel Hubs (Static Silos)**
  - Grouped city wheels into 3 regional clusters in `_includes/base.njk`:
    - **North America**: NYC, LA, Vancouver, Toronto, Chicago, Miami, Austin, Quebec City, Montreal.
    - **Europe**: London, Berlin, Madrid, Istanbul.
    - **Asia-Pacific**: Tokyo, Beijing, Shanghai, Guangzhou, Kolkata, Bengaluru, Chennai, Mumbai, New Delhi, Chengdu, Sydney.
  - Implemented static pre-rendered cross-linking module (`#regionalCitiesSection`) directly in HTML on each city page linking to peers and `/food/city/` hub.
- [x] **2.2 Rich Structured Data Implementation**
  - Standardized complete `WebApplication` schema across all 112 apps with `name`, `operatingSystem: "All"`, `applicationCategory`, `browserRequirements`, and `offers: { "@type": "Offer", "price": "0", "priceCurrency": "USD" }`.
  - Verified valid `FAQPage` schema on interactive tool pages (224 JSON-LD blocks validated, 0 errors) to secure Google rich snippet FAQs.
- [x] **2.3 Contextual In-Article Linking**
  - Updated all top-performing blog posts and cornerstone pillar guides (including Agile Retrospective Games, Virtual Meeting Games, Async Standup Alternatives, and Remote Team Building) with high-intent contextual links into relevant interactive tools (`/apps/wheel/`, `/apps/speedway/`, `/apps/retro-board/`, `/apps/timer/`, `/apps/planning-poker/`). Verified 100% of blog posts now pass topical equity into apps.

---

### Phase 3: Dwell Time & User Signals Optimization (Sprint 3)

*Goal: Maximize on-page engagement to satisfy Google's Helpful Content and User Intent signals.*

- [x] **3.1 Custom Choices Input on Wheel Tools**
  - Added `✏️ Edit Choices` button to `FoodWheelEngine` with a modal allowing users to paste/type custom choices and dynamically re-segment the wheel.
- [x] **3.2 Shareable URLs via Query State**
  - Enabled stateful sharing (e.g. `?choices=Tacos,Sushi,Pizza`) via `🔗 Share Wheel` button with automatic link copying and query string state hydration.
- [ ] **3.3 One-Click Result Copying**
  - Provide a dedicated **"Copy Result"** / **"Share Decision"** button that copies a formatted message to clipboard for Slack, Discord, or Teams.

---

### Phase 4: Search Conquest & Authority Building (Sprint 4)

*Goal: Win high-volume competitor search queries and build high-authority external links.*

- [ ] **4.1 Create "Alternative To" Pillar Landing Pages**
  - Launch dedicated comparison hubs:
    - `/compare/wheel-decide-alternative/` (Live in blog: `/blog/wheeldecide-alternative-daily-pick-comparison/`)
    - `/compare/picker-wheel-alternative/` (Live in blog: `/blog/pickerwheel-alternative-daily-pick-comparison/`)
    - `/compare/wheel-of-names-alternative/`
  - Highlight Daily Pick's core differentiators: **100% Free, Zero Ads, Ad-Free UI, Faster Native Canvas, PWA Support, Dark Mode**.
- [x] **4.2 Streamer & Notion Embed Distribution**
  - Upgraded embed widget in `_includes/base.njk` with dedicated presets for **Website (HTML)**, **Notion Widget** link, and **OBS Studio Overlay** (Browser Source).
- [ ] **4.3 IndexNow API Automated Trigger**
  - Integrate an automated IndexNow script in the CI/CD pipeline so new tools and updates are instantly submitted to Bing, Yandex, and IndexNow-compatible crawlers within minutes of deployment.

---

## 3. Success Metrics & Milestone Tracking

| Milestone | Target Timeline | Expected Outcome |
| :--- | :---: | :--- |
| **Milestone 1** | Week 1 | 0 unrendered AI tokens in code; Robots.txt clean; Static internal links deployed. |
| **Milestone 2** | Week 2 | GSC "Crawled - not indexed" count drops by >60%; Re-indexing requests processed. |
| **Milestone 3** | Week 4 | City food clusters start ranking in Top 10 for long-tail city meal queries. |
| **Milestone 4** | Week 8 | "Wheel decide alternative" and branded tools achieve Top 3 / Rank #1 positions. |
