# nrwl/nx label reference

Every mapping here was checked against how the labels are applied on real issues, not against the
label descriptions — several descriptions are narrower than actual usage. When you find a case this
table gets wrong, fix the table.

## Scope labels

At least one is required. Pick by asking **which package's code has to change**.

| Label | Covers | Notes |
| --- | --- | --- |
| `scope: core` | `packages/nx`, `packages/workspace`, `create-nx-workspace` | CLI, daemon, project graph, hashing and caching, `nx migrate`, task running, `targetDefaults`/`dependsOn`, watch, the TUI. Not a fallback — see `scope: misc`. |
| `scope: js` | `packages/js` | `@nx/js` executors, TypeScript project references and `typescript-sync`, `prune-lockfile`, `generatePackageJson` output, TS-driven graph construction. |
| `scope: bundlers` | `packages/{webpack,rspack,rsbuild,vite,rollup,esbuild,angular-rspack,angular-rspack-compiler}` | Description says "webpack, rollup" but usage covers all of them. Vite *build/serve* is here; Vitest is not. |
| `scope: testing tools` | `packages/{jest,cypress,playwright,vitest,detox}` | |
| `scope: linter` | `packages/{eslint,eslint-plugin,oxlint}` | |
| `scope: angular` | `packages/angular` | |
| `scope: react` | `packages/react` | |
| `scope: nextjs` | `packages/next` | |
| `scope: vue` | `packages/{vue,nuxt}` | No separate Nuxt label. |
| `scope: remix` | `packages/remix` | |
| `scope: react-native` | `packages/{react-native,expo}` | Detox goes to `scope: testing tools`. |
| `scope: node` | `packages/{node,express,nest}` | One label for all three, per its description. |
| `scope: storybook` | `packages/storybook` | |
| `scope: module federation` | `packages/module-federation` | Also MF-specific failures surfacing through webpack or rspack. |
| `scope: java` | `packages/{gradle,maven}` | Use this, **not** `scope:gradle`. |
| `scope: dotnet` | `packages/dotnet` | |
| `scope: devkit` | `packages/devkit` | The devkit API surface: `Tree`, generator/executor helpers, `convertNxGenerator`, migration utilities, virtual-tree testing. |
| `scope: plugins` | `packages/{plugin,create-nx-plugin}` | Authoring, loading and running plugins — including a user's local plugin or inference plugin failing. |
| `scope: release` | `nx release` (`packages/nx/src/command-line/release`) | Versioning, changelog, publishing. |
| `scope: docs` | `astro-docs/` content | Pairs with `type: docs`. |
| `scope: repo` | this repo's own CI, build and tooling | Contributor-facing; rare on user issues. |
| `scope: nx-cloud` | Nx Cloud client, distributed execution, cloud remote cache | The service itself lives elsewhere; the label routes it. |
| `scope: self-hosted cache` | self-hosted cache plugins (`@nx/s3-cache` and friends) | Separate codebase. |
| `scope: powerpack` | Powerpack plugins | Separate codebase. |
| `scope: misc` | genuinely cross-cutting, no package home | Observed usage: vulnerable transitive dependency pins, `configure-ai-agents`, Docker release support. Reach for this only after ruling the others out. |

`packages/web` has no label of its own. Route by the failing surface: a build failure to
`scope: bundlers`, the file server to `scope: core`.

**Do not apply:**

- `scope: gatsby` — the plugin is gone.
- `scope:gradle` — malformed duplicate of `scope: java`. It still matches the scraper's
  `startsWith('scope:')` check, so an issue carrying only this one already counts as triaged; add
  `scope: java` alongside it rather than churning the old label.
- `scope: console` — Nx Console is `nrwl/nx-console`. Redirect the reporter there instead.

## Type labels

| Label | Use when |
| --- | --- |
| `type: bug` | Applied automatically by the bug form. Remove it if the issue isn't one; add it if the issue was filed outside the form. |
| `type: docs` | Docs are wrong, missing or misleading. |
| `type: enhancement` | Improve something that already exists. |
| `type: feature` | Something new. Feature requests belong in Discussions (`ISSUE_TEMPLATE/config.yml`) — redirect rather than label. |
| `type: question / discussion` | Usage question. Point at Discussions or Discord and propose a close. |
| `type: cleanup` | Internal tidy-up, no behavior change. |

## Blocked labels

All three of the first ones feed `.github/workflows/schedule-stale.yml`: 7 days of silence adds
`stale`, 21 more days close the issue. Apply exactly one, and only when you can name the missing
thing.

| Label | Means |
| --- | --- |
| `blocked: repro needed` | Understandable report, nothing runnable. |
| `blocked: more info needed` | Can't tell what's broken, or no `nx report` so no version to test. |
| `blocked: retry with latest` | Reproduces on the reported version, which is well behind; ask them to retest. |
| `blocked: third-party` | The bug is upstream. No stale timer. Link the upstream issue. |
| `blocked: needs rebase` | PRs only. Note that the stale workflow watches for `blocked: needs rebased` — with a `d` — so it currently matches nothing. |

## Priority labels

Use the descriptions as written, and cite the evidence.

| Label | Description |
| --- | --- |
| `priority: high` | Important issues which affect many people severely. |
| `priority: medium` | Not high, not low. The default. |
| `priority: low` | Does not affect many people, or not severely, or has an easy workaround. |

## Other

| Label | Use when |
| --- | --- |
| `os: windows` | Reproduces only on Windows. The `nx report` showing win32 is not enough on its own. |
| `community` | Good first issue: small, well scoped, obvious fix location — **and the fix must live in code a contributor can PR**. See Step 10 of the skill. |
| `community: plugin-request` | Better served by a community plugin than by first-party support. |
| `community: plugin-submission` | Someone is submitting a plugin for the registry. |
| `status: closed / duplicate` | Closing as a duplicate. Link the original, and pass `--reason duplicate` as well. |

## Close reasons

`gh issue close --reason` takes exactly these. Pick the honest one — the reason shows on the issue and
in search.

| Reason | Use when |
| --- | --- |
| `completed` | Actually fixed: a merged PR, or a reproduction that now passes on latest/canary. |
| `duplicate` | Same problem as an existing issue. First-class — do not file duplicates under `not planned`. |
| `not planned` | Everything else we won't act on: upstream, out of scope, superseded. |

Closing stale or no-reproduction issues by hand is not on this list on purpose: the stale workflow
owns that countdown.

## Bot-owned — never apply by hand

| Label | Owner |
| --- | --- |
| `stale` | `schedule-stale.yml`, on the countdowns above. |
| `outdated` | `lock-threads.yml`, on threads closed 30+ days. |

## PR-only

`PR status: LGTM`, `PR status: in-progress`, `PR status: tests needed`, `PR status: breaking-changes`,
`PR status: do not merge`, `target: next major version`.
