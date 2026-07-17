# Next.js 14 -> 15 Migration Instructions for LLM

Migrate the Nx workspace's Next.js projects from 14 to 15. Run the codemod first, fix the rest by hand, build after each project.

## Step 1: Codemod

```bash
npx @next/codemod@canary upgrade 15
```

Pin to `15` (not `latest` - that now resolves to 16). The `@canary` tag is what Next ships the upgrade codemod on. Handles most async-API rewrites. Review the diff.

## Step 2: React 19 (App Router only)

Next 15 App Router requires React 19. Page Router can stay on React 18. For App Router projects, also run the React 18 -> 19 migration.

## Step 3: Async request APIs (main breaking change)

`cookies`, `headers`, `draftMode`, `params`, `searchParams` are now async. Codemod covers most; fix leftovers.

```tsx
// before
const { slug } = params;
// after
const { slug } = await props.params;
```

Make the component / handler `async` and `await` the value.

App Router only - Pages Router `getServerSideProps` / `getStaticProps` / `getStaticPaths` `context.params` is NOT async; leave it unchanged.

## Step 4: Caching defaults changed

No longer cached by default: `fetch`, GET route handlers, client navigations. Re-add caching where you relied on it.

- `fetch(url, { cache: 'force-cache' })`
- Route handler: `export const dynamic = 'force-static'`

## Step 5: Misc

- `@next/font` removed -> import from `next/font`.
- Route `runtime: 'experimental-edge'` -> `runtime: 'edge'`.
- `next.config` renames: `experimental.bundlePagesExternals` -> top-level `bundlePagesRouterDependencies`; `experimental.serverComponentsExternalPackages` -> top-level `serverExternalPackages`.
- `NextRequest.geo` / `request.ip` removed (e.g. in middleware) -> read from headers (`x-forwarded-for`, platform geo headers).

## Validate

```bash
nx run PROJECT:build
nx affected -t build,lint,test
```

## Notes for LLM

- Codemod first, then manual.
- One project at a time, build after each.
- Skip Step 2 for Page Router projects.
