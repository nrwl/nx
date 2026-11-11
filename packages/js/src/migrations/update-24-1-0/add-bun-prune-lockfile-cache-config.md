#### Update the cache configuration of `@nx/js:prune-lockfile` targets for the Bun install artifacts

In a Bun workspace on the text `bun.lock`, the `@nx/js:prune-lockfile` executor now emits a pruned `bun.lock` next to the pruned `package.json`, the `.patch` files of a `bun patch` workspace under `patches/`, and the non-workspace `file:` and `link:` dependencies the output installs under `local_path_modules/`. The emitted `package.json` carries the root `trustedDependencies` list and the `patchedDependencies` of the patches it ships.

Targets generated before this change declare only the manifest and the lockfile in `outputs`, so a cache replay in a clean checkout restores just those two files, and `bun install --frozen-lockfile` in the output fails on the missing patch files or vendored packages. The same targets declare no `inputs`, so nothing in the task hash covers the root `trustedDependencies`. Removing a package from that list would replay the previous run's output from cache and ship a manifest that still trusts it. The patch contents and the vendored package contents already reach the task hash through the packages they belong to.

The `patches` and `local_path_modules` paths are appended to whichever `outputs` array declares the `bun.lock` entry, reusing that entry's own path prefix. The root `package.json` is added to the `inputs` the target actually uses: its own `inputs` when it declares them, otherwise the `targetDefaults` entry supplying the array it inherits, and otherwise the target itself with nx's own default spelled out first, so nothing that was hashed stops being hashed. Targets on the binary `bun.lockb` or another package manager's lockfile are left alone, as are paths and inputs already present. Placement follows the same rules as the pnpm migration in Nx 23.2 (`update-23-2-0-add-pnpm-prune-lockfile-cache-config`).

#### Sample code changes

##### Before

```json title="apps/app1/project.json"
{
  "targets": {
    "prune-lockfile": {
      "executor": "@nx/js:prune-lockfile",
      "outputs": [
        "{workspaceRoot}/dist/apps/app1/package.json",
        "{workspaceRoot}/dist/apps/app1/bun.lock"
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
      "inputs": ["default", "^default", "{workspaceRoot}/package.json"],
      "outputs": [
        "{workspaceRoot}/dist/apps/app1/package.json",
        "{workspaceRoot}/dist/apps/app1/bun.lock",
        "{workspaceRoot}/dist/apps/app1/patches",
        "{workspaceRoot}/dist/apps/app1/local_path_modules"
      ]
    }
  }
}
```
