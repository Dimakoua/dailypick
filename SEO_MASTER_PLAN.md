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

### Phase 1: Urgent Quality Cleanup & Penalty Removal (Sprint 1)

*Goal: Remove all low-quality footprints that trigger automated Google demotions.*

- [x] **1.1 Purge AI Placeholder Tokens**
  - Batch swept all 43 files across `/apps/` to remove leftover prompt tags like `[Image: Description]` and `[Image: View of the wheel interface]`. Verified 0 remaining.
- [x] **1.2 Remove Fabricated Feature Claims**
  - Removed all mentions of `**(Premium Users)**` across tool descriptions (e.g. "Save custom configurations", "Adjust animation speed"). Verified 0 remaining.
- [x] **1.3 Consolidate Thin Multilingual Variants**
  - Added `robots: "noindex, follow"` to all 13 incomplete/thin translated subpages (`/hindi/`, `/french/`, `/mandarin/`, `/spanish/`, `/punjabi/`, `/tamil/`, `/chinese/`).
- [x] **1.4 Confirm Robots.txt, Soft 404 Hygiene & Internal Doc Ignore**
  - Added `Disallow: /seo-instructions/`, `/Readme/`, `/feedback/thank-you/`, and `/blog/?*` queries to `public/robots.txt`.
  - Added build ignores for `Readme.md`, `ideas.md`, `seo-instructions.md`, `SEO_MASTER_PLAN.md`.
  - Configured permanent 301 redirects in `packages/worker/worker.js` for deleted posts and legacy URLs to relevant hubs (`/standups/`, `/agile/`, `/randomizers/`, `/`).
- [x] **1.5 Prune Cannibalizing/Duplicate Blog Posts**
  - Pruned thin, competing retrospective posts and set 301 redirects to the comprehensive 2,500+ word cornerstone guide (`/blog/agile-retrospective-games-complete-guide/`).

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
- [ ] **2.2 Rich Structured Data Implementation**
  - Implement `SoftwareApplication` or `WebApplication` schema with `operatingSystem`, `applicationCategory`, and `offers: { "@type": "Offer", "price": "0" }`.
  - Verify `FAQPage` schema on every tool page to secure rich snippet FAQs in Google SERPs (increasing organic CTR by 20–35%).
- [ ] **2.3 Contextual In-Article Linking**
  - Update top-performing blog articles to link directly into relevant interactive tools (`/apps/wheel/`, `/apps/speedway/`, `/apps/what-should-i-eat/`). (Partially completed across standup/raffle guides; agile/virtual meeting posts remaining).

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
