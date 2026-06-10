# examples-react-basic

A React app built with **Vite**, unit-tested with **Vitest**, end-to-end
tested with **Playwright**, and linted with **ESLint**. It exists to dogfood
the Nx plugins from this repository: it is a **standalone Nx + pnpm
workspace** whose `@nx/*` dependencies are `link:`ed to the local
`packages/*`, so target inference and runtime helpers come from the local
builds rather than a published release.

## How it is wired

- This directory is its own pnpm workspace (`pnpm-workspace.yaml`) with its
  own committed `pnpm-lock.yaml`, excluded from the repo root workspace and
  `.nxignore`d from the root Nx graph.
- `package.json` declares `@nx/vite`, `@nx/react`, `@nx/playwright`,
  `@nx/eslint`, and `@nx/eslint-plugin` as `link:../../../packages/*`
  dependencies — `link:` works across workspace boundaries, and pnpm
  symlinks them straight to the local packages.
- This directory's own `nx.json` registers the plugins; because plugin
  resolution starts from this workspace's `node_modules`, the **local**
  plugin builds create the targets.
- `postinstall` builds the linked packages through the repo root
  (`nx run-many -t build -p vite react playwright eslint eslint-plugin`), so
  a fresh clone works with just `pnpm install`.
- `playwright.config.ts` imports `nxE2EPreset` from the local
  `@nx/playwright`; `eslint.config.mjs` uses the local `@nx/eslint-plugin`
  flat configs.

> Editing the local packages does not rebuild them automatically — this
> workspace's graph cannot see them. Re-run the postinstall command (or
> `pnpm nx run-many -t build -p vite react playwright eslint eslint-plugin`
> at the repo root) after changing plugin sources.

## Targets

Targets are inferred by the plugins registered in this directory's `nx.json`:

| Target  | Inferred by             | What it does                  |
| ------- | ----------------------- | ----------------------------- |
| `build` | `@nx/vite/plugin`       | `vite build` → `dist/`        |
| `serve` | `@nx/vite/plugin`       | Vite dev server on port 4200  |
| `preview` | `@nx/vite/plugin`     | Serves the production build   |
| `test`  | `@nx/vitest`            | Runs the Vitest unit tests    |
| `e2e`   | `@nx/playwright/plugin` | Runs the Playwright e2e tests |
| `lint`  | `@nx/eslint/plugin`     | Lints the project with ESLint |

```bash
# From this directory
pnpm install        # also builds the linked local packages
nx build
nx test
nx serve
nx e2e
nx lint
```

> The Playwright target needs browsers installed once: `npx playwright install chromium`.
