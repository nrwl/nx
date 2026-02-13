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

Proxies requests to Framer-hosted pages and rewrites URLs in the HTML response to use `nx.dev` instead of the Framer domain. This ensures:

- Canonical URLs point to nx.dev
- No duplicate indexing by search engines
- Consistent branding in meta tags and links

**Environment variables** (configured in Netlify):

- `NEXT_PUBLIC_FRAMER_URL`: The Framer site URL (e.g., `https://ready-knowledge-238309.framer.app`)
- `NEXT_PUBLIC_FRAMER_REWRITES`: Comma-separated list of paths to proxy (e.g., `/enterprise,/powerpack`)

## Future

This directory can be removed once the nx-dev Next.js application is retired and all pages are served from the Astro-based documentation site.
