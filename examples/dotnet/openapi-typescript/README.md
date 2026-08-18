# examples-dotnet-openapi-typescript

A .NET web API whose OpenAPI document is generated at build time, and a
TypeScript client generated from that document, wired together through the Nx
task graph. It exists to dogfood `@nx/dotnet` from this repository: it is a
**standalone Nx + pnpm workspace** whose `@nx/*` dependencies are `link:`ed to
the local `packages/*`, so target inference comes from the local build rather
than a published release.

The point of the example is that a change to the C# record becomes a **compile
error in TypeScript**, without anyone hand-writing an interface twice.

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

## The pipeline

```
Api:restore ─▶ Api:build ─▶ Api:codegen ─▶ api-client:build ─▶ web:build
                   │              │
       apps/Api/openapi/    libs/api-client/
            Api.json          src/generated
```

1. **`Api:restore`** and **`Api:build`** are inferred by `@nx/dotnet` from
   `Api.csproj`. Because the project sets `<OpenApiDocumentsDirectory>` and
   references `Microsoft.Extensions.ApiDescription.Server`, `dotnet build` also
   writes `apps/Api/openapi/Api.json`. There is no separate extraction step.
2. **`Api:codegen`** runs `openapi-generator-cli` over that document and writes
   a `typescript-fetch` client into `libs/api-client/src/generated`.
3. **`api-client:build`** compiles that client, along with the hand-written
   `src/assert-types.ts`. That file is the actual test.
4. **`web:build`** compiles a small front end that imports the client. This edge
   is not configured anywhere: `apps/web` depends on `@example/api-client` in
   its `package.json`, and Nx derives the rest.

```bash
# From this directory
pnpm install      # also builds the linked local packages
nx build web      # runs the whole chain above
pnpm validate     # nx run-many -t build
```

## Two declarations worth reading

**`nx.json` adds the document directory to the build target's outputs.**
`@nx/dotnet` infers `bin` and `obj`, and knows nothing about `openapi/`. Without
this, a cache-restored `build` does not restore the document and `codegen` has
nothing to read — which only shows up on a fresh clone with a warm cache, never
locally.

```json
"build": { "outputs": ["...", "{projectRoot}/openapi"] }
```

The `"..."` splices in the inferred values. Omit it and the array *replaces*
them, dropping `bin` and `obj` from the cache.

**`codegen` and `api-client:build` hash their inputs with
`dependentTasksOutputFiles`.** The obvious thing to write is a path input
pointing at the generated document, and it does not work: the document is
gitignored, Nx builds its file map from what git can see, so the input matches
nothing and the task becomes a permanent cache hit. Hashing the outputs of the
task you depend on is what actually tracks the change.

```json
"inputs": [{ "dependentTasksOutputFiles": "**/*" }]
```

## Watching it fail

```bash
# In apps/Api/Program.cs, change `int TemperatureC` to `string TemperatureC`
nx build web
```

`api-client:build` fails before the front end is reached:

```
libs/api-client/src/assert-types.ts(26,14): error TS2322: Type 'string' is not assignable to type 'number'.
```

Delete `assert-types.ts` and the same change surfaces one step later, in the
app's own code, because `formatForecast` calls `toFixed` on the value:

```
apps/web/src/main.ts(11,41): error TS2551: Property 'toFixed' does not exist on type 'string'.
```

## Notes

- The example targets `net9.0` to match the SDK pinned in the repo's
  `mise.toml`.
- `Program.cs` sets `JsonNumberHandling.Strict`. On .NET 10, where the emitted
  document is OpenAPI 3.1, ASP.NET Core's default number handling reports
  numeric properties as a `["integer", "string"]` union, and `openapi-generator`
  renders a union it cannot map as an **empty interface** — silently discarding
  the type. `assert-types.ts` is what catches that.
- `openapitools.json` pins the generator version so output does not drift
  between runs. The generator is a Java tool and downloads its JAR on first use.
