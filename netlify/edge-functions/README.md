# Netlify Edge Functions

This directory contains edge functions for the **nx-dev** Next.js application (`nx-dev/nx-dev/`).

## Why are edge functions at the repo root?

Edge functions must be placed here (at the repository root) because of how the nx-dev Netlify site is configured:

- **Base directory**: `.` (repository root)
- **Publish directory**: `./nx-dev/nx-dev/.next`

Netlify auto-discovers edge functions from `netlify/edge-functions/` relative to the **base directory**. Since the base directory is the repo root, edge functions must be placed here rather than inside `nx-dev/nx-dev/`.

We attempted to configure a custom path via `edge_functions = "nx-dev/nx-dev/netlify/edge-functions"` in netlify.toml, but this was not recognized by Netlify's build system.

## Edge Functions

### `rewrite-framer-urls.ts`

Proxies all requests to Framer by default and rewrites URLs in the HTML response to use `nx.dev` instead of the Framer domain. Only paths explicitly kept in Next.js (defined in the `nextjsPaths` set and `excludedPath` config) bypass the proxy.

This ensures:

- Canonical URLs point to nx.dev
- No duplicate indexing by search engines
- Consistent branding in meta tags and links

**Environment variables** (configured in Netlify):

- `NEXT_PUBLIC_FRAMER_URL`: The Framer site URL (e.g., `https://ready-knowledge-238309.framer.app`)

### `framer-sitemap.ts`

Proxies Framer's `sitemap.xml` at the path `/sitemap-1.xml` and rewrites URLs to use `nx.dev`. This is a separate edge function from the main Framer proxy so that the main function can keep `accept: ['text/html']` for compute cost savings.

The Next.js sitemap index (`sitemap.xml`) references `/sitemap-1.xml` via the `additionalSitemaps` config in `next-sitemap.config.js`.

**Environment variables** (configured in Netlify):

- `NEXT_PUBLIC_FRAMER_URL`: Same as the main proxy function

## Future

This directory can be removed once the nx-dev Next.js application is retired and all pages are served from the Astro-based documentation site.
