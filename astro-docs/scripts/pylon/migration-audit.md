# Pylon KB migration audit — Knowledge Base sidebar tab

Generated 2026-07-09 for the full Knowledge Base tab migration (124 sidebar routes).
Covers: every mdoc-tag → HTML conversion the migrator performs (including those used by
the ~56 articles migrated in earlier batches), per-article flags where the conversion is
lossy or a judgment call, the 6-month GA traffic audit, and pages deleted instead of
migrated. **Everything is reversible** — sources live in git history and articles can be
unpublished in Pylon.

## 0. Results

- **118 articles migrated** and published (Pylon returned one 429 mid-run at ~115; the
  idempotent re-run completed the remainder). A 119th — the eslint-plugin introduction —
  was migrated, then **restored to docs and deleted from Pylon**: the generated
  plugin-registry page links every official plugin to its
  `technologies/<cat>/<plugin>/introduction` page, so that page is structural.
- **4 pages deleted** without migration (section 4); **3 structural pages kept in docs**
  (Source Control Integration hub, eslint-plugin introduction + its hub index).
- **143 source files removed** net (118 articles + 4 deleted pages + 21 emptied
  section/hub index pages), **~250 inbound links rewritten** across 105 staying files.
- The Pylon KB now holds **173 published articles** (55 prior + 118 this batch), all in
  the "Nx Knowledge Base" collection; `src/content/pylon-kb.json` has 174 mapping entries
  (one merged duplicate pair from the first batch).
- Redirects in `netlify.toml` (generated block + 4 repointed manual rules): **185 rules
  to help.nx.app** and 19 forced internal 301s for deleted hubs/pages; parser-validated,
  0 errors. Site builds green: `validate-links` passes, search index holds 615 pages
  (442 site + 173 KB records), llms.txt lists 174 KB links.

### Update 2026-07-10: all migrated articles are unlisted

Every article tracked in `pylon-kb.json` is set to `is_unlisted: true` in Pylon —
reachable by direct link only: removed from the KB portal navigation, collection pages,
and help.nx.app's sitemap.xml. Direct URLs still return 200, and the nx.dev search
federation is unaffected (it filters on published + public visibility, not unlisted).
The migrate script now asserts `is_unlisted: true` on every create and update, so future
batches inherit this. Note: unlisting does not add a `noindex` meta tag; the 301s from
nx.dev remain in place per Caleb's call (2026-07-10).

## 1. mdoc tag → Pylon HTML conversions

Pylon articles are `body_html`; its sanitizer preserves iframes, `<details>`, tables and
class attributes (probed 2026-07-07). Conversions marked ⚠️ lose interactivity or fidelity
— review these if the result matters.

| Tag                                                                               | Conversion                                                                                                                                                                                                                                         | Fidelity              |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `aside` / `callout`                                                               | `<blockquote>` with a bold emoji label (ℹ️ Note, 💡 Tip, ⚠️ Caution/Warning, 🚨 Danger, ✅ Check, 📢 Announcement, 🔍 Deep dive); custom `title` attr wins                                                                                         | good                  |
| `youtube`                                                                         | `<iframe>` embed (560×315), watch/youtu.be URLs rewritten to `/embed/`                                                                                                                                                                             | good                  |
| `tabs` / `tabitem`                                                                | ⚠️ flattened to sequential sections — each tab label becomes an `<h3>` followed by the tab body; no tab switching                                                                                                                                  | lossy (layout)        |
| `filetree`                                                                        | plain `<div>` wrapping the nested list                                                                                                                                                                                                             | ok                    |
| `llm_copy_prompt`                                                                 | `<details><summary><strong>title</strong></summary>…`                                                                                                                                                                                              | good                  |
| `llm_only`                                                                        | dropped entirely (LLM-only content has no reader value in the KB)                                                                                                                                                                                  | intentional           |
| `github_repository` / `github-repository`                                         | paragraph link "Example repository: URL"                                                                                                                                                                                                           | good                  |
| `cardgrid` + `linkcard`                                                           | `<ul>` of links with " — description" suffix                                                                                                                                                                                                       | ok                    |
| `card`                                                                            | paragraph with bold link + " — description"                                                                                                                                                                                                        | ok                    |
| `badge`                                                                           | `<em>(text)</em>` inline (e.g. heading "… (optional)")                                                                                                                                                                                             | ok                    |
| `graph`                                                                           | ⚠️ static PNG screenshot (captured via Playwright from the live component, light theme) + note "Static snapshot of the interactive graph. Run `nx graph` …". Screenshots registered per page in `GRAPH_SCREENSHOTS`, one per tag in document order | lossy (interactivity) |
| `project_details`                                                                 | ⚠️ bold title + the JSON config as a plain code block + note "Static snapshot of the interactive Project Details view. Run `nx show project <name>` …"                                                                                             | lossy (interactivity) |
| `index_page_cards`                                                                | ⚠️ static `<ul>` of links to the section's direct child pages, **snapshotted at migration time** — dynamically generated child pages (plugin API docs) are NOT enumerated, and the list won't update if children change later                      | lossy (dynamic)       |
| `course_video`                                                                    | `<iframe>` embed + "Part of the course: [title](url)" line                                                                                                                                                                                         | good                  |
| `call_to_action`                                                                  | paragraph with bold link + " — description" (button styling lost)                                                                                                                                                                                  | ok                    |
| code-fence `{% frame="terminal" title="…" %}` / `{% meta="{6-10}" %}` annotations | ⚠️ silently dropped — code renders as a plain `<pre><code>`; terminal chrome, fence titles and line-highlighting are lost                                                                                                                          | lossy (styling)       |
| markdown links                                                                    | root-relative and page-relative hrefs absolutized to `https://nx.dev/...` (links to other migrated pages resolve via the 301s)                                                                                                                     | good                  |
| images                                                                            | local images uploaded to Pylon attachments (assets.usepylon.com signed URLs, expiry year 9999); absolute-path images rewritten to `https://nx.dev/...`                                                                                             | good                  |

## 2. Flagged articles (lossy or judgment-call conversions)

### Interactive `{% graph %}` → static screenshot

- `guides/tips-n-tricks/identify-dependencies-between-folders` (earlier batch, 1 graph)
- `guides/tips-n-tricks/feature-based-testing` (1)
- `concepts/ci-concepts/reduce-waste` (**7 graphs** — the affected-visualisation walkthrough leans on these)
- `guides/tasks--caching/configure-inputs` (1)
- `guides/tasks--caching/workspace-watching` (1)
- `features/maintain-typescript-monorepos` (2)
- `technologies/angular/guides/nx-and-angular` (1)

### Interactive `{% project_details %}` → static code block

- `features/maintain-typescript-monorepos`
- `guides/tasks--caching/configure-inputs`
- `guides/tasks--caching/convert-to-inferred`
- `guides/tasks--caching/pass-args-to-commands`

### `{% index_page_cards %}` → static link list

- `technologies/eslint/eslint-plugin/introduction` — initially migrated, then **restored
  to docs** (the generated plugin-registry page links to it); its Pylon copy was deleted.
- `guides/nx-cloud/source-control-integration` (section hub) — **not migrated and kept in
  docs**: its provider child pages (github/gitlab/bitbucket/azure-devops) stay in docs and
  two staying pages link to the hub, so it remains as their navigation page (it is no
  longer in any sidebar tab).

### Tab-heavy articles (tabs flattened to h3 sections)

41 articles use `tabs`/`tabitem` — biggest: `guides/nx-cloud/setup-ci` (per-CI-provider
tabs), the package-manager workspace guides, `technologies/typescript/guides/js-and-ts`.
Readable but longer; tab labels become plain headings.

### Duplicate titles in Pylon

- "Module Federation with Server-Side Rendering" exists twice (Angular and React
  variants). Slugs are disambiguated (`angular-…`/`react-…`) but the KB listing shows two
  identical titles — consider renaming in the Pylon UI.

### Other

- `extending-nx/project-graph-plugins` contains a commented-out `github-repository` tag —
  converted harmlessly (Markdoc parses tags inside HTML comments).
- `guides/nx-cloud/setup-ci` uses `course_video` — embeds the video and links the course.

## 3. GA traffic audit (nx.dev property, Jan 9 – Jul 8 2026, monthly windows)

Method: GA4 "Pages and screens" (page path), six 1-month windows, all `/docs/` rows
swept to the zero-view floor per window; `.md` twin paths (LLM fetches) counted
separately and excluded from decisions.

Context that shaped the thresholds:

- **Site-wide decline**: docs traffic fell ~85% Jan → Jun across the entire cohort, so
  absolute June numbers are small everywhere. A page is only "extremely low" if it was
  ALSO weak back in January (site at ~5x current traffic) — this is the "not just a
  recent dip" guard.
- **February is bot-inflated**: a uniform ~250–320 view floor appears under nearly every
  path in the Feb 9 – Mar 8 window (pages otherwise at ~90 views spike to ~270 and fall
  back). February was excluded from judgment.
- **Route moves look like death**: pages with leading-zero months (npm/pnpm/yarn/bun
  workspace guides, use-bun, bring-your-own-compute, launch-template-examples,
  github-app-permissions, deploying/bundling-node-projects, performant-project-graph-
  plugins, consumer-and-provider, vite-module-federation) changed URL recently; they were
  exempted from deletion since the series is partial.

Full per-route monthly series: `kb-traffic.txt` (kept alongside this audit as
`migration-audit-traffic.txt`). Format: `route|jan,feb,mar,apr,may,jun|md-twin-views`.

## 4. Deleted (not migrated) — extremely low traffic

Rule applied: live on the same route all 6 months, < ~100 views in January (already weak
at the traffic peak), and < ~30 combined May+June views. Judgment overrides kept some
technically-qualifying pages (noted below).

| Page                                                          | Jan→Jun views             | Redirect                   |
| ------------------------------------------------------------- | ------------------------- | -------------------------- |
| `technologies/test-tools/storybook/guides/overview-vue`       | 90, 261\*, 54, 23, 1, 2   | storybook introduction     |
| `concepts/ci-concepts/heartbeat-and-manual-shutdown-handling` | 88, 267\*, 65, 23, 5, 4   | /docs/features/ci-features |
| `reference/benchmarks/caching`                                | 89, 262\*, 48, 27, 9, 7   | /docs                      |
| `reference/benchmarks/nx-agents`                              | 81, 320\*, 56, 29, 14, 12 | /docs                      |

\* February bot-inflation.

Qualifying on traffic but **migrated anyway** (judgment):

- `reference/nx-cloud/custom-steps` (86, 277, 55, 30, 4, 9) — sole reference doc for a
  live Nx Cloud enterprise feature.
- `technologies/test-tools/storybook/guides/one-storybook-per-scope` (91, 257, 46, 37, 4, 10)
  — one of the coherent one-storybook trio; deleting one leg breaks the set.

## 5. Structural changes

- The **Knowledge Base sidebar tab is removed** (all 124 routes left the docs).
- Fully-emptied section hubs deleted, routes 301 to the KB collection: troubleshooting,
  extending-nx, guides/nx-console, guides/installation, guides/tasks--caching,
  reference/benchmarks.
- Emptied technology guide hubs 301 to that technology's introduction page (15 hubs:
  typescript, angular, angular/migration, angular-rspack, react, node, dotnet,
  module-federation guides+concepts, eslint, eslint-plugin (+ its hub), vite, webpack,
  cypress, storybook).
- All inbound links from remaining docs rewritten to the `help.nx.app` article URLs.
- Redirects are managed in `astro-docs/netlify.toml` (generated block); the mapping in
  `src/content/pylon-kb.json` is the source of truth.
