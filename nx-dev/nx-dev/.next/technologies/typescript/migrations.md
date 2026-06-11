The @nx/js plugin provides various migrations to help you migrate to newer versions of js projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 22.6.x

### 22.6.4-package-updates
**Version**: 22.6.4


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `verdaccio` | `^6.3.2` | Updated only



## 22.5.x

### 22.5.0-package-updates
**Version**: 22.5.0-beta.1


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@swc/core` | `^1.15.5` | Updated only
| `@swc/cli` | `^0.7.10` | Updated only
| `@swc/helpers` | `^0.5.18` | Updated only
| `@swc-node/register` | `^1.11.1` | Updated only



## 22.1.x

### `remove-redundant-ts-project-references`
**Version**: 22.1.0-rc.1

Removes redundant TypeScript project references from project's tsconfig.json files when runtime tsconfig files (e.g., tsconfig.lib.json, tsconfig.app.json) exist.

#### Removes Redundant TypeScript Project References from tsconfig.json Files

Removes redundant TypeScript project references from `tsconfig.json` files when runtime tsconfig files (e.g., `tsconfig.lib.json`, `tsconfig.app.json`) exist. Previously, external project references were duplicated in both the project's `tsconfig.json` and runtime tsconfig files. This migration syncs the TypeScript project references to match the project graph, ensuring that external references only appear in runtime tsconfig files when they exist.

#### Examples

When a project has runtime tsconfig files like `tsconfig.lib.json`, the migration will remove external project references from the project's `tsconfig.json` file:

##### Before

```jsonc {7-9}
// libs/my-lib/tsconfig.json
{
  "compilerOptions": {
    "composite": true,
  },
  "references": [
    {
      "path": "../other-lib",
    },
  ],
}
```

##### After

```jsonc {6}
// libs/my-lib/tsconfig.json
{
  "compilerOptions": {
    "composite": true,
  },
  "references": [],
}
```

The external references remain in the runtime tsconfig file where they belong:

##### Before

```jsonc {7-9}
// libs/my-lib/tsconfig.lib.json
{
  "compilerOptions": {
    "composite": true,
  },
  "references": [
    {
      "path": "../other-lib/tsconfig.lib.json",
    },
  ],
}
```

##### After

```jsonc {7-9}
// libs/my-lib/tsconfig.lib.json
{
  "compilerOptions": {
    "composite": true,
  },
  "references": [
    {
      "path": "../other-lib/tsconfig.lib.json",
    },
  ],
}
```

For projects without runtime tsconfig files, the project's `tsconfig.json` file will continue to contain external project references:

##### Before

```jsonc {7-9}
// libs/legacy-lib/tsconfig.json
{
  "compilerOptions": {
    "composite": true,
  },
  "references": [
    {
      "path": "../other-lib",
    },
  ],
}
```

##### After

```jsonc {7-9}
// libs/legacy-lib/tsconfig.json
{
  "compilerOptions": {
    "composite": true,
  },
  "references": [
    {
      "path": "../other-lib",
    },
  ],
}
```

Internal project references (references within the same project directory) are preserved in the project's `tsconfig.json`:

##### Before

```jsonc {7-12}
// libs/my-lib/tsconfig.json
{
  "compilerOptions": {
    "composite": true,
  },
  "references": [
    {
      "path": "./tsconfig.lib.json",
    },
    {
      "path": "./tsconfig.spec.json",
    },
  ],
}
```

##### After

```jsonc {7-12}
// libs/my-lib/tsconfig.json
{
  "compilerOptions": {
    "composite": true,
  },
  "references": [
    {
      "path": "./tsconfig.lib.json",
    },
    {
      "path": "./tsconfig.spec.json",
    },
  ],
}
```




## 22.0.x

### `remove-external-options-from-js-executors`
**Version**: 22.0.0-beta.0

Remove the deprecated `external` and `externalBuildTargets` options from the `@nx/js:swc` and `@nx/js:tsc` executors.

#### Remove the `external` and `externalBuildTargets` Options from the `@nx/js:swc` and `@nx/js:tsc` Executors

Remove the deprecated `external` and `externalBuildTargets` options from the `@nx/js:swc` and `@nx/js:tsc` executors. These options were used for inlining dependencies, which was an experimental feature and has been deprecated for a long time. The migration only removes the options from the project configuration and target defaults. If you rely on inlining dependencies, you need to make sure they are all buildable or use a different build tool that supports bundling.

#### Sample Code Changes

Remove `external` and `externalBuildTargets` from the `@nx/js:swc` or `@nx/js:tsc` executor options in project configuration.

##### Before

```json title="libs/my-lib/project.json" {9-10}
{
  "targets": {
    "build": {
      "executor": "@nx/js:swc",
      "options": {
        "main": "libs/my-lib/src/index.ts",
        "outputPath": "dist/libs/my-lib",
        "tsConfig": "libs/my-lib/tsconfig.lib.json",
        "external": ["react", "react-dom"],
        "externalBuildTargets": ["build"]
      }
    }
  }
}
```

##### After

```json title="libs/my-lib/project.json"
{
  "targets": {
    "build": {
      "executor": "@nx/js:swc",
      "options": {
        "main": "libs/my-lib/src/index.ts",
        "outputPath": "dist/libs/my-lib",
        "tsConfig": "libs/my-lib/tsconfig.lib.json"
      }
    }
  }
}
```

Remove `external` and `externalBuildTargets` from the `@nx/js:swc` or `@nx/js:tsc` executor target defaults in `nx.json`.

##### Before

```json title="nx.json" {8-9}
{
  "targetDefaults": {
    "@nx/js:swc": {
      "options": {
        "main": "{projectRoot}/src/index.ts",
        "outputPath": "dist/{projectRoot}",
        "tsConfig": "{projectRoot}/tsconfig.lib.json",
        "external": "all",
        "externalBuildTargets": ["build"]
      }
    }
  }
}
```

##### After

```json title="nx.json"
{
  "targetDefaults": {
    "@nx/js:swc": {
      "options": {
        "main": "{projectRoot}/src/index.ts",
        "outputPath": "dist/{projectRoot}",
        "tsConfig": "{projectRoot}/tsconfig.lib.json"
      }
    }
  }
}
```




## 21.5.x

### `migrate-development-custom-condition`
**Version**: 21.5.0-beta.2

Migrate the legacy 'development' custom condition to a workspace-unique custom condition name.

#### Migrate `development` custom condition to unique workspace-specific name

Replace the TypeScript `development` custom condition with a unique workspace-specific name to avoid conflicts when consuming packages in other workspaces.

#### Examples

The migration will update the custom condition name in both `tsconfig.base.json` and all workspace package.json files that use the `development` custom condition:

##### Before

```json title="tsconfig.base.json" {3}
{
  "compilerOptions": {
    "customConditions": ["development"]
  }
}
```

##### After

```json title="tsconfig.base.json" {3}
{
  "compilerOptions": {
    "customConditions": ["@my-org/source"] // assuming the root package.json name is `@my-org/source`
  }
}
```

The migration also updates `package.json` files that use the `development` condition in their `exports` field and point to TypeScript files:

##### Before

```json title="libs/my-lib/package.json" {5}
{
  "name": "@myorg/my-lib",
  "exports": {
    ".": {
      "development": "./src/index.ts",
      "default": "./dist/index.js"
    }
  }
}
```

##### After

```json title="libs/my-lib/package.json" {5}
{
  "name": "@myorg/my-lib",
  "exports": {
    ".": {
      "@my-org/source": "./src/index.ts",
      "default": "./dist/index.js"
    }
  }
}
```

If the custom condition is not set to `["development"]` or the `package.json`'s `exports` field doesn't point to TypeScript files, the migration will not modify the configuration:

##### Before

```json title="libs/my-lib/package.json" {5}
{
  "name": "@myorg/my-lib",
  "exports": {
    ".": {
      "development": "./dist/index.js",
      "default": "./dist/index.js"
    }
  }
}
```

##### After

```json title="libs/my-lib/package.json" {5}
{
  "name": "@myorg/my-lib",
  "exports": {
    ".": {
      "development": "./dist/index.js",
      "default": "./dist/index.js"
    }
  }
}
```



### 21.5.0-package-updates
**Version**: 21.5.0-beta.2


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `typescript` | `~5.9.2` | Updated only



## 21.2.x

### 21.2.0-package-updates
**Version**: 21.2.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `typescript` | `~5.8.2` | Updated only



## 20.7.x

### 20.7.1-beta.0-package-updates
**Version**: 20.7.1-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@swc/cli` | `~0.6.0` | Updated only



## 20.5.x

### 20.5.0-package-updates
**Version**: 20.5.0-beta.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `verdaccio` | `^6.0.5` | Updated only



## 20.4.x

### 20.4.0-package-updates
**Version**: 20.4.0-beta.1


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `typescript` | `~5.7.2` | Updated only



## 20.2.x

### 20.2.0-package-updates
**Version**: 20.2.0-beta.5


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `typescript` | `~5.6.2` | Updated only


