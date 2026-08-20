#### Update the cache configuration of `@nx/js:prune-lockfile` targets for the pnpm install artifacts

In a pnpm workspace, the `@nx/js:prune-lockfile` executor emits more than the pruned `package.json` and `pnpm-lock.yaml`: a settings-only `pnpm-workspace.yaml`, the `.patch` files of a `pnpm patch` workspace under `patches/`, and non-workspace local-path dependencies (`file:` tarballs and directories, `link:` targets) under `local_path_modules/`. On pnpm 11 and above that workspace file is where the build-script approvals and `supportedArchitectures` live; on pnpm 10 and below they go into the emitted `package.json` and the file ships carrying only an empty `packages` list.

Targets generated before this change declare only the manifest and the lockfile in `outputs`, so a cache replay in a clean checkout restores just those two files. The missing `patches/` and `local_path_modules/` break the deploy install loudly. On pnpm 11 and above a missing `pnpm-workspace.yaml` is worse than loud: it silently drops the build-script approvals, and the deployed app's native dependencies never run their build scripts.

Those artifacts are built from pnpm settings the workspace root declares. The build approvals and `supportedArchitectures` among them are recorded nowhere in the lockfile, so nothing else in the task hash moves when they change, and the same targets declare no `inputs` at all. Revoking a build approval would replay the previous run's artifact from cache and ship an output that still grants it.

The three artifact paths are appended to whichever `outputs` array declares the `pnpm-lock.yaml` entry, reusing that entry's own path prefix. That covers a target's own `outputs` and the `targetDefaults` entries applying to prune-lockfile targets: entries keyed by the executor, declaring or filtering on it, and entries under a target-name or glob key that resolves to one of them. Configurations without `outputs`, configurations whose lockfile entry is not pnpm's, and paths already present are left untouched.

The two root sources, plus a `runtime` input probing the pnpm major (which decides whether the settings land in the emitted `pnpm-workspace.yaml` or the emitted `package.json` when the root manifest has no `packageManager` field), go somewhere else, because a target's own `inputs` array replaces the defaults' rather than merging with it. Each target is classified by its merged `outputs`, so inheriting or spreading the lockfile entry still counts, and the sources are added once: to the target's own `inputs` when it declares them, and otherwise to the `targetDefaults` entry supplying the array it inherits. A target inheriting nothing gets nx's own default spelled out first, so nothing that was hashed stops being hashed. A source the target already hashes is left alone. A workspace with no prune-lockfile target at all, configuring them purely through `targetDefaults`, has the sources added to every compatible entry under the key that declares its own `inputs` (each can be the array a future target inherits, and a sibling's array covers nothing); when no filter-less entry declares any, the spelled-out default is prepended as a new entry, under a name or glob key pinned to the executor so same-name targets of other executors do not inherit it. The fallback is only authored where it cannot change which key a target resolves: under the executor key when a compatible filter-less entry already exists, and under a name or glob key when a compatible filter-less entry already pins the executor. Any other key gets no fallback, whether its compatible entries are all filtered or its filter-less entries do not pin the executor, because a new entry would make that key win selection for targets that previously resolved their defaults elsewhere.

The migration only ever appends to an array that already exists or writes that spelled-out default; it never authors a `"..."` of its own. Whether a spread finds anything to expand against depends on the identity resets in nx's own document-order merge, and one that finds nothing would leave the target hashing only the two root files.

#### Sample code changes

##### Before

```json title="apps/app1/project.json"
{
  "targets": {
    "prune-lockfile": {
      "executor": "@nx/js:prune-lockfile",
      "outputs": [
        "{workspaceRoot}/dist/apps/app1/package.json",
        "{workspaceRoot}/dist/apps/app1/pnpm-lock.yaml"
      ]
    }
  }
}
```

##### After

```json title="apps/app1/project.json"
{
  "targets": {
    "prune-lockfile": {
      "executor": "@nx/js:prune-lockfile",
      "inputs": [
        "default",
        "^default",
        "{workspaceRoot}/pnpm-workspace.yaml",
        "{workspaceRoot}/package.json",
        {
          "runtime": "node -e \"try{console.log('pnpm major '+require('child_process').execSync('pnpm --version',{stdio:['ignore','pipe','ignore']}).toString().trim().split('.')[0])}catch{console.log('pnpm major unavailable')}\""
        }
      ],
      "outputs": [
        "{workspaceRoot}/dist/apps/app1/package.json",
        "{workspaceRoot}/dist/apps/app1/pnpm-lock.yaml",
        "{workspaceRoot}/dist/apps/app1/pnpm-workspace.yaml",
        "{workspaceRoot}/dist/apps/app1/patches",
        "{workspaceRoot}/dist/apps/app1/local_path_modules"
      ]
    }
  }
}
```
