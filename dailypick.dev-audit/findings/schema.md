# Specialist Finding: Schema & Structured Data (`seo-schema`)

**Target:** `https://dailypick.dev`  
**Score:** 72 / 100  
**Weight:** 10%

## 1. Implemented Types & Validation
- **`WebPage` & `WebSite`:** Present in `<head>` with valid properties and `SearchAction`. Note: Google removed Sitelinks Search Box support, but SearchAction remains machine-readable metadata.
- **`Organization`:** Defined with `@id: https://dailypick.dev/#organization`, logo, and name.
- **`BreadcrumbList`:** Static build-time JSON-LD matches breadcrumb visual elements accurately.
- **`WebApplication`:** Present on 112+ tool pages with `name`, `operatingSystem: "All"`, and free `offers` (`price: "0"`).

## 2. Key Findings & Strategic Shifts
### [INFO] Google FAQPage Rich Results Retirement
- **Date of Retirement:** May 7, 2026.
- **Status:** Google completely stopped displaying FAQ rich results across all websites globally.
- **Analysis:** Over 110 pages on Daily Pick implement extensive `FAQPage` schema blocks aiming to secure SERP real estate. These blocks no longer produce rich snippet accordions in Google SERPs.
- **Recommendation:** Keep existing FAQPage blocks for third-party semantic scrapers, but reallocate engineering and content time toward richer `WebApplication.featureList` and `QAPage` where actual community user Q&A occurs.

### [MEDIUM] Blog Author Schema Type Mismatch
- **Location:** `_includes/post.njk`
- **Issue:** Author is emitted as:
  ```json
  "author": {
    "@type": "Organization",
    "name": "{{ author }}",
    "url": "{{ metadata.url }}"
  }
  ```
- **Impact:** Weakens E-E-A-T signals for competitive agile topics where Google looks for qualified practitioner authors.
- **Remediation:** Emit `@type: "Person"` with `jobTitle` and `sameAs` links.
