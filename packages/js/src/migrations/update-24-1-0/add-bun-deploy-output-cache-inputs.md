#### Add the Bun install settings fields to the inputs of build targets that emit the pruned deploy output

In a Bun workspace on the text `bun.lock`, build executors that generate a deployable `package.json` now also emit a pruned `bun.lock` and the `.patch` files of a `bun patch` workspace next to it. `@nx/esbuild:esbuild` builds do this when `generatePackageJson` is enabled, `@nx/js:tsc` and `@nx/js:swc` builds when `generateLockfile` is, and builds inferred by `@nx/webpack/plugin` or `@nx/rspack/plugin` when `NxAppWebpackPlugin` or `NxAppRspackPlugin` has `generatePackageJson` enabled. The emitted `package.json` carries the root `trustedDependencies` list and the `patchedDependencies` of the patches it ships.

Nothing in a build target's default task hash covers the root `trustedDependencies`. Removing a package from that list would replay the previous build from cache and ship an output that still trusts it to run install scripts.

The migration adds a `json` input hashing only the `trustedDependencies` and `patchedDependencies` fields of the root `package.json`, so ordinary dependency bumps in the root manifest do not invalidate every build. The patch contents already reach the task hash through the patched packages. Workspaces on the binary `bun.lockb` are left alone: their deploy output is the `package.json` alone.

The input is placed with the same rules as the pnpm migration in Nx 23.2 (`update-23-2-0-add-pnpm-deploy-output-cache-inputs`): on the target's own `inputs` when it declares them, otherwise on the `targetDefaults` entry supplying the array it inherits, and otherwise on the target itself with nx's own default spelled out first. An existing whole-file root `package.json` fileset or a `json` input covering both fields counts as already hashing them. Targets inferred by the `@nx/webpack` and `@nx/rspack` plugins declare the input themselves, but a project-level or `targetDefaults` entry that supplies its own `inputs` array without `"..."` replaces the inferred array and discards it; the migration appends the input to that replacing array.

#### Sample code changes

##### Before

```json title="apps/app1/project.json"
{
  "targets": {
    "build": {
      "executor": "@nx/esbuild:esbuild",
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
      "executor": "@nx/esbuild:esbuild",
      "inputs": [
        "default",
        "^default",
        {
          "json": "{workspaceRoot}/package.json",
          "fields": ["trustedDependencies", "patchedDependencies"]
        }
      ],
      "options": {
        "generatePackageJson": true
      }
    }
  }
}
```
