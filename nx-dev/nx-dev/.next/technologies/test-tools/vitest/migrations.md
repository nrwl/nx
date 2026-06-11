The @nx/vitest plugin provides various migrations to help you migrate to newer versions of vitest projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 22.6.x

### `update-22-6-0-prefix-reports-directory`
**Version**: 22.6.0-beta.11

Prefix reportsDirectory with {projectRoot} to maintain correct resolution after workspace-root-relative behavior change.

#### Prefix `reportsDirectory` with `{projectRoot}`

The `reportsDirectory` option for `@nx/vitest:test` (and `@nx/vite:test`) is now resolved relative to the workspace root instead of the project root. This migration prepends `{projectRoot}/` to existing `reportsDirectory` values so the resolved path remains the same.

#### Sample Code Changes

##### Before

```json title="project.json"
{
  "targets": {
    "test": {
      "executor": "@nx/vitest:test",
      "options": {
        "reportsDirectory": "coverage/libs/my-lib"
      }
    }
  }
}
```

##### After

```json title="project.json" {6}
{
  "targets": {
    "test": {
      "executor": "@nx/vitest:test",
      "options": {
        "reportsDirectory": "{projectRoot}/coverage/libs/my-lib"
      }
    }
  }
}
```




## 22.3.x

### `update-22-3-2`
**Version**: 22.3.2-beta.0

Create AI Instructions to help migrate users workspaces past breaking changes for Vitest 4.

#### Requires

| Name | Version |
|------|---------|
 `@angular/build` | `>=21.0.0` |

### 22.3.2-package-updates
**Version**: 22.3.2-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `vitest` | `^4.0.8` | Updated only
| `@vitest/coverage-v8` | `^4.0.8` | Updated only
| `@vitest/coverage-istanbul` | `^4.0.8` | Updated only
| `@vitest/ui` | `^4.0.8` | Updated only
| `jsdom` | `^27.1.0` | Updated only


### 22.3.2-analog-package-updates
**Version**: 22.3.2-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@analogjs/vite-plugin-angular` | `~2.2.0` | Updated only
| `@analogjs/vitest-angular` | `~2.2.0` | Updated only



## 22.2.x

### 22.2.0-analog-package-updates
**Version**: 22.2.0-beta.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@analogjs/vite-plugin-angular` | `~2.1.2` | Updated only
| `@analogjs/vitest-angular` | `~2.1.2` | Updated only



## 22.1.x

### `update-22-1-0`
**Version**: 22.1.0-beta.8

Create AI Instructions to help migrate users workspaces past breaking changes for Vitest 4.


### 22.1.0-package-updates
**Version**: 22.1.0-beta.8


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `vitest` | `^4.0.0` | Updated only
| `@vitest/coverage-v8` | `^4.0.0` | Updated only
| `@vitest/coverage-istanbul` | `^4.0.0` | Updated only
| `@vitest/ui` | `^4.0.0` | Updated only



## 20.3.x

### `update-20-3-0`
**Version**: 20.3.0-beta.2

Add gitignore entry for temporary vitest config files.

#### Add Vitest Temp Files to Git Ignore

Add gitignore entry for temporary vitest config files.

#### Sample Code Changes

Adds the following entries to the `.gitignore` file.

```text title=".gitignore"
vite.config.*.timestamp*
vitest.config.*.timestamp*
```



