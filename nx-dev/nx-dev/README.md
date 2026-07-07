# nx.dev

This folder contains the static router site for [nx.dev](https://nx.dev). It no longer contains an application framework - the site is a set of static assets (`public/`), redirect rules (`_redirects`), and a small build script (`scripts/build-site.mjs`) that assembles the deployable output in `dist/`.

All page content is served by other systems and proxied/redirected from here:

- **Framer** - marketing pages (default for all paths)
- **astro-docs** (`astro-docs/`) - `/docs/*`, proxied via generated `_redirects` rules
- **nx-blog** (separate repo) - `/blog`, `/changelog`, `/courses`, proxied via the `rewrite-framer-urls` edge function
- **Netlify Functions** (`netlify/functions/`) - `/api/query-ai-embeddings` for the Nx MCP `nx_docs` tool

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full routing architecture.

## Building

```bash
nx build nx-dev   # writes dist/ (static assets + _redirects + sitemap.xml)
```

The build reads `NEXT_PUBLIC_ASTRO_URL` (astro-docs origin), `NX_DEV_URL` (canonical site URL for the sitemap index), and `NEXT_PUBLIC_NO_INDEX`. On deploy previews it automatically points the docs proxy at the matching astro-docs preview.

## Canary Docs

`canary.nx.dev` is a Netlify branch deploy of the `canary` orphan branch. Its `netlify.toml` proxies `/docs/*` to `https://master--nx-docs.netlify.app/docs/:splat` so content comes live from master's astro-docs deploy; non-docs paths 301 to `/docs/getting-started/intro`. No build runs, and the branch doesn't need updating — master's deploy updates, canary follows.

## Versioned Docs

The previous major's docs are preserved at `{major}.nx.dev` (e.g. `22.nx.dev`) using pre-built static snapshots on orphan branches, deployed via Netlify branch deploys.

**The primary docs site lives in `astro-docs/`.** Legacy majors (Nx 18–20) are versioned by building the old Next.js app from the corresponding release tags (the app no longer exists on master; the snapshot script checks out the tag to build). See [`astro-docs/README.md`](../../astro-docs/README.md#versioned-docs) for the authoritative versioning workflow.

### Creating a Version Snapshot

From the repo root:

```bash
# Nx 21+ (builds astro-docs)
node ./scripts/create-versioned-docs.mts 22

# Nx 18–20 (builds the old Next.js app from the release tag) — legacy path
node ./scripts/create-versioned-docs.mts 20

# Retire an old versioned site (301 everything to nx.dev/docs, no build)
node ./scripts/create-versioned-docs.mts 16 --redirect-to-prod
```

The script finds the latest stable tag for that major, checks it out, builds, and creates an orphan branch named `{major}` containing only the pre-built static site plus minimal scaffolding (root `package.json`, `nx.json`, `pnpm-lock.yaml`, `netlify.toml`, and a no-op `nx-dev` project) so Netlify's UI-configured build command succeeds instantly.

Pass `--force` to overwrite an existing local/remote `{major}` branch.

```bash
git push -f origin 22
```

### Deployment Setup

Versioned sites are served via Netlify branch deploys of the main `nx-dev` Netlify site, with custom domains managed in Squarespace.

- **Netlify** — each `{major}` branch is deployed as a [branch deploy](https://docs.netlify.com/site-deploys/overview/#branch-deploy-controls). The branch's root `netlify.toml` overrides the UI build settings so Netlify serves the pre-built static files (no rebuild). Add the branch to the site's branch deploy allowlist, then add `{major}.nx.dev` as a domain alias pointing at the branch deploy
- **Squarespace** — DNS for `nx.dev` is managed in Squarespace. Add a CNAME for `{major}` pointing at the Netlify branch deploy hostname
