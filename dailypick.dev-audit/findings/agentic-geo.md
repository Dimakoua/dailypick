# Specialist Finding: Agentic Browsing & AI Search (GEO)

**Target:** `https://dailypick.dev`  
**Score:** 90 / 100  
**Weight:** 10%

## 1. Agentic Browsing Readiness (`seo-agentic`)
Tested via `agentic_check.py` and `agent_ux_check.py`:

| Check ID | Title | Priority | Status |
| :--- | :--- | :---: | :---: |
| `server-rendered` | Primary content present without JavaScript | P0 | **PASS** (1,239 words pre-JS) |
| `robots-reachable` | robots.txt reachable | P0 | **PASS** (HTTP 200) |
| `robots-ai-groups` | Deliberate robots.txt groups for AI user agents | P0 | **PASS** (GPTBot, OAI-SearchBot, PerplexityBot, Google-Extended) |
| `llms-txt` | llms.txt follows Lighthouse rules | P1 | **PASS** (200 OK, 11,716 bytes, valid format) |
| `http-404` | Unknown URLs return a real 404 | P1 | **PASS** (True 404) |
| `markdown-delivery` | Markdown version of page | P1 | **INFO** (Missing Content Negotiation) |
| `agent-ux` | Accessibility tree structure for AI agents | P0 | **92 / 100** (-8 pts for 2 unlabelled inputs) |

### Key Improvements:
1. **Fix Unlabelled Inputs:** Add explicit `<label for="...">` or `aria-label` attributes to the two form inputs identified by `agent_ux_check.py` to push the Agent-UX score to 100/100.
2. **Markdown Content Negotiation:** Enable Cloudflare Worker to serve markdown when `Accept: text/markdown` is requested.

## 2. Generative Engine Optimization (`seo-geo`)
- **Primary Source Guidance:** Google AI Optimization Guide affirms that generative AI optimization is rooted in standard search experience and helpfulness fundamentals.
- **Passage Citability:** High. Tool instruction copy uses concise, declarative sentence patterns that AI answer engines (ChatGPT Search, Perplexity, Gemini) can easily extract.
- **Brand Mentions vs. Backlinks:** Industry research demonstrates brand mentions correlate ~3x more strongly with AI search visibility than traditional backlink counts (YouTube: 0.74 correlation, Reddit, LinkedIn). Daily Pick should prioritize building citations in agile practitioner communities and video tutorials.
