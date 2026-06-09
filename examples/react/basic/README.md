# examples-react-basic

A React app built with **Vite**, unit-tested with **Vitest**, end-to-end
tested with **Playwright**, and linted with **ESLint**. It exists to dogfood
the Nx plugins from this repository: the dependencies are linked with
`workspace:*`, so the example always runs against the local source of
`@nx/vite`, `@nx/react`, `@nx/playwright`, and `@nx/eslint` rather than a
published release.

## How the local packages are linked

- `package.json` declares `@nx/vite`, `@nx/react`, `@nx/playwright`, and
  `@nx/eslint` as `workspace:*` dependencies. pnpm symlinks them to `packages/*`.
- The `@nx/vite` / `@nx/vitest` / `@nx/playwright` / `@nx/eslint` plugins infer
  this project's targets from `vite.config.mts`, `playwright.config.ts`, and
  `eslint.config.mjs`.
- `playwright.config.ts` imports `nxE2EPreset` from the local `@nx/playwright`.
- `eslint.config.mjs` re-exports the workspace's root `baseConfig`.

> This is a TypeScript-solution workspace, so `vite.config.mts` does **not** use
> the legacy `nxViteTsPaths` / `nxCopyAssetsPlugin` helpers — workspace packages
> resolve through their `package.json` `exports` and the project references in
> `tsconfig.app.json`.

## Targets

Targets are inferred by the Nx plugins (see the `examples/react/**`
entries in the root `nx.json`):

| Target    | Inferred by            | What it does                          |
| --------- | ---------------------- | ------------------------------------- |
| `build`   | `@nx/vite/plugin`      | `vite build` → `dist/`                |
| `serve`   | `@nx/vite/plugin`      | Vite dev server on port 4200          |
| `preview` | `@nx/vite/plugin`      | Serves the production build           |
| `test`    | `@nx/vitest`           | Runs the Vitest unit tests            |
| `pw-e2e`  | `@nx/playwright/plugin`| Runs the Playwright e2e tests         |
| `lint`    | `@nx/eslint/plugin`    | Lints the project with ESLint         |

```bash
# From the workspace root
nx build examples-react-basic
nx test examples-react-basic
nx serve examples-react-basic
nx pw-e2e examples-react-basic
nx lint examples-react-basic
```

> The Playwright targets need browsers installed once: `npx playwright install chromium`.
