# nx.dev Deployment Architecture

This document explains how [nx.dev](https://nx.dev) is deployed on Netlify and how requests are routed between three distinct systems: **Framer** (marketing pages), **Next.js** (blog, courses, etc.), and **Astro** (documentation).

## Architecture Overview

```
                              ┌─────────────────────────────────────────────────────────────┐
                              │                         Netlify                             │
                              │                                                             │
┌─────────┐                   │  ┌─────────────────┐                                        │
│ Request │──────────────────▶│  │  Edge Functions │                                        │
│ nx.dev  │                   │  │  (repo root)    │                                        │
└─────────┘                   │  └────────┬────────┘                                        │
                              │           │                                                 │
                              │           ▼                                                 │
                              │  ┌────────────────────────────────────────────────────┐     │
                              │  │              Request Router                         │     │
                              │  │                                                     │     │
                              │  │  1. Edge function: rewrite-framer-urls.ts           │     │
                              │  │  2. _redirects file (301 redirects)                 │     │
                              │  │  3. Next.js rewrites (next.config.js)               │     │
                              │  │  4. Next.js pages/app router                        │     │
                              │  └──────┬────────────────┬────────────────┬────────────┘     │
                              │         │                │                │                 │
                              │         ▼                ▼                ▼                 │
                              │  ┌────────────┐   ┌────────────┐   ┌────────────┐           │
                              │  │   Framer   │   │  Next.js   │   │   Astro    │           │
                              │  │ Marketing  │   │  (nx-dev)  │   │  (docs)    │           │
                              │  └────────────┘   └────────────┘   └────────────┘           │
                              │                                                             │
                              └─────────────────────────────────────────────────────────────┘
```

## Request Flow

When a request hits nx.dev, it goes through the following stages in order:

### 1. Netlify Edge Functions

Edge functions run first, before any other routing. Located at `/netlify/edge-functions/` in the repository root (see [Why repo root?](#why-are-edge-functions-at-the-repo-root)).

| Edge Function            | Path Pattern    | Purpose                                                   |
| ------------------------ | --------------- | --------------------------------------------------------- |
| `rewrite-framer-urls.ts` | `/*`            | Proxies marketing pages to Framer                         |
| `framer-sitemap.ts`      | `/sitemap-1.xml`| Proxies Framer's sitemap with URL rewriting               |

### 2. Netlify Redirects (`_redirects`)

After edge functions, Netlify processes `_redirects`. This file contains **301 permanent redirects** for:

- Legacy URL migrations (e.g., old docs paths to new locations)
- Shortened URLs
- External redirects (e.g., to GitHub, forms)

Rules are processed **top-to-bottom, first match wins**. Specific rules must come before wildcard rules.

### 3. Next.js Rewrites (`next.config.js`)

If no redirect matches, Next.js rewrites handle:

| Pattern             | Destination                      | Description                    |
| ------------------- | -------------------------------- | ------------------------------ |
| `/docs`             | `${ASTRO_URL}/docs`              | Documentation root             |
| `/docs/:path*`      | `${ASTRO_URL}/docs/:path*`       | All documentation pages        |
| `/.netlify/:path*`  | `${ASTRO_URL}/.netlify/:path*`   | Netlify functions/assets       |
| `/llms.txt`         | `${ASTRO_URL}/docs/llms.txt`     | LLM-friendly docs index        |
| `/llms-full.txt`    | `${ASTRO_URL}/docs/llms-full.txt`| Full LLM documentation         |

### 4. Next.js App Router

Finally, if nothing else matches, the Next.js application serves the page from `app/` or returns 404.

## The Three Systems

### Framer (Marketing Pages)

**Environment Variable:** `NEXT_PUBLIC_FRAMER_URL`

Framer hosts the marketing website, including:

- Homepage (`/`)
- `/nx-cloud`
- `/enterprise`, `/enterprise/security`, `/enterprise/trial`
- `/community`, `/company`, `/contact/*`
- `/customers`, `/customer-stories`
- `/solutions/*`, `/partners`
- `/webinars`, `/careers`, `/brands`
- `/java`, `/react`, `/resources`

The `rewrite-framer-urls.ts` edge function:

1. Receives all requests by default (path: `/*`)
2. Checks if the path is in `excludedPath` config or `nextjsPaths` set
3. If excluded, passes to Next.js/Netlify
4. Otherwise, proxies to Framer and rewrites URLs in HTML responses

**URL Rewriting:** All Framer URLs in responses are rewritten from `NEXT_PUBLIC_FRAMER_URL` to `https://nx.dev` to ensure:

- Canonical URLs point to nx.dev
- No duplicate search engine indexing
- Consistent branding in meta tags

### Next.js (Blog, Courses, etc.)

**Location:** `nx-dev/nx-dev/`

The Next.js application handles:

- `/blog`, `/blog/*` - Blog posts
- `/courses`, `/courses/*` - Video courses
- `/pricing` - Pricing page
- `/podcast` - Podcast episodes
- `/ai-chat` - AI assistant
- `/changelog` - Changelog
- `/resources-library` - Resources
- `/whitepaper-fast-ci` - Whitepaper

These paths are defined in `nextjsPaths` within `rewrite-framer-urls.ts` and bypass the Framer proxy.

### Astro (Documentation)

**Location:** `astro-docs/`
**Environment Variable:** `NEXT_PUBLIC_ASTRO_URL`

The Astro site handles all `/docs/*` paths. It's deployed as a separate Netlify site and proxied through Next.js rewrites.

**Deploy Preview Behavior:**

During deploy previews, the Next.js app automatically points to the matching Astro preview:

```javascript
// next.config.js
if (process.env.CONTEXT === 'deploy-preview' && process.env.REVIEW_ID) {
  process.env.NEXT_PUBLIC_ASTRO_URL = `https://deploy-preview-${process.env.REVIEW_ID}--nx-docs.netlify.app`;
}
```

## Configuration Files

### Edge Functions

**Location:** `/netlify/edge-functions/` (repo root)

```
netlify/
└── edge-functions/
    ├── README.md
    ├── rewrite-framer-urls.ts   # Main Framer proxy
    └── framer-sitemap.ts        # Framer sitemap proxy
```

#### Why are edge functions at the repo root?

Edge functions must be at the repo root because of Netlify's configuration:

- **Base directory:** `.` (repository root)
- **Publish directory:** `./nx-dev/nx-dev/.next`

Netlify auto-discovers edge functions from `netlify/edge-functions/` relative to the base directory. Custom paths via `edge_functions` in netlify.toml are not recognized.

### Redirects

**Location:** `nx-dev/nx-dev/_redirects`

The `_redirects` file contains **all 301 permanent redirects**. It is copied to `.next/_redirects` during the Netlify build.

**File Structure:**

```text
# --- section-name ---
/old-path /new-path 301
/pattern/* /new-pattern/:splat 301
```

Sections include:

- `docs` - Documentation entry point
- `cliUrls` - CLI command redirects
- `diataxis` - Legacy structure redirects
- `guideUrls` - Guide page redirects
- `recipesUrls` - Recipe page redirects
- `nxCloudUrls` - Nx Cloud redirects
- `tutorialRedirects` - Tutorial redirects
- `nxApiRedirects` - API reference redirects
- And many more...

### Next.js Configuration

**Location:** `nx-dev/nx-dev/next.config.js`

Key configurations:

- `rewrites()` - Proxies `/docs/*` to Astro
- `transpilePackages` - Workspace libraries
- `headers()` - Security headers
- `outputFileTracingExcludes` - Reduces function bundle size

### Netlify Configuration

**Location:** `nx-dev/nx-dev/netlify.toml`

```toml
[[plugins]]
  package = "@netlify/plugin-nextjs"

[functions]
included_files = [
  "!node_modules/@swc/core-*/**",
  # ... exclusions to stay under 250MB limit
]
```

## Environment Variables

| Variable                 | Description                                              | Example                                          |
| ------------------------ | -------------------------------------------------------- | ------------------------------------------------ |
| `NEXT_PUBLIC_FRAMER_URL` | Framer site URL for marketing pages                      | `https://ready-knowledge-238309.framer.app`      |
| `NEXT_PUBLIC_ASTRO_URL`  | Astro docs site URL                                      | `https://master--nx-docs.netlify.app`            |
| `NEXT_PUBLIC_BANNER_URL` | Framer CMS URL for banner data                           | `https://your-site.framer.app/api/banners/main`  |
| `NX_DEV_URL`             | Canonical site URL for sitemap                           | `https://nx.dev`                                 |
| `NEXT_PUBLIC_NO_INDEX`   | Set to `true` to add noindex robots directive            | `true`                                           |

## Sitemap Configuration

The sitemap is composed of multiple sources:

1. **Next.js sitemap** (`/sitemap.xml`) - Generated by `next-sitemap`
2. **Framer sitemap** (`/sitemap-1.xml`) - Proxied via `framer-sitemap.ts` edge function
3. **Astro sitemap** (`/docs/sitemap-index.xml`) - Served by Astro

The sitemap index references these via `additionalSitemaps` in `next-sitemap.config.js`.

## Common Tasks

### Adding a New Redirect

1. Open `nx-dev/nx-dev/_redirects`
2. Find the appropriate section (or create a new one with `# --- section-name ---`)
3. Add the redirect rule: `/old-path /new-path 301`
4. **Important:** Specific rules must come before wildcard rules

**Example:**

```text
# --- myNewSection ---
/old-feature /docs/new-feature 301
/old-feature/* /docs/new-feature/:splat 301
```

### Adding a Path to Next.js (Bypass Framer)

If you need a path to be served by Next.js instead of Framer:

1. Open `netlify/edge-functions/rewrite-framer-urls.ts`
2. Add the path to `nextjsPaths` set (for exact matches):
   ```typescript
   const nextjsPaths = new Set([
     '/blog',
     '/your-new-path', // Add here
   ]);
   ```
3. Or add to `excludedPath` in the config export (for patterns):
   ```typescript
   excludedPath: [
     '/your-new-path',
     '/your-new-path/*',
   ]
   ```

### Adding a Path to Framer

By default, all paths go to Framer unless excluded. To add a new marketing page:

1. Create the page in Framer
2. Verify it's not in `excludedPath` or `nextjsPaths`
3. Update `scripts/documentation/internal-link-checker.ts` `framerPaths` array for link validation

### Debugging 404 Errors

If a page returns 404:

1. **Check the edge function:** Is the path being proxied to Framer when it shouldn't be?
   - Look at `excludedPath` in `rewrite-framer-urls.ts`
   - Check the `x-nx-edge-function` response header

2. **Check redirects:** Is there a redirect that should match?
   - Review `_redirects` file
   - Remember: first match wins, order matters

3. **Check Next.js rewrites:** Is `/docs/*` proxying correctly?
   - Verify `NEXT_PUBLIC_ASTRO_URL` is set
   - Check Next.js server logs

4. **Check Framer:** Does the page exist in Framer?
   - Access the direct Framer URL: `$NEXT_PUBLIC_FRAMER_URL/your-path`

### Debugging Routing Issues (Server-Side vs Client-Side)

If client-side navigation works but direct URL access fails:

1. **Edge function issue:** The path might be missing from `excludedPath`
2. **Redirect conflict:** A redirect rule might be catching the path
3. **Framer proxy:** Check if Framer returns 404 for that path

**Useful headers to check:**

- `x-nx-edge-function`: `framer-proxy` or `framer-sitemap` indicates edge function handled the request
- `x-nf-request-id`: Netlify request ID for debugging

### Testing Locally

```bash
# Start Next.js dev server
nx serve nx-dev

# The dev server uses NEXT_PUBLIC_ASTRO_URL=https://master--nx-docs.netlify.app by default
```

Note: Edge functions don't run locally. To test edge function behavior, deploy to a Netlify preview.

## Redeploying After Environment Variable Changes

Netlify environment variables are baked in at build time. Changing a variable in the Netlify UI (or via CLI) does **not** take effect until the site is redeployed.

You can trigger a redeployment through the Netlify UI (Deploys > Trigger deploy) or via the Netlify CLI:

```bash
# Redeploy the docs site (Astro)
netlify deploy --trigger --prod -s nx-docs

# Redeploy the main site (Next.js)
netlify deploy --trigger --prod -s nx-dev
```

This is especially important when updating `NEXT_PUBLIC_FRAMER_URL`, `NEXT_PUBLIC_ASTRO_URL`, or any other variable referenced at build time.

## Deploy Previews

- **nx-dev (Next.js):** `https://deploy-preview-{PR}--nxdev.netlify.app`
- **astro-docs:** `https://deploy-preview-{PR}--nx-docs.netlify.app`

During deploy previews, the Next.js app automatically configures `NEXT_PUBLIC_ASTRO_URL` to point to the matching Astro preview based on `REVIEW_ID`.

## Related Resources

- [Netlify Edge Functions Documentation](https://docs.netlify.com/edge-functions/overview/)
- [Netlify Redirects Documentation](https://docs.netlify.com/routing/redirects/)
- [Next.js Rewrites Documentation](https://nextjs.org/docs/pages/api-reference/next-config-js/rewrites)
- [astro-docs/README.md](../../astro-docs/README.md) - Astro documentation site
- [netlify/edge-functions/README.md](../../netlify/edge-functions/README.md) - Edge function details
