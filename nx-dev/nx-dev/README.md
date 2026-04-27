# nx.dev

This folder contains the app and libs to power [nx.dev](https://nx.dev).

## Canary Docs

`canary.nx.dev` is a Netlify branch deploy of the `canary` orphan branch. Its `netlify.toml` proxies `/docs/*` to `https://master--nx-docs.netlify.app/docs/:splat` so content comes live from master's astro-docs deploy; non-docs paths 301 to `/docs/getting-started/intro`. No build runs, and the branch doesn't need updating — master's deploy updates, canary follows.

## Versioned Docs

The previous major's docs are preserved at `{major}.nx.dev` (e.g. `22.nx.dev`) using pre-built static snapshots on orphan branches, deployed via Netlify branch deploys.

**The primary docs site now lives in `astro-docs/`.** This Next.js app is only built into a versioned snapshot for legacy majors (Nx 18–20) and will stop being versioned once those are retired. See [`astro-docs/README.md`](../../astro-docs/README.md#versioned-docs) for the authoritative versioning workflow.

### Creating a Version Snapshot

From the repo root:

```bash
# Nx 21+ (builds astro-docs)
node ./scripts/create-versioned-docs.mts 22

# Nx 18–20 (builds this Next.js app with static export) — legacy path
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

- **Netlify** — each `{major}` branch is deployed as a [branch deploy](https://docs.netlify.com/site-deploys/overview/#branch-deploy-controls). The branch's root `netlify.toml` overrides the UI build settings so Netlify serves the pre-built static files (no rebuild, no `@netlify/plugin-nextjs`). Add the branch to the site's branch deploy allowlist, then add `{major}.nx.dev` as a domain alias pointing at the branch deploy
- **Squarespace** — DNS for `nx.dev` is managed in Squarespace. Add a CNAME for `{major}` pointing at the Netlify branch deploy hostname

## Banner Configuration

The floating banner promotes events/webinars. It's fetched at **build time** from a Framer CMS page and stored locally.

### Setup

Set `NEXT_PUBLIC_BANNER_URL` to point to a Framer page that renders banner JSON:

```
NEXT_PUBLIC_BANNER_URL=https://your-framer-site.framer.app/api/banners/main
```

The Framer page should render JSON inside a `<pre>` tag:

```json
{
  "title": "Event Title",
  "description": "Event description",
  "primaryCtaUrl": "https://...",
  "primaryCtaText": "Learn More",
  "secondaryCtaUrl": "",
  "secondaryCtaText": "",
  "enabled": true,
  "activeUntil": "2025-12-31T00:00:00.000Z"
}
```

### Schema

| Field              | Type     | Required | Description               |
| ------------------ | -------- | -------- | ------------------------- |
| `title`            | string   | Yes      | Banner headline           |
| `description`      | string   | Yes      | Banner body text          |
| `primaryCtaUrl`    | string   | Yes      | Primary button URL        |
| `primaryCtaText`   | string   | Yes      | Primary button text       |
| `secondaryCtaUrl`  | string   | No       | Secondary button URL      |
| `secondaryCtaText` | string   | No       | Secondary button text     |
| `enabled`          | boolean  | Yes      | Show/hide the banner      |
| `activeUntil`      | ISO 8601 | No       | Auto-hide after this date |

### Behavior

- Banner is fetched during `prebuild-banner` target and saved to `lib/banner.json` as a collection (array)
- Requires rebuild/redeploy to update the banner
- Users can dismiss the banner (stored in localStorage)
- If `enabled` is `false` or `activeUntil` has passed, the banner won't show
- If `NEXT_PUBLIC_BANNER_URL` is not set, an empty collection is generated
