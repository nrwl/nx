# nx.dev Deployment Architecture

This document explains how [nx.dev](https://nx.dev) is deployed on Netlify and how requests are routed between the systems that serve content: **Framer** (marketing pages), **astro-docs** (documentation), **nx-blog** (blog, changelog, courses), and **Netlify Functions** (the AI embeddings API).

The `nx-dev` Netlify site itself is a static router: it serves static assets from `public/`, redirect/proxy rules from `_redirects`, edge functions, and one serverless function. There is no application framework.

## Architecture Overview

```
Request -> Netlify Edge Functions -> _redirects -> static assets / functions
              |                          |
              v                          v
      Framer / nx-blog          astro-docs (200 proxy)
      (marketing)  (blog,       301s, /api/* function
                   courses)
```

**Routing priority:**

1. Edge functions - `rewrite-framer-urls.ts` (proxies marketing pages to Framer and blog/changelog/courses to nx-blog), `additional-sitemaps.ts`
2. `_redirects` - 301 permanent redirects, plus 200 proxies for `/docs/*` (astro-docs) and `/api/query-ai-embeddings` (Netlify Function). Environment-dependent rules are appended at build time by `scripts/build-site.mjs`
3. Static assets from `public/` (favicons, fonts, images, socials) and the generated `sitemap.xml`

## Request Flow

### 1. Netlify Edge Functions

Edge functions run first. Located at `/netlify/edge-functions/` in the repository root (see [Why repo root?](#why-are-edge-functions-at-the-repo-root)).

| Edge Function            | Path Pattern                       | Purpose                                                              |
| ------------------------ | ---------------------------------- | -------------------------------------------------------------------- |
| `rewrite-framer-urls.ts` | `/*`                               | Proxies marketing pages to Framer, blog/changelog/courses to nx-blog |
| `additional-sitemaps.ts` | `/sitemap-1.xml`, `/sitemap-2.xml` | Proxies Framer's and nx-blog's sitemaps with URL rewriting           |

### 2. Netlify Redirects (`_redirects`)

After edge functions, Netlify processes `_redirects`. The checked-in file contains **301 permanent redirects** (legacy URL migrations, shortened URLs, external redirects) plus the `/api/query-ai-embeddings` function rewrite. At build time, `scripts/build-site.mjs` appends environment-dependent **200 proxies**:

| Pattern          | Destination                       | Description             |
| ---------------- | --------------------------------- | ----------------------- |
| `/docs/*`        | `${ASTRO_URL}/docs/:splat`        | All documentation pages |
| `/robots.txt`    | `${ASTRO_URL}/docs/robots.txt`    | Robots file             |
| `/llms.txt`      | `${ASTRO_URL}/docs/llms.txt`      | LLM-friendly docs index |
| `/llms-full.txt` | `${ASTRO_URL}/docs/llms-full.txt` | Full LLM documentation  |

`/.netlify/*` cannot be a redirect source (reserved). The platform Image CDN serves `/.netlify/images` directly, resolving `url=` paths through this site's routing (including the `/docs/*` proxy), so astro-docs image URLs keep working.

Rules are processed **top-to-bottom, first match wins**. Specific rules must come before wildcard rules.

### 3. Static Assets and Functions

Anything not matched above is served from the publish directory (`dist/`, built from `public/`) or returns 404. The `/api/query-ai-embeddings` rewrite targets the Netlify Function in `/netlify/functions/`.

## The Serving Systems

### Framer (Marketing Pages)

**Environment Variable:** `NEXT_PUBLIC_FRAMER_URL`

Framer hosts the marketing website: homepage (`/`), `/nx-cloud`, `/enterprise`, `/community`, `/customers`, `/solutions/*`, `/webinars`, and everything else not explicitly excluded.

The `rewrite-framer-urls.ts` edge function receives all requests by default, passes excluded paths through to this site, and proxies the rest to Framer, rewriting Framer URLs in HTML responses to `https://nx.dev` (canonical URLs, no duplicate indexing).

### nx-blog (Blog, Changelog, Courses)

**Environment Variable:** `BLOG_URL` (e.g. `https://blog.nx.app`)

A separate repository/Netlify site (`nrwl-blog`). The edge function proxies `/blog`, `/blog/*`, `/changelog`, `/changelog/*`, `/courses`, `/courses/*` to it with the same streaming URL rewrite as Framer. Its sitemap is exposed as `/sitemap-2.xml` via `additional-sitemaps.ts`.

### astro-docs (Documentation)

**Location:** `astro-docs/`
**Environment Variable:** `NEXT_PUBLIC_ASTRO_URL`

The Astro site handles all `/docs/*` paths. It's deployed as a separate Netlify site (`nx-docs`) and proxied in via generated `_redirects` 200 rules.

**Deploy Preview Behavior:** during deploy previews, `scripts/build-site.mjs` automatically points the proxy at the matching Astro preview:

```javascript
if (process.env.CONTEXT === 'deploy-preview' && process.env.REVIEW_ID) {
  return `https://deploy-preview-${process.env.REVIEW_ID}--nx-docs.netlify.app`;
}
```

### Netlify Functions (AI embeddings API)

**Location:** `/netlify/functions/query-ai-embeddings.ts`

An Express app (wrapped with `serverless-http`) serving `POST /api/query-ai-embeddings`. It is consumed by the Nx MCP server (nx-console) for the `nx_docs` tool: it embeds the query (OpenAI), matches doc sections (Supabase vector search), and returns token-limited context. The embeddings themselves are regenerated by `.github/workflows/generate-embeddings.yml` from the astro-docs build.

The old `/ai-chat` page and its `/api/query-ai-handler` endpoint were removed; `/ai-chat` now 301s to `/`.

## Configuration Files

### Edge Functions

**Location:** `/netlify/edge-functions/` (repo root)

#### Why are edge functions at the repo root?

Netlify auto-discovers edge functions from `netlify/edge-functions/` relative to the **base directory**, which is the repository root for this site. Custom paths via `edge_functions` in netlify.toml are not recognized.

### Redirects

**Location:** `nx-dev/nx-dev/_redirects` (checked in) plus rules generated into `dist/_redirects` by `scripts/build-site.mjs`.

**File Structure:**

```text
# --- section-name ---
/old-path /new-path 301
/pattern/* /new-pattern/:splat 301
```

### Netlify Configuration

**Location:** `netlify.toml` (repo root - Netlify only reads the config file from the site's base directory, which is the repo root)

Defines the build command (`npx nx run nx-dev:build`), publish directory (`nx-dev/nx-dev/dist`), the functions directory (`netlify/functions` with esbuild bundling), `NETLIFY_NEXT_PLUGIN_SKIP` (the root package.json still depends on `next`, so Netlify would otherwise auto-inject the Next.js runtime), security headers, and the versioned-domain redirects (`16.nx.dev` etc.).

## Environment Variables

| Variable                       | Description                                 | Example                                     |
| ------------------------------ | ------------------------------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_FRAMER_URL`       | Framer site URL for marketing pages         | `https://ready-knowledge-238309.framer.app` |
| `NEXT_PUBLIC_ASTRO_URL`        | Astro docs site URL                         | `https://master--nx-docs.netlify.app`       |
| `BLOG_URL`                     | nx-blog site URL for blog/changelog/courses | `https://blog.nx.app`                       |
| `NX_DEV_URL`                   | Canonical site URL for sitemap              | `https://nx.dev`                            |
| `NEXT_PUBLIC_NO_INDEX`         | Set to `true` to empty the sitemap index    | `true`                                      |
| `GA_MEASUREMENT_ID`            | GA4 measurement ID (edge tracking)          | `G-XXXXXXXXXX`                              |
| `GA_API_SECRET`                | GA4 API secret (edge tracking)              | -                                           |
| `NX_OPENAI_KEY`                | OpenAI key for the embeddings function      | -                                           |
| `NX_NEXT_PUBLIC_SUPABASE_URL`  | Supabase URL for the embeddings function    | -                                           |
| `NX_SUPABASE_SERVICE_ROLE_KEY` | Supabase service key for the function       | -                                           |
| `NX_TOKEN_COUNT_LIMIT`         | Context token limit (optional, default 500) | `500`                                       |

The `NEXT_PUBLIC_*` names are kept from the Next.js era so the existing Netlify site configuration keeps working.

## Sitemap Configuration

`scripts/build-site.mjs` writes a static `sitemap.xml` index referencing:

1. **Framer sitemap** (`/sitemap-1.xml`) - proxied via `additional-sitemaps.ts`
2. **nx-blog sitemap** (`/sitemap-2.xml`, includes blog/changelog/courses) - proxied via `additional-sitemaps.ts`
3. **Astro sitemap** (`/docs/sitemap-index.xml`) - served by astro-docs

## Common Tasks

### Adding a New Redirect

1. Open `nx-dev/nx-dev/_redirects`
2. Find the appropriate section (or create a new one with `# --- section-name ---`)
3. Add the redirect rule: `/old-path /new-path 301`
4. **Important:** Specific rules must come before wildcard rules

### Adding a Path to This Site (Bypass Framer)

1. Open `netlify/edge-functions/rewrite-framer-urls.ts`
2. Add the path to `excludedPath` in the config export (Netlify skips the edge function entirely), or `passThroughPaths` (the function passes it through)
3. Serve it via `public/`, a `_redirects` rule, or a function

### Adding a Path to Framer

By default, all paths go to Framer unless excluded. To add a new marketing page:

1. Create the page in Framer
2. Verify it's not in `excludedPath` or `passThroughPaths`
3. Update `scripts/documentation/internal-link-checker.ts` `framerPaths` array for link validation

### Debugging 404 Errors

1. **Check the edge function:** Is the path being proxied to Framer when it shouldn't be? Check the `x-nx-edge-function` response header (`framer-proxy` or `blog-proxy`)
2. **Check redirects:** Review `_redirects` (and the generated rules in the deployed `dist/_redirects`) - first match wins, order matters
3. **Check the upstream:** Does the page exist on Framer / nx-blog / astro-docs? Access the upstream URL directly

### Testing Locally

```bash
nx build nx-dev
npx serve nx-dev/nx-dev/dist -p 8000
```

Note: edge functions, `_redirects` proxying, and the serverless function don't run with a plain static server. Use `netlify dev` or a deploy preview to test routing end to end.

## Redeploying After Environment Variable Changes

Netlify environment variables are baked in at build time (`_redirects` proxy rules, sitemap). Changing a variable in the Netlify UI does **not** take effect until the site is redeployed:

```bash
# Redeploy the docs site (Astro)
netlify deploy --trigger --prod -s nx-docs

# Redeploy the main site (this router)
netlify deploy --trigger --prod -s nx-dev

# Redeploy the blog
netlify deploy --trigger --prod -s nrwl-blog
```

## Deploy Previews

- **nx-dev (router):** `https://deploy-preview-{PR}--nxdev.netlify.app`
- **astro-docs:** `https://deploy-preview-{PR}--nx-docs.netlify.app`

During deploy previews, the build automatically points the `/docs/*` proxy at the matching Astro preview based on `REVIEW_ID`.

## Related Resources

- [Netlify Edge Functions Documentation](https://docs.netlify.com/edge-functions/overview/)
- [Netlify Redirects Documentation](https://docs.netlify.com/routing/redirects/)
- [astro-docs/README.md](../../astro-docs/README.md) - Astro documentation site
- [netlify/edge-functions/README.md](../../netlify/edge-functions/README.md) - Edge function details
