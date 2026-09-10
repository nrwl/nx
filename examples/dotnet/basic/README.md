# examples-dotnet-basic

A small .NET solution driven by Nx. It exists to dogfood `@nx/dotnet` from this
repository: it is a **standalone Nx + pnpm workspace** whose `@nx/*`
dependencies are `link:`ed to the local `packages/*`, so target inference comes
from the local build rather than a published release.

## How it is wired

- This directory is its own pnpm workspace (`pnpm-workspace.yaml`) with its own
  committed `pnpm-lock.yaml`, excluded from the repo root workspace.
- `package.json` declares `@nx/dotnet` and `nx` as `link:../../../packages/*`
  dependencies.
- This directory's own `nx.json` registers `@nx/dotnet`; because plugin
  resolution starts from this workspace's `node_modules`, the **local** plugin
  build creates the targets.
- `postinstall` builds the linked packages through the repo root, so a fresh
  clone works with just `pnpm install`.

## What it shows

Three projects, no `project.json` anywhere:

```
apps/Api                  a minimal web API
libs/Catalog              a class library the API references
tests/Catalog.Tests       an xunit project covering the library
```

`@nx/dotnet` reads the `.csproj` files and infers the targets. Nothing about
build or test is configured by hand:

| Target                   | Which projects get it                  |
| ------------------------ | -------------------------------------- |
| `build`, `build:release` | all three                              |
| `clean`, `watch`         | all three                              |
| `test`                   | test projects, so `Catalog.Tests` only |
| `run`, `publish`         | executable projects, so `Api` only     |
| `pack`                   | library projects, so `Catalog` only    |

`restore` is the one target this workspace asks for, with `"restore": true` in
`nx.json`. It is off by default because restoring is a prerequisite you own
rather than a step Nx sequences.

`<ProjectReference>` becomes an edge in the Nx graph, so ordering falls out of
the project files rather than out of Nx config:

```bash
nx build Api      # builds Catalog first
nx test Catalog.Tests
nx graph          # Api -> Catalog <- Catalog.Tests
```

```bash
# From this directory
pnpm install    # also builds the linked local packages
pnpm validate   # nx run-many -t restore, then build and test
```

## Notes

- Targets `net9.0` to match the SDK pinned in the repo's `mise.toml`.
- The inferred `build` runs `dotnet build --no-restore`, so a project that has
  never been restored fails with `NETSDK1004`. That is why `nx.json` opts the
  `restore` target in and `pnpm validate` runs it before `build`, which is what
  lets the example work from a clean checkout.
