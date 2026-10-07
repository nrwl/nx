# Move custom executor hashers to target inputs

Custom hashers (the `hasher` property of an executor in `executors.json`) are
deprecated in Nx 24 and removed in Nx 25. Each one should become target `inputs`
that hash the same things, so the targets keep caching correctly once the hasher
is gone.

The generator half of this migration only scans. It edits no files, and it lists
every executor that declares a hasher in the advisory context, one line each,
with the executor name, the hasher path, and the `executors.json` path. Lines
starting with `Could not parse` name files the scan skipped, and lines starting
with `Entry` name executor entries it could not read.

Do not touch executors that declare no hasher, executors installed from
`node_modules`, or any other caching configuration.

## First, check whether there is anything to do

Confirm this before changing anything. If it fails, make no changes and stop:

1. The advisory context lists at least one executor that declares a custom
   hasher, or at least one file or entry it could not read. Read each of those
   yourself; if it declares no `hasher`, drop it from the list.

## Step 1: Read what each hasher hashes

Open the hasher module named in the advisory context. Work out every value it
feeds into the hash it returns:

- `context.hasher.hashTask(task, ...)` alone is Nx default hashing.
- Files it reads, globs it walks, or other projects it hashes.
- Environment variables it reads.
- Commands it runs, or data it fetches (a remote API, a registry lookup).

## Step 2: Write equivalent inputs

Map each value to an input:

| What the hasher hashes                                | Input                                                   |
| ----------------------------------------------------- | ------------------------------------------------------- |
| The project and its dependencies (Nx default hashing) | `"default"` and `"^default"`                            |
| Files of specific other projects                      | `{ "input": "default", "projects": ["shared-config"] }` |
| A subset of the files in the project                  | `{ "fileset": "{projectRoot}/src/**/*.graphql" }`       |
| A file outside any project                            | `{ "fileset": "{workspaceRoot}/schema.json" }`          |
| An environment variable                               | `{ "env": "API_URL" }`                                  |
| The output of a command, such as a tool version       | `{ "runtime": "node --version" }`                       |

If the workspace defines named inputs such as `production`, prefer them over
`default` where the hasher excluded test files.

### Find every target that uses the executor

Write the resolved project graph and list every target whose `executor` is the
executor name (`"@acme/my-plugin:echo"`):

```shell
npx nx graph --file=tmp/custom-hashers-graph.json
```

Each target in `graph.nodes.<project>.data.targets` there is fully resolved: it
already reflects `targetDefaults` (including filtered array entries), inferred
targets, and project-level overrides. Record each consuming target's resolved
`inputs`. Every one of them must end up covered.

### Place the inputs

A target that declares its own `inputs` replaces the `inputs` from
`targetDefaults` rather than merging with them. So a `targetDefaults` edit alone
does not reach a target that already declares `inputs`.

1. Set the inputs in `nx.json` `targetDefaults` under the executor name. If that
   key already exists, add `inputs` to it, and merge with any `inputs` it already
   declares rather than replacing them. If its value is an array of filtered
   entries, add the inputs to every entry that applies to a consuming target.
2. For every consuming target that declares its own `inputs`, add the
   replacement inputs to that target as well, keeping the inputs it already has.
   It is declared in `project.json`, in the `nx.targets` block of
   `package.json`, or by the plugin that infers the target. For an inferred
   target, set `inputs` in `project.json` to the full resolved list plus the
   replacement inputs.
3. Write the graph again and confirm that every consuming target's resolved
   `inputs` now contains every replacement input. Fix any that do not.

**Before:**

```json
// tools/my-plugin/executors.json
{
  "executors": {
    "echo": {
      "implementation": "./src/executors/echo/executor",
      "hasher": "./src/executors/echo/hasher",
      "schema": "./src/executors/echo/schema.json"
    }
  }
}
```

**After:**

```json
// nx.json
{
  "targetDefaults": {
    "@acme/my-plugin:echo": {
      "inputs": ["default", "^default", { "env": "API_URL" }]
    }
  }
}
```

```json
// tools/my-plugin/executors.json
{
  "executors": {
    "echo": {
      "implementation": "./src/executors/echo/executor",
      "schema": "./src/executors/echo/schema.json"
    }
  }
}
```

## Step 3: Remove the hasher only when the inputs cover it

Remove `hasher` from `executors.json` and delete the hasher module (and its
spec) only once the resolved inputs of every consuming target cover everything
the hasher hashed.

If a value has no file, environment variable, or project to point at, such as
data fetched from a remote service, use a `runtime` input whose command prints
that value. If no command can reproduce it, leave the hasher in place and tell
the user which value blocks the move and why.

## Post-Migration Validation

1. `npx nx show target <project>:<target>` for every consuming target found in
   Step 2. Confirm each one lists the replacement inputs. After the hasher is
   removed, `npx nx show target <project>:<target> inputs` also shows the files
   and values those inputs resolve to.
2. `npx nx run-many -t <target>` twice for the targets that used the executor.
   The second run should be a cache hit. Change a file the hasher used to hash
   and confirm the next run is a cache miss.
3. `npx nx run-many -t build,test,lint -p <plugin project>` if you deleted hasher
   files. Fix failures caused by this migration and re-run until green.
