# Netlify Edge Functions

This directory contains edge functions for the **nx-dev** Netlify site - the static router that serves [nx.dev](https://nx.dev) (`nx-dev/nx-dev/`).

## Why are edge functions at the repo root?

Edge functions must be placed here (at the repository root) because of how the nx-dev Netlify site is configured:

- **Base directory**: `.` (repository root)
- **Publish directory**: `./nx-dev/nx-dev/dist`

Netlify auto-discovers edge functions from `netlify/edge-functions/` relative to the **base directory**. Since the base directory is the repo root, edge functions must be placed here rather than inside `nx-dev/nx-dev/`.

We attempted to configure a custom path via `edge_functions = "nx-dev/nx-dev/netlify/edge-functions"` in netlify.toml, but this was not recognized by Netlify's build system.

## Edge Functions

### `rewrite-framer-urls.ts`

Proxies all requests to Framer by default and rewrites URLs in the HTML response to use `nx.dev` instead of the Framer domain. Blog, changelog, and courses paths are proxied to the standalone nx-blog site (`BLOG_URL`) the same way. Only paths in the `excludedPath` config (docs, api, static assets, legacy redirect paths) bypass the proxy and fall through to the static site.

This ensures:

- Canonical URLs point to nx.dev
- No duplicate indexing by search engines
- Consistent branding in meta tags and links

**Environment variables** (configured in Netlify):

- `NEXT_PUBLIC_FRAMER_URL`: The Framer site URL (e.g., `https://ready-knowledge-238309.framer.app`)
- `BLOG_URL`: The nx-blog site URL (e.g., `https://blog.nx.app`)
- `GA_MEASUREMENT_ID` / `GA_API_SECRET`: GA4 server-side page tracking

### `api-geo-block.ts`

Blocks `/api/*` requests from countries where the OpenAI-backed endpoints cannot be offered, before the request reaches the `query-ai-embeddings` Netlify Function (`netlify/functions/`).

### `additional-sitemaps.ts`

Proxies the per-source sitemaps referenced by the root sitemap index and rewrites URLs to use `nx.dev`. Separate from the main Framer/blog proxy so that proxy can keep `accept: ['text/html']` for compute cost savings.

| Path             | Upstream                               | Env var                  |
| ---------------- | -------------------------------------- | ------------------------ |
| `/sitemap-1.xml` | `<NEXT_PUBLIC_FRAMER_URL>/sitemap.xml` | `NEXT_PUBLIC_FRAMER_URL` |
| `/sitemap-2.xml` | `<BLOG_URL>/blog/sitemap.xml`          | `BLOG_URL`               |

The root sitemap index referencing these is written by `nx-dev/nx-dev/scripts/build-site.mjs`.
