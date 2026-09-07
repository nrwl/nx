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
build, test or restore is configured by hand:

| Target                      | Which projects get it                  |
| --------------------------- | -------------------------------------- |
| `build`, `build:release`    | all three                              |
| `restore`, `clean`, `watch` | all three                              |
| `test`                      | test projects, so `Catalog.Tests` only |
| `run`, `publish`            | executable projects, so `Api` only     |
| `pack`                      | library projects, so `Catalog` only    |

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
pnpm validate   # nx run-many -t build,test
```

## Notes

- Targets `net9.0` to match the SDK pinned in the repo's `mise.toml`.
- The inferred `build` runs `dotnet build --no-restore`, so `nx.json` adds
  `"dependsOn": ["...", "restore"]` to it. The `"..."` keeps the `^build` the
  plugin already inferred and puts the restore ahead of it, which is what lets
  `pnpm validate` work from a clean checkout.
