#### Add the pnpm install artifacts to `@nx/js:prune-lockfile` outputs

In a pnpm workspace, the `@nx/js:prune-lockfile` executor emits more than the pruned `package.json` and `pnpm-lock.yaml`: on pnpm 11+ it writes a settings-only `pnpm-workspace.yaml` carrying the workspace's build-script approvals, a `pnpm patch` workspace gets its `.patch` files copied under `patches/`, and non-workspace local-path dependencies (`file:` tarballs and directories, `link:` targets) ship under `local_path_modules/`.

Targets generated before this change declare only the manifest and the lockfile in `outputs`, so a cache replay in a clean checkout restores just those two files. The missing `patches/` and `local_path_modules/` break the deploy install loudly, but a missing `pnpm-workspace.yaml` silently drops the build-script approvals and the deployed app's native dependencies never run their build scripts.

The migration appends the three artifact paths to the `outputs` of every target using the `@nx/js:prune-lockfile` executor whose `outputs` already contain a `pnpm-lock.yaml` entry, reusing that entry's own path prefix. `targetDefaults` entries that apply to those targets are updated the same way: entries keyed by the executor, declaring or filtering on it, and entries under a target-name or glob key that resolves to one of the prune-lockfile targets. Targets without `outputs`, targets whose lockfile entry is not pnpm's, and entries already present are left untouched.

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
