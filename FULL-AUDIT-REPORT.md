# Nx Documentation SEO Audit Report

**Site:** https://nx.dev/docs
**Audit Date:** 2026-04-03
**Business Type Detected:** SaaS / Developer Tool Documentation
**Total Pages Analyzed:** 497 documentation pages (source-level audit)

---

## Executive Summary

### Overall SEO Health Score: 74/100

| Category | Weight | Score | Weighted |
|----------|--------|-------|----------|
| Technical SEO | 22% | 90/100 | 19.8 |
| Content Quality | 23% | 85/100 | 19.6 |
| On-Page SEO | 20% | 78/100 | 15.6 |
| Schema / Structured Data | 10% | 5/100 | 0.5 |
| Performance (CWV) | 10% | 66/100 | 6.6 |
| AI Search Readiness (GEO) | 10% | 95/100 | 9.5 |
| Images | 5% | 58/100 | 2.9 |
| **Total** | **100%** | | **74.5** |

### Top 5 Critical Issues

1. **Zero JSON-LD structured data** — No schema.org markup of any kind (Organization, WebSite, BreadcrumbList, Article, etc.)
2. **Missing Twitter Card tags** — No `twitter:card`, `twitter:site`, `twitter:title`, or `twitter:image` tags
3. **Incomplete Open Graph tags** — Only `og:image` is set; missing `og:title`, `og:description`, `og:type`, `og:url`
4. **12+ images missing alt text** — Primarily in tutorial pages (accessibility and SEO impact)
5. **No lazy loading on images** — 317 images load synchronously without `loading="lazy"`

### Top 5 Quick Wins

1. Add `BreadcrumbList` JSON-LD (visual breadcrumbs already exist — just add the schema)
2. Add Twitter Card meta tags via Starlight head config or middleware
3. Add missing `og:title`, `og:description`, `og:type`, `og:url` to OG middleware
4. Fix 12 empty `![](path)` alt text instances in tutorial files
5. Add `Strict-Transport-Security` header to `netlify.toml`

---

## 1. Technical SEO (Score: 90/100)

### robots.txt ✅ Excellent
- **File:** `astro-docs/src/pages/robots.txt.ts`
- Dynamically generated, environment-aware
- Production: `Allow: /` with sitemap reference
- Non-production (staging, canary, preview): `Disallow: /` — prevents duplicate indexing

### Sitemap ✅ Excellent
- Multi-layer architecture:
  - Astro generates `sitemap-index.xml` and `sitemap-0.xml` for docs
  - `nx-dev/nx-dev/scripts/patch-sitemap-index.mjs` patches root index to include both Next.js and Astro sitemaps
- Referenced in robots.txt: `https://nx.dev/sitemap-index.xml`

### Canonical URLs ✅ Excellent
- **File:** `astro-docs/src/plugins/canonical.middleware.ts`
- Auto-injected on every page via middleware
- Hardcoded to `https://nx.dev` domain
- Prevents duplicate content from preview/staging deployments

### URL Structure ✅ Excellent
- Base path: `/docs`
- Trailing slashes: `never` (configured in `astro.config.mjs`)
- Clean hierarchical patterns: `/docs/[section]/[page]`
- No URL parameters or session IDs

### Redirects ✅ Good
- **File:** `astro-docs/netlify.toml`
- 13+ redirect rules (permanent 301s)
- Covers old tutorial paths, feature consolidation, and legacy URLs

### Security Headers ⚠️ Partial
- **Present:** `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'`
- **Missing:** `Strict-Transport-Security` (HSTS), expanded CSP directives

### 404 Page ✅ Good
- **File:** `astro-docs/src/pages/404.astro`
- Custom Starlight page with helpful messaging and GTM tracking

### Meta Robots ✅ Good
- Environment-aware via robots.txt (no meta tag approach)
- Non-production domains correctly blocked

---

## 2. Content Quality (Score: 85/100)

### Meta Descriptions ✅ Excellent (100% coverage)
- All 497 documentation files have unique, well-written descriptions
- Typically 120-160 characters, action-oriented
- Examples:
  - *"Nx is a build system with smart caching and task orchestration for monorepos. Ship faster without breaking things."*
  - *"Learn how to use Nx computation caching to speed up task execution and reduce CI/CD costs..."*

### Heading Structure ✅ Excellent
- Proper H1 → H2 → H3 hierarchy throughout all content
- 447 pages use Starlight implicit H1 from frontmatter title
- 50 pages use explicit `# Title` markdown H1
- No skipped heading levels found

### Thin Content ✅ No Issues
- ~40 pages with <50 words are intentional index/navigation pages
- All use `pagefind: false` and `sidebar: hidden: true` metadata
- 457 substantive pages contain 100+ words of content

### E-E-A-T ⚠️ Gaps
- **Experience/Expertise:** Strong — deep technical explanations, code examples, embedded videos
- **Author Attribution:** ❌ Missing — no author or contributors field in frontmatter
- **Last Updated Dates:** ❌ Missing — no `lastUpdated` field (could auto-populate from Git)
- **Trust:** Strong — canonical domain, HTTPS, clear organization

---

## 3. On-Page SEO (Score: 78/100)

### Title Tags ✅ Excellent
- Pattern: `{Page Title} — Nx` (Starlight auto-generated)
- All 497 pages have explicit titles via frontmatter
- Consistent brand suffix

### Open Graph Tags ⚠️ Partial
| Tag | Status |
|-----|--------|
| `og:image` | ✅ Custom per-page OG images (1200x630) via `og.middleware.ts` |
| `og:image:width` | ✅ Set to 1200 |
| `og:image:height` | ✅ Set to 630 |
| `og:title` | ❌ Not explicitly set |
| `og:description` | ❌ Not explicitly set |
| `og:type` | ❌ Not set |
| `og:url` | ❌ Not set |

### Twitter Card Tags ❌ Not Implemented
- No `twitter:card`, `twitter:site`, `twitter:title`, `twitter:description`, or `twitter:image` found anywhere

### Internal Linking ✅ Good
- Comprehensive link validation system (`astro-docs/validate-links.ts`)
- Automated link normalization via `fixlinks` script
- Standard format: `/docs/path/to/page`

### Navigation / Sidebar ✅ Excellent
- **File:** `astro-docs/sidebar.mts` (10,571 lines)
- 4 main tabs: Learn, Technologies & Tools, Knowledge Base, Reference
- Proper collapse/expand state, dynamic reference generation
- Clear separation of learning paths vs. lookup functions

---

## 4. Schema / Structured Data (Score: 5/100)

### Current Implementation: NONE

**Zero JSON-LD markup found.** No `<script type="application/ld+json">` in any layout, component, or middleware.

### Visual Breadcrumbs ✅ Present (but no schema)
- **File:** `astro-docs/src/components/layout/Breadcrumbs.astro`
- Semantic HTML with `aria-label="Breadcrumb"` and `aria-current="page"`
- **Missing:** Accompanying `BreadcrumbList` JSON-LD

### Missing Schema Types

| Schema Type | Priority | Reason |
|-------------|----------|--------|
| `BreadcrumbList` | **Critical** | Visual breadcrumbs exist — just needs JSON-LD pairing |
| `WebSite` + `SearchAction` | **Critical** | Enables Google Sitelinks search box |
| `Organization` | **High** | Establishes site identity, social profiles, logo |
| `Article` / `TechArticle` | **High** | Documentation pages with dates and authors |
| `SoftwareApplication` | **Medium** | Nx tool metadata (name, version, category) |
| `FAQPage` | **Medium** | Troubleshooting and knowledge base sections |
| `HowTo` | **Low** | Step-by-step tutorial pages |

---

## 5. Performance (Score: 66/100)

### JavaScript ✅ Good
- Astro Islands architecture — React only for interactive components
- GTM loaded async/deferred
- Scroll events throttled with `requestAnimationFrame`
- Minimal third-party scripts (GTM only, no chat widgets, ads, or session replay)

### CSS ✅ Good
- Tailwind CSS + Vite (tree-shaking)
- PostCSS layers for critical-path ordering
- All CSS inlined via Astro (no external stylesheet loads)
- Dark mode via CSS variables

### Font Loading ⚠️ No Preconnect
- `/astro-docs/public/fonts/` directory exists
- No `<link rel="preconnect">` or `font-display` strategy found
- Potential render-blocking risk

### Lazy Loading ❌ Not Implemented
- No `loading="lazy"` attribute on images
- 317 images load synchronously
- Potential LCP and page weight impact

### Preload/Prefetch ⚠️ Minimal
- No explicit `<link rel="preload">` for critical resources
- No prefetch for likely navigation targets

---

## 6. AI Search Readiness / GEO (Score: 95/100)

### llms.txt ✅ Industry-Leading
- **File:** `astro-docs/src/pages/llms.txt.ts`
- Dynamically generated from all documentation collections
- Organized by sections with descriptions and raw markdown URLs
- Proper cache control headers (3600s)

### llms-full.txt ✅ Implemented
- **File:** `astro-docs/src/pages/llms-full.txt.ts`
- Full concatenated markdown dump for LLM training/context
- Strips YAML frontmatter automatically

### Raw Markdown Access ✅ Implemented
- Any URL accessible via `.md` suffix for raw markdown
- Netlify edge function adds `Link` headers:
  - `<[path].md>; rel="alternate"; type="text/markdown"`
  - `</docs/llms.txt>; rel="alternate"; type="text/markdown"; title="LLM Index"`
  - `</docs/llms-full.txt>; rel="alternate"; type="text/markdown"; title="Full Documentation"`

### AI-Specific Documentation ✅ Excellent
- Dedicated AI setup guide: `/docs/getting-started/ai-setup.mdoc`
- AI enhancement guide: `/docs/features/enhance-AI.mdoc`
- `{% llm_only %}` Markdoc directives for agent-specific guidance
- MCP server documentation for Claude integration

### Content Structure ✅ Excellent
- Clear heading hierarchy for AI extraction
- Properly formatted code blocks
- Tabs for alternative approaches
- Callout boxes for emphasis

---

## 7. Images (Score: 58/100)

### Format Distribution
| Format | Count | Percentage |
|--------|-------|-----------|
| AVIF/WebP (modern) | 165 | 52% |
| PNG/JPG (legacy) | 152 | 48% |
| **Total** | **317** | |

### Alt Text Compliance: 82%
- 12+ images with empty alt text `![](path)` — primarily in tutorials:
  - `getting-started/Tutorials/angular-monorepo-tutorial.mdoc`
  - `getting-started/Tutorials/react-monorepo-tutorial.mdoc`
  - `guides/Nx Console/console-migrate-ui.mdoc`

### Image Optimization ✅ Sharp Configured
- Astro Sharp image service enabled (`astro.config.mjs`)
- `limitInputPixels: false` for large screenshots
- Astro `<Image>` component used for critical UI elements (logo, etc.)

### Lazy Loading ❌ Not Implemented
- No native `loading="lazy"` attributes found
- Markdown images bypass any optimization pipeline

---

## Scoring Breakdown

```
Technical SEO:       90/100 × 0.22 = 19.8
Content Quality:     85/100 × 0.23 = 19.6
On-Page SEO:         78/100 × 0.20 = 15.6
Schema/Structured:    5/100 × 0.10 =  0.5
Performance:         66/100 × 0.10 =  6.6
AI Search (GEO):     95/100 × 0.10 =  9.5
Images:              58/100 × 0.05 =  2.9
─────────────────────────────────────────
TOTAL:                              74.5/100
```

---

## Key File References

| Purpose | File |
|---------|------|
| Astro config | `astro-docs/astro.config.mjs` |
| Sidebar structure | `astro-docs/sidebar.mts` |
| OG image middleware | `astro-docs/src/plugins/og.middleware.ts` |
| Canonical middleware | `astro-docs/src/plugins/canonical.middleware.ts` |
| Breadcrumbs component | `astro-docs/src/components/layout/Breadcrumbs.astro` |
| robots.txt | `astro-docs/src/pages/robots.txt.ts` |
| 404 page | `astro-docs/src/pages/404.astro` |
| llms.txt | `astro-docs/src/pages/llms.txt.ts` |
| llms-full.txt | `astro-docs/src/pages/llms-full.txt.ts` |
| Link validation | `astro-docs/validate-links.ts` |
| Netlify config | `astro-docs/netlify.toml` |
| Content directory | `astro-docs/src/content/docs/` |
| Content config | `astro-docs/src/content.config.ts` |
| Global scripts | `astro-docs/public/global-scripts.js` |
