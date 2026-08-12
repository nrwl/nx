#### Add the pnpm install settings sources to the inputs of build targets that emit the pruned deploy output

In a pnpm workspace, build executors that generate a deployable `package.json` also emit the pruned deploy output next to it: the pruned `pnpm-lock.yaml`, a settings-only `pnpm-workspace.yaml`, the `.patch` files of a `pnpm patch` workspace, and vendored local-path dependencies. webpack, rspack, vite and esbuild builds do this when `generatePackageJson` is enabled; next, remix, tsc and swc builds when `generateLockfile` is.

The build-script approvals and `supportedArchitectures` those artifacts carry come from the workspace root `pnpm-workspace.yaml` and the `pnpm` field of the root `package.json`, and are recorded in no lockfile, so nothing in the build target's default task hash moves when they change. Revoking an approval after a package turns out to be malicious would replay the previous build from cache and ship an output that still grants it.

The migration adds three inputs to the affected targets: the root `pnpm-workspace.yaml` as a fileset; a `json` input hashing only the fields of the root `package.json` the output is built from (`packageManager`, which selects whether the settings land in the emitted `pnpm-workspace.yaml` or the emitted `package.json`, plus `pnpm.onlyBuiltDependencies`, `pnpm.neverBuiltDependencies`, `pnpm.allowBuilds`, `pnpm.supportedArchitectures` and `pnpm.patchedDependencies`), so ordinary dependency bumps in the root manifest do not invalidate every build; and a `runtime` input probing the pnpm major, which decides that same file selection when the `packageManager` field is absent. The probe prints only the major, so pnpm patch and minor releases do not move the hash, and a sentinel when no pnpm binary is available, so it is safe in every workspace.

The contents of vendored non-workspace local-path dependencies (`file:` directories and tarballs, `link:` targets) also ship in the deploy output but are not covered by these inputs: their set is derived from the lockfile at build time, so no statically written input list can stay correct as dependencies change.

A target's own `inputs` array replaces the defaults' rather than merging with it, so the inputs are added to the layer whose array the runtime actually uses: the target's own `inputs` when it declares them, otherwise the `targetDefaults` entry supplying the array it inherits, and otherwise the target itself with nx's own default spelled out first, so nothing that was hashed stops being hashed. The gating option is read from the merged view, so one supplied by a matching `targetDefaults` entry or set only in a configuration still counts. A source the target already hashes, including via a whole-file root `package.json` fileset or an existing `json` input covering the settings fields, is left alone. The migration never authors a `"..."` of its own.

Targets inferred by the `@nx/webpack` and `@nx/rspack` plugins are not touched: the plugins now declare these inputs themselves and inference recomputes them.

#### Sample code changes

##### Before

```json title="apps/app1/project.json"
{
  "targets": {
    "build": {
      "executor": "@nx/webpack:webpack",
      "options": {
        "generatePackageJson": true
      }
    }
  }
}
```

##### After

```json title="apps/app1/project.json"
{
  "targets": {
    "build": {
      "executor": "@nx/webpack:webpack",
      "inputs": [
        "default",
        "^default",
        "{workspaceRoot}/pnpm-workspace.yaml",
        {
          "json": "{workspaceRoot}/package.json",
          "fields": [
            "packageManager",
            "pnpm.onlyBuiltDependencies",
            "pnpm.neverBuiltDependencies",
            "pnpm.allowBuilds",
            "pnpm.supportedArchitectures",
            "pnpm.patchedDependencies"
          ]
        },
        {
          "runtime": "node -e \"try{console.log('pnpm major '+require('child_process').execSync('pnpm --version',{stdio:['ignore','pipe','ignore']}).toString().trim().split('.')[0])}catch{console.log('pnpm major unavailable')}\""
        }
      ],
      "options": {
        "generatePackageJson": true
      }
    }
  }
}
```
