# Move custom executor hashers to target inputs

Custom hashers (the `hasher` property of an executor in `executors.json`) are
deprecated in Nx 24 and removed in Nx 25. Each one should become target `inputs`
that hash the same things, so the targets keep caching correctly once the hasher
is gone.

The generator half of this migration only scans. It edits no files, and it lists
every executor that declares a hasher in the advisory context, one line each,
with the executor name, the hasher path, and the `executors.json` path. Lines
starting with `Could not parse` name files the scan skipped.

Do not touch executors that declare no hasher, executors installed from
`node_modules`, or any other caching configuration.

## First, check whether there is anything to do

Confirm this before changing anything. If it fails, make no changes and stop:

1. The advisory context lists at least one executor that declares a custom
   hasher, or at least one file it could not parse. For each unparseable file,
   read it yourself; if it declares no `hasher`, drop it from the list.

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

Place the inputs where they apply to every target that used the hasher:

- If the executor's inputs are the same for every project, set them in
  `nx.json` `targetDefaults` under the executor name (`"@acme/my-plugin:echo"`).
  If `targetDefaults` already has a key for that executor, add `inputs` to it,
  and if it already declares `inputs`, merge rather than replace.
- Otherwise set `inputs` on each target that uses the executor, in
  `project.json` or the `nx.targets` block of `package.json`.

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
spec) only once the inputs cover everything the hasher hashed.

If a value has no file, environment variable, or project to point at, such as
data fetched from a remote service, use a `runtime` input whose command prints
that value. If no command can reproduce it, leave the hasher in place and tell
the user which value blocks the move and why.

## Post-Migration Validation

1. `npx nx show target <project>:<target> inputs` for one target per migrated
   executor. While the executor still declares a hasher, this exits with an
   error saying so. Once the hasher is removed, confirm it lists the files and
   values you expect.
2. `npx nx run-many -t <target>` twice for the targets that used the executor.
   The second run should be a cache hit. Change a file the hasher used to hash
   and confirm the next run is a cache miss.
3. `npx nx run-many -t build,test,lint -p <plugin project>` if you deleted hasher
   files. Fix failures caused by this migration and re-run until green.
