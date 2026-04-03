# Nx Documentation SEO Action Plan

**Site:** https://nx.dev/docs
**Generated:** 2026-04-03
**Current Score:** 74/100

---

## Critical Priority (Fix Immediately)

> These issues directly impact search visibility and rich results.

### 1. Add BreadcrumbList JSON-LD Schema
- **Impact:** Enables breadcrumb rich snippets in Google SERPs
- **Effort:** Low (2-4 hours)
- **File to modify:** Create new middleware or extend `astro-docs/src/plugins/og.middleware.ts`
- **Details:** Visual breadcrumbs already exist in `Breadcrumbs.astro`. Add matching `BreadcrumbList` JSON-LD that reads the same breadcrumb path data.
- **Example:**
  ```json
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Docs", "item": "https://nx.dev/docs" },
      { "@type": "ListItem", "position": 2, "name": "Getting Started", "item": "https://nx.dev/docs/getting-started" }
    ]
  }
  ```

### 2. Add WebSite + SearchAction JSON-LD Schema
- **Impact:** Enables Google Sitelinks search box
- **Effort:** Low (1-2 hours)
- **File to modify:** Add to site-level head (e.g., `astro.config.mjs` head array or a new middleware)
- **Details:** Pagefind search already exists. The schema tells Google about it.
- **Example:**
  ```json
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Nx",
    "url": "https://nx.dev",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://nx.dev/docs?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  }
  ```

### 3. Add Organization JSON-LD Schema
- **Impact:** Establishes site identity, logo, social profiles in Knowledge Graph
- **Effort:** Low (1 hour)
- **File to modify:** Site-level head injection
- **Example:**
  ```json
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Nx",
    "url": "https://nx.dev",
    "logo": "https://nx.dev/docs/nx-media.png",
    "sameAs": [
      "https://github.com/nrwl/nx",
      "https://twitter.com/NxDevTools",
      "https://www.youtube.com/@naborsnx"
    ]
  }
  ```

### 4. Fix 12 Missing Image Alt Text Instances
- **Impact:** Accessibility compliance + image SEO
- **Effort:** Low (1-2 hours)
- **Files to fix:**
  - `astro-docs/src/content/docs/getting-started/Tutorials/angular-monorepo-tutorial.mdoc`
  - `astro-docs/src/content/docs/getting-started/Tutorials/react-monorepo-tutorial.mdoc`
  - `astro-docs/src/content/docs/guides/Nx Console/console-migrate-ui.mdoc`
  - Search for `![](` pattern across all `.mdoc` files to find remaining instances

---

## High Priority (Fix Within 1 Week)

> Significant impact on social sharing and search performance.

### 5. Add Twitter Card Meta Tags
- **Impact:** Rich previews when shared on Twitter/X
- **Effort:** Low (1-2 hours)
- **File to modify:** `astro-docs/src/plugins/og.middleware.ts` or create `twitter.middleware.ts`
- **Tags to add:**
  ```html
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@NxDevTools" />
  <meta name="twitter:title" content="{page title}" />
  <meta name="twitter:description" content="{page description}" />
  <meta name="twitter:image" content="{og image url}" />
  ```

### 6. Complete Open Graph Tag Coverage
- **Impact:** Rich previews on social platforms (LinkedIn, Facebook, Slack, etc.)
- **Effort:** Low (1-2 hours)
- **File to modify:** `astro-docs/src/plugins/og.middleware.ts`
- **Tags to add:** `og:title`, `og:description`, `og:type` ("article" for docs), `og:url`

### 7. Add HSTS Header
- **Impact:** Security + minor SEO trust signal
- **Effort:** Trivial (5 minutes)
- **File to modify:** `astro-docs/netlify.toml`
- **Add:**
  ```toml
  [headers]
    for = "/*"
      [headers.values]
        Strict-Transport-Security = "max-age=31536000; includeSubDomains; preload"
  ```

### 8. Add Article/TechArticle JSON-LD to Documentation Pages
- **Impact:** Rich results for documentation, date signals for freshness
- **Effort:** Medium (4-8 hours)
- **File to modify:** New middleware `schema.middleware.ts`
- **Details:** Add `TechArticle` schema with `headline`, `description`, `datePublished`, `dateModified` (from Git), `publisher` (Organization)

---

## Medium Priority (Fix Within 1 Month)

> Optimization opportunities that improve overall SEO posture.

### 9. Implement Image Lazy Loading
- **Impact:** Improved page load performance, better CWV scores
- **Effort:** Medium (4-8 hours)
- **Approach:** Create custom Markdoc image tag that adds `loading="lazy"` to below-fold images

### 10. Convert Legacy PNG/JPG Images to AVIF
- **Impact:** 30-50% file size reduction, faster page loads
- **Effort:** Medium (8-16 hours)
- **Details:** 152 legacy format images remain. Prioritize large screenshots in:
  - `astro-docs/src/assets/enterprise/single-tenant/` (25+ PNG files)
  - `astro-docs/src/assets/tutorials/`

### 11. Add E-E-A-T Signals (Author/Date Metadata)
- **Impact:** Signals content freshness and expertise to search engines
- **Effort:** Medium (8-16 hours)
- **Details:**
  - Add `lastUpdated` frontmatter field (auto-populate from Git history)
  - Consider `contributors` field for key pages
  - Display "Last updated: {date}" on page

### 12. Add Font Preconnect/Preload
- **Impact:** Faster font rendering, reduced CLS
- **Effort:** Low (1 hour)
- **File to modify:** `astro-docs/astro.config.mjs` head config
- **Add:** `<link rel="preconnect">` and `<link rel="preload" as="font">` for critical fonts

### 13. Add FAQPage Schema to Knowledge Base / Troubleshooting Pages
- **Impact:** FAQ rich results in SERPs
- **Effort:** Medium (4-8 hours)
- **Details:** Auto-generate FAQPage JSON-LD from Q&A-structured content in troubleshooting sections

---

## Low Priority (Backlog)

> Nice-to-have improvements for long-term SEO health.

### 14. Add SoftwareApplication Schema for Nx Tool
- **Impact:** Rich results showing Nx as a software product
- **Effort:** Low (2 hours)

### 15. Expand CSP Headers
- **Impact:** Security hardening (defense-in-depth)
- **Effort:** Medium (4-8 hours)
- **Details:** Add `script-src`, `style-src`, `img-src` directives beyond current `frame-ancestors`

### 16. Add HowTo Schema to Tutorial Pages
- **Impact:** Step-by-step rich results for tutorials
- **Effort:** Medium (8 hours)
- **Note:** Google restricted HowTo rich results in 2023, but schema still provides semantic signals

### 17. Add Preload for Critical Navigation Resources
- **Impact:** Faster perceived navigation
- **Effort:** Low (2 hours)
- **Details:** Prefetch/prerender likely next-page targets

### 18. Add VideoObject Schema for Embedded Videos
- **Impact:** Video rich results for pages with embedded YouTube content
- **Effort:** Medium (4-8 hours)

---

## Implementation Roadmap

```
Week 1: Items 1-7 (Critical + High — all low effort)
         Expected score improvement: +12 points → ~86/100

Week 2-3: Items 8-10 (Medium effort, high impact)
           Expected score improvement: +5 points → ~91/100

Month 2: Items 11-13 (E-E-A-T and remaining medium items)
          Expected score improvement: +4 points → ~95/100

Backlog: Items 14-18 (Polish)
         Expected final score: ~97/100
```

---

## Score Improvement Projections

| Action | Category | Current → Projected |
|--------|----------|-------------------|
| Add JSON-LD schemas (1-3, 8) | Schema | 5 → 65 |
| Add Twitter + complete OG (5-6) | On-Page | 78 → 92 |
| Fix alt text (4) | Images | 58 → 68 |
| Add lazy loading (9) | Performance | 66 → 75 |
| Convert images to AVIF (10) | Images | 68 → 80 |
| Add HSTS + E-E-A-T (7, 11) | Technical + Content | 90→95, 85→92 |

**Projected score after Week 1:** ~86/100 (+12 points)
**Projected score after full plan:** ~95/100 (+21 points)
