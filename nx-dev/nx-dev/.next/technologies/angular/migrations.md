The @nx/angular plugin provides various migrations to help you migrate to newer versions of angular projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 22.6.x

### 22.6.0-angular-eslint-package-updates
**Version**: 22.6.0-beta.6


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `angular-eslint` | `^21.2.0` | Updated only
| `@angular-eslint/eslint-plugin` | `^21.2.0` | Updated only
| `@angular-eslint/eslint-plugin-template` | `^21.2.0` | Updated only
| `@angular-eslint/template-parser` | `^21.2.0` | Updated only
| `@angular-eslint/utils` | `^21.2.0` | Updated only
| `@angular-eslint/schematics` | `^21.2.0` | Updated only
| `@angular-eslint/test-utils` | `^21.2.0` | Updated only
| `@angular-eslint/builder` | `^21.2.0` | Updated only
| `@angular-eslint/bundled-angular-compiler` | `^21.2.0` | Updated only


### 22.6.0-@angular-eslint-package-updates
**Version**: 22.6.0-beta.6


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@angular-eslint/eslint-plugin` | `^21.2.0` | Updated only
| `@angular-eslint/eslint-plugin-template` | `^21.2.0` | Updated only
| `@angular-eslint/template-parser` | `^21.2.0` | Updated only
| `@angular-eslint/utils` | `^21.2.0` | Updated only
| `@angular-eslint/schematics` | `^21.2.0` | Updated only
| `@angular-eslint/test-utils` | `^21.2.0` | Updated only
| `@angular-eslint/builder` | `^21.2.0` | Updated only
| `@angular-eslint/bundled-angular-compiler` | `^21.2.0` | Updated only


### 22.6.0-package-updates
**Version**: 22.6.0-beta.6


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@angular/cli` | `~21.2.0` | Updated only
| `@angular-devkit/build-angular` | `~21.2.0` | Updated only
| `@angular-devkit/core` | `~21.2.0` | Updated only
| `@angular-devkit/schematics` | `~21.2.0` | Updated only
| `@angular/build` | `~21.2.0` | Updated only
| `@angular/pwa` | `~21.2.0` | Updated only
| `@angular/ssr` | `~21.2.0` | Updated only
| `@schematics/angular` | `~21.2.0` | Updated only
| `@angular-devkit/architect` | `~0.2102.0` | Updated only
| `@angular-devkit/build-webpack` | `~0.2102.0` | Updated only
| `@angular/core` | `~21.2.0` | Added if not installed
| `@angular/material` | `~21.2.0` | Updated only
| `@angular/cdk` | `~21.2.0` | Updated only
| `@angular/google-maps` | `~21.2.0` | Updated only
| `ng-packagr` | `~21.2.0` | Updated only


### 22.6.0-module-federation-package-updates
**Version**: 22.6.0-beta.10


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@module-federation/enhanced` | `^2.1.0` | Updated only
| `@module-federation/node` | `^2.7.21` | Updated only



## 22.4.x

### 22.4.0-package-updates
**Version**: 22.4.0-beta.4


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@angular/cli` | `~21.1.0` | Updated only
| `@angular-devkit/build-angular` | `~21.1.0` | Updated only
| `@angular-devkit/core` | `~21.1.0` | Updated only
| `@angular-devkit/schematics` | `~21.1.0` | Updated only
| `@angular/build` | `~21.1.0` | Updated only
| `@angular/pwa` | `~21.1.0` | Updated only
| `@angular/ssr` | `~21.1.0` | Updated only
| `@schematics/angular` | `~21.1.0` | Updated only
| `@angular-devkit/architect` | `~0.2101.0` | Updated only
| `@angular-devkit/build-webpack` | `~0.2101.0` | Updated only
| `@angular/core` | `~21.1.0` | Added if not installed
| `@angular/material` | `~21.1.0` | Updated only
| `@angular/cdk` | `~21.1.0` | Updated only
| `@angular/google-maps` | `~21.1.0` | Updated only
| `ng-packagr` | `~21.1.0` | Updated only



## 22.3.x

### `update-ssr-webpack-config-22-2-0`
**Version**: 22.3.0-beta.0

Updates webpack-based SSR configuration to use preserve module format and bundler module resolution.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=21.0.0` |
#### Updates Webpack-Based SSR Configuration

Updates the TypeScript configuration and import syntax for webpack-based server-side rendering (SSR) projects. This migration sets `module: "preserve"` and `moduleResolution: "bundler"` in `tsconfig.server.json` to align with Angular's build requirements, and updates server file imports from namespace imports (`import * as express`) to default imports (`import express`) to work correctly with the new module format.

#### Examples

For webpack-based SSR projects (using `@nx/angular:webpack-server` or `@angular-devkit/build-angular:server`), the migration updates the `tsconfig.server.json` file:

##### Before

```jsonc {7-8}
// apps/my-app/tsconfig.server.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "target": "es2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "types": ["node"],
  },
  "files": ["src/main.server.ts", "src/server.ts"],
}
```

##### After

```jsonc {7-8}
// apps/my-app/tsconfig.server.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "target": "es2022",
    "module": "preserve",
    "moduleResolution": "bundler",
    "types": ["node"],
  },
  "files": ["src/main.server.ts", "src/server.ts"],
}
```

The migration also updates import statements in the `server.ts` file to use default imports instead of namespace imports:

##### Before

```ts {2-4}
// apps/my-app/src/server.ts
import * as express from 'express';
import * as compression from 'compression';
import * as cors from 'cors';

const app = express();
app.use(compression());
app.use(cors());
```

##### After

```ts {2-4}
// apps/my-app/src/server.ts
import express from 'express';
import compression from 'compression';
import cors from 'cors';

const app = express();
app.use(compression());
app.use(cors());
```

Projects that already have the correct TypeScript configuration or projects without a `tsconfig.server.json` file are not modified by this migration.



### `update-module-resolution-22-2-0`
**Version**: 22.3.0-beta.0

Update 'module' to 'preserve' and 'moduleResolution' to 'bundler' in TypeScript configurations for Angular projects.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=21.0.0-rc.3` |
#### Update `module` to `preserve` and `moduleResolution` to `bundler` in TypeScript configurations

Updates the TypeScript `module` and `moduleResolution` compiler options to `'preserve'` and `'bundler'` respectively for Angular projects. These settings are required for Angular's build system to work correctly with modern module resolution algorithms used by bundlers like Webpack, Vite, and esbuild.

#### Examples

The migration updates TypeScript configuration files in Angular projects to set both compiler options:

##### Before

```jsonc {4-5}
// apps/my-app/tsconfig.app.json
{
  "compilerOptions": {
    "module": "es2020",
    "moduleResolution": "node",
  },
}
```

##### After

```jsonc {4-5}
// apps/my-app/tsconfig.app.json
{
  "compilerOptions": {
    "module": "preserve",
    "moduleResolution": "bundler",
  },
}
```

If both values are already set correctly and inherited from an extended tsconfig file, the migration will not modify the configuration:

##### Before

```jsonc {5-6}
// apps/my-app/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "preserve",
    "moduleResolution": "bundler",
  },
}
```

```jsonc {4-6}
// apps/my-app/tsconfig.app.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": [],
  },
}
```

##### After

```jsonc {5-6}
// apps/my-app/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "preserve",
    "moduleResolution": "bundler",
  },
}
```

```jsonc {4-6}
// apps/my-app/tsconfig.app.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": [],
  },
}
```

The migration only processes TypeScript configuration files that are referenced by Angular project build targets, ensuring that only Angular-specific configurations are updated.



### `update-typescript-lib-22-2-0`
**Version**: 22.3.0-beta.0

Updates the 'lib' property in tsconfig files to use 'es2022' or a more modern version.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=21.0.0` |
#### Update TypeScript `lib` compiler option to ES2022

Updates the TypeScript `lib` compiler option in Angular projects to ensure compatibility with Angular v21+, which requires ES2022 as the minimum ECMAScript version. The migration upgrades any ES versions older than ES2022 (such as ES2015, ES2020, etc.) to ES2022 while preserving other library entries like `'dom'`, `'webworker'`, etc.

#### Examples

The migration processes TypeScript configuration files referenced by Angular project build targets and updates the `lib` compiler option when outdated ES versions are detected:

##### Before

```jsonc {4}
// apps/my-app/tsconfig.app.json
{
  "compilerOptions": {
    "lib": ["es2020", "dom"],
  },
}
```

##### After

```jsonc {4}
// apps/my-app/tsconfig.app.json
{
  "compilerOptions": {
    "lib": ["dom", "es2022"],
  },
}
```

When the `lib` array contains only an ES version older than ES2022 without additional entries, it is upgraded:

##### Before

```jsonc {4}
// apps/my-app/tsconfig.app.json
{
  "compilerOptions": {
    "lib": ["es2020"],
  },
}
```

##### After

```jsonc {4}
// apps/my-app/tsconfig.app.json
{
  "compilerOptions": {
    "lib": ["es2022"],
  },
}
```

If the configuration already uses ES2022 or higher (e.g., `'es2023'`, `'esnext'`), no changes are made:

##### Before

```jsonc {4}
// apps/my-app/tsconfig.app.json
{
  "compilerOptions": {
    "lib": ["es2022", "dom"],
  },
}
```

##### After

```jsonc {4}
// apps/my-app/tsconfig.app.json
{
  "compilerOptions": {
    "lib": ["es2022", "dom"],
  },
}
```

When the `lib` array contains multiple library entries, only the ES version is upgraded while all other entries are preserved:

##### Before

```jsonc {4}
// apps/my-app/tsconfig.app.json
{
  "compilerOptions": {
    "lib": ["es2020", "dom", "webworker"],
  },
}
```

##### After

```jsonc {4}
// apps/my-app/tsconfig.app.json
{
  "compilerOptions": {
    "lib": ["dom", "webworker", "es2022"],
  },
}
```

The migration only processes TypeScript configuration files that are referenced by Angular project build targets, ensuring that only Angular-specific configurations are updated.



### `update-unit-test-runner-option`
**Version**: 22.3.0-beta.0

Update 'vitest' unit test runner option to 'vitest-analog' in generator defaults.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=21.0.0` |
#### Update `vitest` unit test runner option to `vitest-analog` in generator defaults

Updates the `unitTestRunner` generator default from `vitest` to `vitest-analog` in `nx.json`. The `vitest` option has been split into two explicit options: `vitest-angular` (uses `@angular/build:unit-test`) and `vitest-analog` (uses AnalogJS-based setup).

#### Examples

The migration updates generator defaults in `nx.json`:

##### Before

```jsonc {5}
// nx.json
{
  "generators": {
    "@nx/angular:application": {
      "unitTestRunner": "vitest",
    },
  },
}
```

##### After

```jsonc {5}
// nx.json
{
  "generators": {
    "@nx/angular:application": {
      "unitTestRunner": "vitest-analog",
    },
  },
}
```



### `set-isolated-modules-22-3-0`
**Version**: 22.3.0-beta.3

Set 'isolatedModules' to 'true' in TypeScript test configurations for Angular projects.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=21.0.0` |
#### Set `isolatedModules` to `true` in TypeScript test configurations

Sets the TypeScript `isolatedModules` compiler option to `true` in `tsconfig.spec.json` files for Angular projects using the Jest test runner.

#### Examples

The migration updates TypeScript test configuration files in Angular projects using the Jest test runner to set the `isolatedModules` compiler option:

##### Before

```jsonc {3-5}
// apps/my-app/tsconfig.spec.json
{
  "compilerOptions": {
    "outDir": "./out-tsc/spec",
  },
}
```

##### After

```jsonc {4-5}
// apps/my-app/tsconfig.spec.json
{
  "compilerOptions": {
    "outDir": "./out-tsc/spec",
    "isolatedModules": true,
  },
}
```

If the value is already set to `true` or inherited from an extended tsconfig file, the migration will not modify the configuration:

##### Before

```jsonc {4}
// tsconfig.json
{
  "compilerOptions": {
    "isolatedModules": true,
  },
}
```

```jsonc {4-6}
// apps/my-app/tsconfig.spec.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/spec",
  },
}
```

##### After

```jsonc {4}
// tsconfig.json
{
  "compilerOptions": {
    "isolatedModules": true,
  },
}
```

```jsonc {4-6}
// apps/my-app/tsconfig.spec.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/spec",
  },
}
```

The migration only processes TypeScript test configuration files (`tsconfig.spec.json` or custom test tsconfig files referenced by `@nx/jest:jest` tasks) in Angular projects.



### `update-jest-preset-angular-setup`
**Version**: 22.3.0-beta.3

Replace 'jest-preset-angular/setup-jest' imports with the new 'setupZoneTestEnv' function.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=21.0.0` |
#### Update Jest Preset Angular Setup

Replaces the removed `jest-preset-angular/setup-jest` import with the new `setupZoneTestEnv` function from `jest-preset-angular/setup-env/zone`.

Starting with `jest-preset-angular` v15, the `setup-jest` files have been removed and replaced with explicit setup functions. The old `setup-jest` import only supported zone-based testing (zoneless support was added in v14.3.0 with the new `setupZonelessTestEnv` function), so all projects using the removed import are migrated to use `setupZoneTestEnv`.

#### Examples

##### Before

```ts title="apps/my-app/src/test-setup.ts"
import 'jest-preset-angular/setup-jest';
```

##### After

```ts title="apps/my-app/src/test-setup.ts"
import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

setupZoneTestEnv();
```



### 22.3.0-package-updates
**Version**: 22.3.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@angular/cli` | `~21.0.0` | Updated only
| `@angular-devkit/build-angular` | `~21.0.0` | Updated only
| `@angular-devkit/core` | `~21.0.0` | Updated only
| `@angular-devkit/schematics` | `~21.0.0` | Updated only
| `@angular/build` | `~21.0.0` | Updated only
| `@angular/pwa` | `~21.0.0` | Updated only
| `@angular/ssr` | `~21.0.0` | Updated only
| `@schematics/angular` | `~21.0.0` | Updated only
| `@angular-devkit/architect` | `~0.2100.0` | Updated only
| `@angular-devkit/build-webpack` | `~0.2100.0` | Updated only
| `@angular/core` | `~21.0.0` | Added if not installed
| `@angular/material` | `~21.0.0` | Updated only
| `@angular/cdk` | `~21.0.0` | Updated only
| `@angular/google-maps` | `~21.0.0` | Updated only
| `ng-packagr` | `~21.0.0` | Updated only
| `zone.js` | `~0.16.0` | Updated only


### 22.3.0-angular-eslint-package-updates
**Version**: 22.3.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `angular-eslint` | `^21.0.1` | Updated only
| `@angular-eslint/eslint-plugin` | `^21.0.1` | Updated only
| `@angular-eslint/eslint-plugin-template` | `^21.0.1` | Updated only
| `@angular-eslint/template-parser` | `^21.0.1` | Updated only
| `@angular-eslint/utils` | `^21.0.1` | Updated only
| `@angular-eslint/schematics` | `^21.0.1` | Updated only
| `@angular-eslint/test-utils` | `^21.0.1` | Updated only
| `@angular-eslint/builder` | `^21.0.1` | Updated only
| `@angular-eslint/bundled-angular-compiler` | `^21.0.1` | Updated only


### 22.3.0-@angular-eslint-package-updates
**Version**: 22.3.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@angular-eslint/eslint-plugin` | `^21.0.1` | Updated only
| `@angular-eslint/eslint-plugin-template` | `^21.0.1` | Updated only
| `@angular-eslint/template-parser` | `^21.0.1` | Updated only
| `@angular-eslint/utils` | `^21.0.1` | Updated only
| `@angular-eslint/schematics` | `^21.0.1` | Updated only
| `@angular-eslint/test-utils` | `^21.0.1` | Updated only
| `@angular-eslint/builder` | `^21.0.1` | Updated only
| `@angular-eslint/bundled-angular-compiler` | `^21.0.1` | Updated only


### 22.3.2-ngrx-package-updates
**Version**: 22.3.2-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@ngrx/store` | `^21.0.0` | Updated only



## 22.2.x

### 22.2.0-package-updates
**Version**: 22.2.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@module-federation/enhanced` | `^0.21.2` | Updated only
| `@module-federation/runtime` | `^0.21.2` | Updated only
| `@module-federation/sdk` | `^0.21.2` | Updated only
| `@module-federation/node` | `^2.7.21` | Updated only



## 21.6.x

### `update-angular-cli-version-20-3-0`
**Version**: 21.6.1-beta.2

Update the @angular/cli package version to ~20.3.0.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=20.3.0` |
#### Sample Code Changes

Update the `@angular/cli` package version in the `package.json` file at the workspace root to **~20.3.0**.

##### Before

```json title="package.json"
{
  "devDependencies": {
    "@angular/cli": "~20.2.0"
  }
}
```

##### After

```json title="package.json" {3}
{
  "devDependencies": {
    "@angular/cli": "~20.3.0"
  }
}
```



### 21.6.1-package-updates
**Version**: 21.6.1-beta.2


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@angular-devkit/build-angular` | `~20.3.0` | Updated only
| `@angular-devkit/core` | `~20.3.0` | Updated only
| `@angular-devkit/schematics` | `~20.3.0` | Updated only
| `@angular/build` | `~20.3.0` | Updated only
| `@angular/pwa` | `~20.3.0` | Updated only
| `@angular/ssr` | `~20.3.0` | Updated only
| `@schematics/angular` | `~20.3.0` | Updated only
| `@angular-devkit/architect` | `~0.2003.0` | Updated only
| `@angular-devkit/build-webpack` | `~0.2003.0` | Updated only
| `@angular/core` | `~20.3.0` | Added if not installed
| `@angular/material` | `~20.2.3` | Updated only
| `@angular/cdk` | `~20.2.3` | Updated only
| `@angular/google-maps` | `~20.2.3` | Updated only
| `ng-packagr` | `~20.3.0` | Updated only


### 21.6.1-angular-eslint-package-updates
**Version**: 21.6.1-beta.2


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `angular-eslint` | `^20.3.0` | Updated only
| `@angular-eslint/eslint-plugin` | `^20.3.0` | Updated only
| `@angular-eslint/eslint-plugin-template` | `^20.3.0` | Updated only
| `@angular-eslint/template-parser` | `^20.3.0` | Updated only
| `@angular-eslint/utils` | `^20.3.0` | Updated only
| `@angular-eslint/schematics` | `^20.3.0` | Updated only
| `@angular-eslint/test-utils` | `^20.3.0` | Updated only
| `@angular-eslint/builder` | `^20.3.0` | Updated only
| `@angular-eslint/bundled-angular-compiler` | `^20.3.0` | Updated only


### 21.6.1-@angular-eslint-package-updates
**Version**: 21.6.1-beta.2


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@angular-eslint/eslint-plugin` | `^20.3.0` | Updated only
| `@angular-eslint/eslint-plugin-template` | `^20.3.0` | Updated only
| `@angular-eslint/template-parser` | `^20.3.0` | Updated only
| `@angular-eslint/utils` | `^20.3.0` | Updated only
| `@angular-eslint/schematics` | `^20.3.0` | Updated only
| `@angular-eslint/test-utils` | `^20.3.0` | Updated only
| `@angular-eslint/builder` | `^20.3.0` | Updated only
| `@angular-eslint/bundled-angular-compiler` | `^20.3.0` | Updated only



## 21.5.x

### `set-tsconfig-option`
**Version**: 21.5.0-beta.0

Set the 'tsConfig' option to build and test targets to help with Angular migration issues.

#### Set `tsConfig` option for build and test targets

- Set the `tsConfig` option in the target options for library build executors. It moves the value from the target `development` configuration and it doesn't set it if the option is already set.
- Set `tsconfig.spec.json` as the `tsConfig` option in the target options for the `@nx/jest:jest` executor. It only does it if the file exists and the options is not already set.

#### Examples

The migration will move the `tsConfig` option for library build executors (`@nx/angular:ng-packagr-lite` and `@nx/angular:package`) from the `development` configuration to the target options if it's not already set:

##### Before

```json title="libs/lib1/project.json" {7}
{
  "targets": {
    "build": {
      "executor": "@nx/angular:ng-packagr-lite",
      "configurations": {
        "development": {
          "tsConfig": "libs/lib1/tsconfig.lib.dev.json"
        }
      }
    }
  }
}
```

##### After

```json title="libs/lib1/project.json" {6,9}
{
  "targets": {
    "build": {
      "executor": "@nx/angular:ng-packagr-lite",
      "options": {
        "tsConfig": "libs/lib1/tsconfig.lib.dev.json"
      },
      "configurations": {
        "development": {}
      }
    }
  }
}
```

The migration will set the `tsConfig` option for the `@nx/jest:jest` executor when the `tsconfig.spec.json` file exists and the option is not already set:

##### Before

```json title="apps/app1/project.json"
{
  "targets": {
    "test": {
      "executor": "@nx/jest:jest"
    }
  }
}
```

##### After

```json title="apps/app1/project.json" {6}
{
  "targets": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "tsConfig": "apps/app1/tsconfig.spec.json"
      }
    }
  }
}
```

If the `tsConfig` option is already set in the target options, the migration will not modify the configuration:

##### Before

```json title="libs/lib1/project.json" {6,10}
{
  "targets": {
    "build": {
      "executor": "@nx/angular:ng-packagr-lite",
      "options": {
        "tsConfig": "libs/lib1/tsconfig.lib.json"
      },
      "configurations": {
        "development": {
          "tsConfig": "libs/lib1/tsconfig.lib.dev.json"
        }
      }
    }
  }
}
```

##### After

```json title="libs/lib1/project.json" {6,10}
{
  "targets": {
    "build": {
      "executor": "@nx/angular:ng-packagr-lite",
      "options": {
        "tsConfig": "libs/lib1/tsconfig.lib.json"
      },
      "configurations": {
        "development": {
          "tsConfig": "libs/lib1/tsconfig.lib.dev.json"
        }
      }
    }
  }
}
```



### `update-angular-cli-version-20-2-0`
**Version**: 21.5.0-beta.2

Update the @angular/cli package version to ~20.2.0.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=20.2.0` |
#### Sample Code Changes

Update the `@angular/cli` package version in the `package.json` file at the workspace root to **~20.2.0**.

##### Before

```json title="package.json"
{
  "devDependencies": {
    "@angular/cli": "~20.1.0"
  }
}
```

##### After

```json title="package.json" {3}
{
  "devDependencies": {
    "@angular/cli": "~20.2.0"
  }
}
```



### `remove-default-karma-configuration-files`
**Version**: 21.5.0-beta.2

Remove any Karma configuration files that only contain the default content. The default configuration is automatically available without a specific project configurationfile.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=20.2.0` |
#### Remove the Default Karma Configuration Files

Removes Karma configuration files that match the default configuration generated by Angular CLI to reduce boilerplate code in the workspace. The migration also removes the `karmaConfig` option from project targets when the configuration file is removed.

#### Examples

The migration will remove `karma.conf.js` files that contain only default settings and update the project configuration:

##### Before

```javascript title="apps/my-app/karma.conf.js"
// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    client: {
      jasmine: {
        // you can add configuration options for Jasmine here
        // the possible options are listed at https://jasmine.github.io/api/edge/Configuration.html
        // for example, you can disable the random execution with `random: false`
        // or set a specific seed with `seed: 4321`
      },
    },
    jasmineHtmlReporter: {
      suppressAll: true, // removes the duplicated traces
    },
    coverageReporter: {
      dir: require('path').join(__dirname, '../../coverage/my-app'),
      subdir: '.',
      reporters: [{ type: 'html' }, { type: 'text-summary' }],
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['Chrome'],
    restartOnFileChange: true,
  });
};
```

```json title="apps/my-app/project.json" {7}
{
  "name": "my-app",
  "targets": {
    "test": {
      "executor": "@angular-devkit/build-angular:karma",
      "options": {
        "karmaConfig": "apps/my-app/karma.conf.js",
        "polyfills": ["zone.js", "zone.js/testing"]
      }
    }
  }
}
```

##### After

File `apps/my-app/karma.conf.js` is removed.

```json title="apps/my-app/project.json"
{
  "name": "my-app",
  "targets": {
    "test": {
      "executor": "@angular-devkit/build-angular:karma",
      "options": {
        "polyfills": ["zone.js", "zone.js/testing"]
      }
    }
  }
}
```

If the Karma configuration contains customizations, the migration will preserve the file and configuration:

##### Before

```javascript title="apps/custom-app/karma.conf.js"
module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    browsers: ['ChromeHeadless'], // Custom browser configuration
    restartOnFileChange: true,
  });
};
```

##### After

```javascript title="apps/custom-app/karma.conf.js"
module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    browsers: ['ChromeHeadless'], // Custom browser configuration
    restartOnFileChange: true,
  });
};
```



### 21.5.0-package-updates
**Version**: 21.5.0-beta.2


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@angular-devkit/build-angular` | `~20.2.0` | Updated only
| `@angular-devkit/core` | `~20.2.0` | Updated only
| `@angular-devkit/schematics` | `~20.2.0` | Updated only
| `@angular/build` | `~20.2.0` | Updated only
| `@angular/pwa` | `~20.2.0` | Updated only
| `@angular/ssr` | `~20.2.0` | Updated only
| `@schematics/angular` | `~20.2.0` | Updated only
| `@angular-devkit/architect` | `~0.2002.0` | Updated only
| `@angular-devkit/build-webpack` | `~0.2002.0` | Updated only
| `@angular/core` | `~20.2.0` | Added if not installed
| `@angular/material` | `~20.2.0` | Updated only
| `@angular/cdk` | `~20.2.0` | Updated only
| `@angular/google-maps` | `~20.2.0` | Updated only
| `ng-packagr` | `~20.2.0` | Updated only


### 21.5.0-angular-eslint-package-updates
**Version**: 21.5.0-beta.2


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `angular-eslint` | `^20.2.0` | Updated only
| `@angular-eslint/eslint-plugin` | `^20.2.0` | Updated only
| `@angular-eslint/eslint-plugin-template` | `^20.2.0` | Updated only
| `@angular-eslint/template-parser` | `^20.2.0` | Updated only
| `@angular-eslint/utils` | `^20.2.0` | Updated only
| `@angular-eslint/schematics` | `^20.2.0` | Updated only
| `@angular-eslint/test-utils` | `^20.2.0` | Updated only
| `@angular-eslint/builder` | `^20.2.0` | Updated only
| `@angular-eslint/bundled-angular-compiler` | `^20.2.0` | Updated only


### 21.5.0-@angular-eslint-package-updates
**Version**: 21.5.0-beta.2


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@angular-eslint/eslint-plugin` | `^20.2.0` | Updated only
| `@angular-eslint/eslint-plugin-template` | `^20.2.0` | Updated only
| `@angular-eslint/template-parser` | `^20.2.0` | Updated only
| `@angular-eslint/utils` | `^20.2.0` | Updated only
| `@angular-eslint/schematics` | `^20.2.0` | Updated only
| `@angular-eslint/test-utils` | `^20.2.0` | Updated only
| `@angular-eslint/builder` | `^20.2.0` | Updated only
| `@angular-eslint/bundled-angular-compiler` | `^20.2.0` | Updated only



## 21.4.x

### 21.4.0-ngrx-package-updates
**Version**: 21.4.0-beta.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@ngrx/store` | `^20.0.0` | Updated only



## 21.3.x

### `update-angular-cli-version-20-1-0`
**Version**: 21.3.0-beta.4

Update the @angular/cli package version to ~20.1.0.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=20.1.0` |
#### Sample Code Changes

Update the `@angular/cli` package version in the `package.json` file at the workspace root to **~20.1.0**.

##### Before

```json title="package.json"
{
  "devDependencies": {
    "@angular/cli": "~20.0.0"
  }
}
```

##### After

```json title="package.json" {3}
{
  "devDependencies": {
    "@angular/cli": "~20.1.0"
  }
}
```



### 21.3.0-package-updates
**Version**: 21.3.0-beta.4


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@angular-devkit/build-angular` | `~20.1.0` | Updated only
| `@angular-devkit/core` | `~20.1.0` | Updated only
| `@angular-devkit/schematics` | `~20.1.0` | Updated only
| `@angular/build` | `~20.1.0` | Updated only
| `@angular/pwa` | `~20.1.0` | Updated only
| `@angular/ssr` | `~20.1.0` | Updated only
| `@schematics/angular` | `~20.1.0` | Updated only
| `@angular-devkit/architect` | `~0.2001.0` | Updated only
| `@angular-devkit/build-webpack` | `~0.2001.0` | Updated only
| `@angular/core` | `~20.1.0` | Added if not installed
| `@angular/material` | `~20.1.0` | Updated only
| `@angular/cdk` | `~20.1.0` | Updated only
| `@angular/google-maps` | `~20.1.0` | Updated only
| `ng-packagr` | `~20.1.0` | Updated only



## 21.2.x

### `update-angular-cli-version-20-0-0`
**Version**: 21.2.0-beta.3

Update the @angular/cli package version to ~20.0.0.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=20.0.0` |
#### Sample Code Changes

Update the `@angular/cli` package version in the `package.json` file at the workspace root to **~20.0.0**.

##### Before

```json title="package.json"
{
  "devDependencies": {
    "@angular/cli": "~19.2.0"
  }
}
```

##### After

```json title="package.json" {3}
{
  "devDependencies": {
    "@angular/cli": "~20.0.0"
  }
}
```



### `migrate-provide-server-rendering-import`
**Version**: 21.2.0-beta.3

Migrate imports of `provideServerRendering` from `@angular/platform-server` to `@angular/ssr`.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=20.0.0` |
#### Migrate Imports of `provideServerRendering` from `@angular/platform-server` to `@angular/ssr`

Migrate the imports of `provideServerRendering` from `@angular/platform-server` to `@angular/ssr`. This migration will also add the `@angular/ssr` package to your dependencies if needed.

#### Examples

Change the import of `provideServerRendering` from `@angular/platform-server` to `@angular/ssr`:

##### Before

```ts title="app/app.config.server.ts" {2}
import { ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';

const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering()],
};
```

##### After

```ts title="app/app.config.server.ts" {2}
import { ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/ssr';

const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering()],
};
```

If you already have imports from `@angular/ssr`, the migration will add `provideServerRendering` to the existing import:

##### Before

```ts title="app/app.config.server.ts" {2-3}
import { ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { provideServerRouting } from '@angular/ssr';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering(), provideServerRouting(serverRoutes)],
};
```

##### After

```ts title="app/app.config.server.ts" {2}
import { ApplicationConfig } from '@angular/core';
import { provideServerRouting, provideServerRendering } from '@angular/ssr';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering(), provideServerRouting(serverRoutes)],
};
```



### `replace-provide-server-routing`
**Version**: 21.2.0-beta.3

Replace `provideServerRouting` and `provideServerRoutesConfig` with `provideServerRendering` using `withRoutes`.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=20.0.0` |
#### Replace `provideServerRouting` and `provideServerRoutesConfig` with `provideServerRendering`

Replace `provideServerRouting` and `provideServerRoutesConfig` calls with `provideServerRendering` using `withRoutes`.

#### Examples

Remove `provideServerRouting` from your providers array and update the `provideServerRendering` call to use `withRoutes`:

##### Before

```ts title="app/app.config.server.ts" {2,6}
import { ApplicationConfig } from '@angular/core';
import { provideServerRendering, provideServerRouting } from '@angular/ssr';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering(), provideServerRouting(serverRoutes)],
};
```

##### After

```ts title="app/app.config.server.ts" {2,6}
import { ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering(withRoutes(serverRoutes))],
};
```

If you have `provideServerRouting` with additional arguments, the migration will preserve them:

##### Before

```ts title="app/app.config.server.ts" {4,11,12}
import { ApplicationConfig } from '@angular/core';
import {
  provideServerRendering,
  provideServerRouting,
  withAppShell,
} from '@angular/ssr';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(),
    provideServerRouting(serverRoutes, withAppShell(AppShellComponent)),
  ],
};
```

##### After

```ts title="app/app.config.server.ts" {2,7-10}
import { ApplicationConfig } from '@angular/core';
import { provideServerRendering, withAppShell, withRoutes } from '@angular/ssr';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(
      withRoutes(serverRoutes),
      withAppShell(AppShellComponent)
    ),
  ],
};
```

Remove `provideServerRoutesConfig` from your providers array and update the `provideServerRendering` call to use `withRoutes`:

##### Before

```ts title="app/app.config.server.ts" {4,11,12}
import { ApplicationConfig } from '@angular/core';
import {
  provideServerRendering,
  provideServerRoutesConfig,
  withAppShell,
} from '@angular/ssr';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(),
    provideServerRoutesConfig(serverRoutes, withAppShell(AppShellComponent)),
  ],
};
```

##### After

```ts title="app/app.config.server.ts" {2,7-10}
import { ApplicationConfig } from '@angular/core';
import { provideServerRendering, withAppShell, withRoutes } from '@angular/ssr';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(
      withRoutes(serverRoutes),
      withAppShell(AppShellComponent)
    ),
  ],
};
```



### `set-generator-defaults-for-previous-style-guide`
**Version**: 21.2.0-beta.3

Update the generator defaults to maintain the previous style guide behavior.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=20.0.0` |
#### Set Generator Defaults for Previous Style Guide

Updates the generator defaults in the `nx.json` file to maintain the previous Angular Style Guide behavior. This ensures that newly generated code in existing workspaces follows the same conventions as the existing codebase.

#### Examples

The migration will add default configurations for the relevant Angular generators in the workspace's `nx.json` file:

##### Before

```json title="nx.json"
{
  "generators": {}
}
```

##### After

```json title="nx.json"
{
  "generators": {
    "@nx/angular:component": {
      "type": "component"
    },
    "@nx/angular:directive": {
      "type": "directive"
    },
    "@nx/angular:service": {
      "type": "service"
    },
    "@nx/angular:scam": {
      "type": "component"
    },
    "@nx/angular:scam-directive": {
      "type": "directive"
    },
    "@nx/angular:guard": {
      "typeSeparator": "."
    },
    "@nx/angular:interceptor": {
      "typeSeparator": "."
    },
    "@nx/angular:module": {
      "typeSeparator": "."
    },
    "@nx/angular:pipe": {
      "typeSeparator": "."
    },
    "@nx/angular:resolver": {
      "typeSeparator": "."
    },
    "@schematics/angular:component": {
      "type": "component"
    },
    "@schematics/angular:directive": {
      "type": "directive"
    },
    "@schematics/angular:service": {
      "type": "service"
    },
    "@schematics/angular:guard": {
      "typeSeparator": "."
    },
    "@schematics/angular:interceptor": {
      "typeSeparator": "."
    },
    "@schematics/angular:module": {
      "typeSeparator": "."
    },
    "@schematics/angular:pipe": {
      "typeSeparator": "."
    },
    "@schematics/angular:resolver": {
      "typeSeparator": "."
    }
  }
}
```

If some of the generator defaults are already set, the migration will not override them:

##### Before

```json title="nx.json" {3-14}
{
  "generators": {
    "@nx/angular:component": {
      "type": "cmp"
    },
    "@schematics/angular:component": {
      "type": "cmp"
    },
    "@nx/angular:interceptor": {
      "typeSeparator": "-"
    },
    "@schematics/angular:interceptor": {
      "typeSeparator": "-"
    }
  }
}
```

##### After

```json title="nx.json" {3-14}
{
  "generators": {
    "@nx/angular:component": {
      "type": "cmp"
    },
    "@schematics/angular:component": {
      "type": "cmp"
    },
    "@nx/angular:interceptor": {
      "typeSeparator": "-"
    },
    "@schematics/angular:interceptor": {
      "typeSeparator": "-"
    },
    "@nx/angular:directive": {
      "type": "directive"
    },
    "@nx/angular:service": {
      "type": "service"
    },
    "@nx/angular:scam": {
      "type": "component"
    },
    "@nx/angular:scam-directive": {
      "type": "directive"
    },
    "@nx/angular:guard": {
      "typeSeparator": "."
    },
    "@nx/angular:module": {
      "typeSeparator": "."
    },
    "@nx/angular:pipe": {
      "typeSeparator": "."
    },
    "@nx/angular:resolver": {
      "typeSeparator": "."
    },
    "@schematics/angular:directive": {
      "type": "directive"
    },
    "@schematics/angular:service": {
      "type": "service"
    },
    "@schematics/angular:guard": {
      "typeSeparator": "."
    },
    "@schematics/angular:module": {
      "typeSeparator": "."
    },
    "@schematics/angular:pipe": {
      "typeSeparator": "."
    },
    "@schematics/angular:resolver": {
      "typeSeparator": "."
    }
  }
}
```



### `update-module-resolution`
**Version**: 21.2.0-beta.3

Update 'moduleResolution' to 'bundler' in TypeScript configurations. You can read more about this here: https://www.typescriptlang.org/tsconfig/#moduleResolution.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=20.0.0` |
#### Update `moduleResolution` to `bundler` in TypeScript configurations

Updates the TypeScript `moduleResolution` option to `'bundler'` for improved compatibility with modern package resolution algorithms used by bundlers like Webpack, Vite, and esbuild.

#### Examples

The migration will update TypeScript configuration files in your workspace to use the `'bundler'` module resolution strategy:

##### Before

```json title="apps/app1/tsconfig.app.json" {4}
{
  "compilerOptions": {
    "module": "es2020",
    "moduleResolution": "node"
  }
}
```

##### After

```json title="apps/app1/tsconfig.app.json" {4}
{
  "compilerOptions": {
    "module": "es2020",
    "moduleResolution": "bundler"
  }
}
```

If the `moduleResolution` is already set to `'bundler'` or the `module` is set to `'preserve'`, the migration will not modify the configuration:

##### Before

```json title="apps/app1/tsconfig.app.json" {3-4}
{
  "compilerOptions": {
    "module": "preserve",
    "moduleResolution": "node"
  }
}
```

##### After

```json title="apps/app1/tsconfig.app.json" {3-4}
{
  "compilerOptions": {
    "module": "preserve",
    "moduleResolution": "node"
  }
}
```



### 21.2.0-package-updates
**Version**: 21.2.0-beta.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@angular-devkit/build-angular` | `~20.0.0` | Updated only
| `@angular-devkit/core` | `~20.0.0` | Updated only
| `@angular-devkit/schematics` | `~20.0.0` | Updated only
| `@angular/build` | `~20.0.0` | Updated only
| `@angular/pwa` | `~20.0.0` | Updated only
| `@angular/ssr` | `~20.0.0` | Updated only
| `@schematics/angular` | `~20.0.0` | Updated only
| `@angular-devkit/architect` | `~0.2000.0` | Updated only
| `@angular-devkit/build-webpack` | `~0.2000.0` | Updated only
| `@angular/core` | `~20.0.0` | Added if not installed
| `@angular/material` | `~20.0.0` | Updated only
| `@angular/cdk` | `~20.0.0` | Updated only
| `@angular/google-maps` | `~20.0.0` | Updated only
| `ng-packagr` | `~20.0.0` | Updated only


### 21.2.0-angular-eslint-package-updates
**Version**: 21.2.0-beta.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `angular-eslint` | `^20.0.0` | Updated only


### 21.2.0-@angular-eslint-package-updates
**Version**: 21.2.0-beta.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@angular-eslint/eslint-plugin` | `^20.0.0` | Updated only
| `@angular-eslint/eslint-plugin-template` | `^20.0.0` | Updated only
| `@angular-eslint/template-parser` | `^20.0.0` | Updated only
| `@angular-eslint/utils` | `^20.0.0` | Updated only
| `@angular-eslint/schematics` | `^20.0.0` | Updated only
| `@angular-eslint/test-utils` | `^20.0.0` | Updated only
| `@angular-eslint/builder` | `^20.0.0` | Updated only
| `@angular-eslint/bundled-angular-compiler` | `^20.0.0` | Updated only


### 21.2.0-angular-rspack-package-updates
**Version**: 21.2.0-beta.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@nx/angular-rspack` | `^21.1.0` | Updated only


### 21.2.0-jest-package-updates
**Version**: 21.2.0-beta.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `jest-preset-angular` | `~14.6.0` | Updated only



## 21.1.x

### 21.1.0-package-updates
**Version**: 21.1.0-beta.1


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@nx/angular-rspack` | `^21.0.1` | Updated only



## 21.0.x

### `set-continuous-option`
**Version**: 21.0.0-beta.3

Set the `continuous` option to `true` for continuous tasks.

#### Set `continuous` Option for Continuous Tasks

This migration sets the `continuous` option to `true` for tasks that are known to run continuously, and only if the option is not already explicitly set.

Specifically, it updates Angular targets using the following executors:

- `@angular-devkit/build-angular:dev-server`
- `@angular-devkit/build-angular:ssr-dev-server`
- `@nx/angular:dev-server`
- `@nx/angular:module-federation-dev-server`
- `@nx/angular:module-federation-dev-ssr`

#### Examples

##### Before

```json title="apps/app1/project.json"
{
  // ...
  "targets": {
    // ...
    "serve": {
      "executor": "@angular-devkit/build-angular:dev-server",
      "options": {
        "buildTarget": "my-app:build",
        "port": 4200
      }
    }
  }
}
```

##### After

```json title="apps/app1/project.json" {6}
{
  // ...
  "targets": {
    // ...
    "serve": {
      "continuous": true,
      "executor": "@angular-devkit/build-angular:dev-server",
      "options": {
        "buildTarget": "my-app:build",
        "port": 4200
      }
    }
  }
}
```

When a target is already explicitly configured with a `continuous` option, the migration will not modify it:

##### Before

```json title="apps/app1/project.json" {6}
{
  // ...
  "targets": {
    // ...
    "serve": {
      "continuous": false,
      "executor": "@nx/angular:dev-server",
      "options": {
        "buildTarget": "my-app:build",
        "port": 4200
      }
    }
  }
}
```

##### After

```json title="apps/app1/project.json" {6}
{
  // ...
  "targets": {
    // ...
    "serve": {
      "continuous": false,
      "executor": "@nx/angular:dev-server",
      "options": {
        "buildTarget": "my-app:build",
        "port": 4200
      }
    }
  }
}
```



### `change-data-persistence-operators-imports-to-ngrx-router-store-data-persistence`
**Version**: 21.0.0-beta.5

Change the data persistence operator imports to '@ngrx/router-store/data-persistence'.

#### Requires

| Name | Version |
|------|---------|
 `@ngrx/store` | `>=16.0.0` |
#### Change the Data Persistence Operator Imports from `@nx/angular` to `@ngrx/router-store/data-persistence`

The data persistence operators (`fetch`, `navigation`, `optimisticUpdate`, and `pessimisticUpdate`) have been deprecated for a while and are now removed from the `@nx/angular` package. This migration automatically updates your import statements to use the `@ngrx/router-store/data-persistence` module and adds `@ngrx/router-store` to your dependencies if needed.

#### Examples

If you import only data persistence operators from `@nx/angular`, the migration will update the import path to `@ngrx/router-store/data-persistence`.

##### Before

```ts title="apps/app1/src/app/users/users.effects.ts" {2}
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { fetch } from '@nx/angular';

@Injectable()
export class UsersEffects {
  // ...
}
```

##### After

```ts title="apps/app1/src/app/users/users.effects.ts" {2}
import { Injectable } from '@angular/core';
import { fetch } from '@ngrx/router-store/data-persistence';

@Injectable()
export class UsersEffects {
  // ...
}
```

If you import multiple data persistence operators from `@nx/angular`, the migration will update the import path for all of them.

##### Before

```ts title="apps/app1/src/app/users/users.effects.ts" {2}
import { Injectable } from '@angular/core';
import { fetch, navigation } from '@nx/angular';

@Injectable()
export class UsersEffects {
  // ...
}
```

##### After

```ts title="apps/app1/src/app/users/users.effects.ts" {2}
import { Injectable } from '@angular/core';
import { fetch, navigation } from '@ngrx/router-store/data-persistence';

@Injectable()
export class UsersEffects {
  // ...
}
```

If your imports mix data persistence operators with other utilities from `@nx/angular`, the migration will split them into separate import statements.

##### Before

```ts title="apps/app1/src/app/users/users.effects.ts" {2}
import { Injectable } from '@angular/core';
import { fetch, someExtraUtility, navigation } from '@nx/angular';

@Injectable()
export class UsersEffects {
  // ...
}
```

##### After

```ts title="apps/app1/src/app/users/users.effects.ts" {2-3}
import { Injectable } from '@angular/core';
import { fetch, navigation } from '@ngrx/router-store/data-persistence';
import { someExtraUtility } from '@nx/angular';

@Injectable()
export class UsersEffects {
  // ...
}
```

If you don't already have `@ngrx/router-store` in your dependencies, the migration will add it to your package.json.

##### Before

```jsonc title="package.json"
{
  "dependencies": {
    "@nx/angular": "^21.0.0",
    "@ngrx/store": "^19.1.0",
    "@ngrx/effects": "^19.1.0",
    // ...
  },
}
```

##### After

```jsonc title="package.json" {6}
{
  "dependencies": {
    "@nx/angular": "^21.0.0",
    "@ngrx/store": "^19.1.0",
    "@ngrx/effects": "^19.1.0",
    "@ngrx/router-store": "^19.1.0",
    // ...
  },
}
```




## 20.8.x

### 20.8.1-package-updates
**Version**: 20.8.1-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@nx/angular-rspack` | `^20.7.0` | Updated only



## 20.5.x

### `update-angular-cli-version-19-2-0`
**Version**: 20.5.0-beta.5

Update the @angular/cli package version to ~19.2.0.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=19.2.0` |
#### Sample Code Changes

Update the `@angular/cli` package version in the `package.json` file at the workspace root to **~19.2.0**.

##### Before

```json title="package.json"
{
  "devDependencies": {
    "@angular/cli": "~19.1.0"
  }
}
```

##### After

```json title="package.json" {3}
{
  "devDependencies": {
    "@angular/cli": "~19.2.0"
  }
}
```



### 20.5.0-package-updates
**Version**: 20.5.0-beta.5


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@angular-devkit/build-angular` | `~19.2.0` | Updated only
| `@angular-devkit/core` | `~19.2.0` | Updated only
| `@angular-devkit/schematics` | `~19.2.0` | Updated only
| `@angular/build` | `~19.2.0` | Updated only
| `@angular/pwa` | `~19.2.0` | Updated only
| `@angular/ssr` | `~19.2.0` | Updated only
| `@schematics/angular` | `~19.2.0` | Updated only
| `@angular-devkit/architect` | `~0.1902.0` | Updated only
| `@angular-devkit/build-webpack` | `~0.1902.0` | Updated only
| `@angular/core` | `~19.2.0` | Added if not installed
| `@angular/material` | `~19.2.1` | Updated only
| `@angular/cdk` | `~19.2.1` | Updated only
| `@angular/google-maps` | `~19.2.1` | Updated only
| `ng-packagr` | `~19.2.0` | Updated only


### 20.5.0-angular-eslint-package-updates
**Version**: 20.5.0-rc.1


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `angular-eslint` | `^19.2.0` | Updated only
| `@angular-eslint/eslint-plugin` | `^19.2.0` | Updated only
| `@angular-eslint/eslint-plugin-template` | `^19.2.0` | Updated only
| `@angular-eslint/template-parser` | `^19.2.0` | Updated only
| `@angular-eslint/utils` | `^19.2.0` | Updated only
| `@angular-eslint/schematics` | `^19.2.0` | Updated only
| `@angular-eslint/test-utils` | `^19.2.0` | Updated only
| `@angular-eslint/builder` | `^19.2.0` | Updated only
| `@angular-eslint/bundled-angular-compiler` | `^19.2.0` | Updated only



## 20.4.x

### `update-angular-cli-version-19-1-0`
**Version**: 20.4.0-beta.1

Update the @angular/cli package version to ~19.1.0.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=19.1.0` |
#### Update `@angular/cli` to `~19.1.0`

Update the version of the Angular CLI if it is specified in `package.json`

#### Sample Code Changes

Update in `devDependencies`:

##### Before

```json title="package.json"
{
  "devDependencies": {
    "@angular/cli": "~13.3.0"
  }
}
```

##### After

```json title="package.json"
{
  "devDependencies": {
    "@angular/cli": "~19.1.0"
  }
}
```

Update in `dependencies`:

##### Before

```json title="package.json"
{
  "dependencies": {
    "@angular/cli": "~13.3.0"
  }
}
```

##### After

```json title="package.json"
{
  "dependencies": {
    "@angular/cli": "~19.1.0"
  }
}
```



### 20.4.0-package-updates
**Version**: 20.4.0-beta.1


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@angular-devkit/build-angular` | `~19.1.0` | Updated only
| `@angular-devkit/core` | `~19.1.0` | Updated only
| `@angular-devkit/schematics` | `~19.1.0` | Updated only
| `@angular/build` | `~19.1.0` | Updated only
| `@angular/pwa` | `~19.1.0` | Updated only
| `@angular/ssr` | `~19.1.0` | Updated only
| `@schematics/angular` | `~19.1.0` | Updated only
| `@angular-devkit/architect` | `~0.1901.0` | Updated only
| `@angular-devkit/build-webpack` | `~0.1901.0` | Updated only
| `@angular/core` | `~19.1.0` | Added if not installed
| `@angular/material` | `~19.1.0` | Updated only
| `@angular/cdk` | `~19.1.0` | Updated only
| `@angular/google-maps` | `~19.1.0` | Updated only
| `ng-packagr` | `~19.1.0` | Updated only



## 20.3.x

### `ensure-nx-module-federation-package`
**Version**: 20.3.0-beta.2

If workspace includes Module Federation projects, ensure the new @nx/module-federation package is installed.

#### Ensure the @nx/module-federation Package is Installed

If workspace includes Module Federation projects, ensure the new `@nx/module-federation` package is installed.

#### Sample Code Changes

##### Before

```json title="package.json"
{
  "dependencies": {}
}
```

##### After

```json title="package.json"
{
  "dependencies": {
    "@nx/module-federation": "20.3.0"
  }
}
```



### 20.2.3-ngrx-package-updates
**Version**: 20.3.0-beta.2


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@ngrx/store` | `^19.0.0` | Updated only



## 20.2.x

### `update-20-2-0-update-module-federation-config-import`
**Version**: 20.2.0-beta.2

Update the ModuleFederationConfig import use @nx/module-federation.

#### Migrate Module Federation Imports to New Package

Update the ModuleFederationConfig imports to use @nx/module-federation.

#### Sample Code Changes

Update import paths for ModuleFederationConfig.

##### Before

```js title="apps/shell/webpack.config.js"
import { ModuleFederationConfig } from '@nx/webpack';
```

##### After

```js title="apps/shell/webpack.config.js"
import { ModuleFederationConfig } from '@nx/module-federation';
```



### `update-20-2-0-update-with-module-federation-import`
**Version**: 20.2.0-beta.2

Update the withModuleFederation import use @nx/module-federation/angular.

#### Migrate withModuleFederation Import to New Package

Update the withModuleFederation import to use @nx/module-federation/webpack.

#### Sample Code Changes

Update import paths for `withModuleFederation` and `withModuleFederationForSSR`.

##### Before

```ts title="apps/shell/webpack.config.ts"
import {
  withModuleFederation,
  withModuleFederationForSSR,
} from '@nx/angular/module-federation';
```

##### After

```ts title="apps/shell/webpack.config.ts"
import {
  withModuleFederation,
  withModuleFederationForSSR,
} from '@nx/module-federation/angular';
```



### `update-angular-cli-version-19-0-0`
**Version**: 20.2.0-beta.5

Update the @angular/cli package version to ~19.0.0.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=19.0.0` |
#### Update `@angular/cli` to `~19.0.0`

Update the version of the Angular CLI if it is specified in `package.json`

#### Sample Code Changes

Update in `devDependencies`:

##### Before

```json title="package.json"
{
  "devDependencies": {
    "@angular/cli": "~13.3.0"
  }
}
```

##### After

```json title="package.json"
{
  "devDependencies": {
    "@angular/cli": "~19.0.0"
  }
}
```

Update in `dependencies`:

##### Before

```json title="package.json"
{
  "dependencies": {
    "@angular/cli": "~13.3.0"
  }
}
```

##### After

```json title="package.json"
{
  "dependencies": {
    "@angular/cli": "~19.0.0"
  }
}
```



### `add-localize-polyfill-to-targets`
**Version**: 20.2.0-beta.5

Add the '@angular/localize/init' polyfill to the 'polyfills' option of targets using esbuild-based executors.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=19.0.0` |
#### Add Localize Polyfill to Targets

Add the '@angular/localize/init' polyfill to the 'polyfills' option of targets using esbuild-based executors.

#### Sample Code Changes

Add the `@angular/localize/init` polyfill to any of these executors:

- `@angular/build:application`
- `@angular-devkit/build-angular:application`
- `@nx/angular:application`
- `@angular-devkit/build-angular:browser-esbuild`
- `@nx/angular:browser-esbuild`

##### Before

```json title="apps/app1/project.json"
{
  "targets": {
    "build": {
      "executor": "@angular/build:application",
      "options": {
        "localize": true
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
      "executor": "@angular/build:application",
      "options": {
        "localize": true,
        "polyfills": ["@angular/localize/init"]
      }
    }
  }
}
```



### `update-angular-ssr-imports-to-use-node-entry-point`
**Version**: 20.2.0-beta.5

Update '@angular/ssr' import paths to use the new '/node' entry point when 'CommonEngine' is detected.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=19.0.0` |
#### Update Angular SSR Imports to Use Node Entry Point

Update '@angular/ssr' import paths to use the new '/node' entry point when 'CommonEngine' is detected.

#### Sample Code Changes

Update import paths for SSR CommonEngine properties to use `@angular/ssr/node`.

##### Before

```ts title="apps/app1/server.ts"
import { CommonEngine } from '@angular/ssr';
import type {
  CommonEngineOptions,
  CommonEngineRenderOptions,
} from '@angular/ssr';
```

##### After

```ts title="apps/app1/server.ts"
import { CommonEngine } from '@angular/ssr/node';
import type {
  CommonEngineOptions,
  CommonEngineRenderOptions,
} from '@angular/ssr/node';
```



### `disable-angular-eslint-prefer-standalone`
**Version**: 20.2.0-beta.6

Disable the Angular ESLint prefer-standalone rule if not set.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=19.0.0` |
#### Disable Angular ESLint Prefer Standalone

Disable the Angular ESLint prefer-standalone rule if not set.

#### Sample Code Changes

Update import paths for `withModuleFederation` and `withModuleFederationForSSR`.

##### Before

```json title="apps/app1/.eslintrc.json"
{
  "overrides": [
    {
      "files": ["*.html"],
      "rules": {
        "some-rule-for-html": "error"
      }
    }
  ]
}
```

##### After

```json title="apps/app1/.eslintrc.json"
{
  "overrides": [
    {
      "files": ["*.html"],
      "rules": {
        "some-rule-for-html": "error"
      }
    },
    {
      "files": ["*.ts"],
      "rules": {
        "@angular-eslint/prefer-standalone": "off"
      }
    }
  ]
}
```

import {
addProjectConfiguration,
writeJson,
type ProjectConfiguration,
type ProjectGraph,
type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './disable-angular-eslint-prefer-standalone';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
...jest.requireActual('@nx/devkit'),
createProjectGraphAsync: () => Promise.resolve(projectGraph),
}));

describe('disable-angular-eslint-prefer-standalone', () => {
let tree: Tree;

beforeEach(() => {
tree = createTreeWithEmptyWorkspace();

    const projectConfig: ProjectConfiguration = {
      name: 'app1',
      root: 'apps/app1',
    };
    projectGraph = {
      dependencies: {
        app1: [
          {
            source: 'app1',
            target: 'npm:@angular/core',
            type: 'static',
          },
        ],
      },
      nodes: {
        app1: {
          data: projectConfig,
          name: 'app1',
          type: 'app',
        },
      },
    };
    addProjectConfiguration(tree, projectConfig.name, projectConfig);

});

describe('.eslintrc.json', () => {
it('should not disable @angular-eslint/prefer-standalone when it is set', async () => {
writeJson(tree, 'apps/app1/.eslintrc.json', {
overrides: [
{
files: ['*.ts'],
rules: { '@angular-eslint/prefer-standalone': ['error'] },
},
],
});

      await migration(tree);

      expect(tree.read('apps/app1/.eslintrc.json', 'utf8'))
        .toMatchInlineSnapshot(`
        "{
          "overrides": [
            {
              "files": ["*.ts"],
              "rules": {
                "@angular-eslint/prefer-standalone": ["error"]
              }
            }
          ]
        }
        "
      `);
    });

    it('should not disable @angular-eslint/prefer-standalone when there are multiple overrides for angular eslint and the rule is set in one of them', async () => {
      writeJson(tree, 'apps/app1/.eslintrc.json', {
        overrides: [
          {
            files: ['*.ts'],
            rules: {
              '@angular-eslint/directive-selector': [
                'error',
                { type: 'attribute', prefix: 'app', style: 'camelCase' },
              ],
            },
          },
          {
            files: ['*.ts'],
            rules: { '@angular-eslint/prefer-standalone': ['error'] },
          },
        ],
      });

      await migration(tree);

      expect(tree.read('apps/app1/.eslintrc.json', 'utf8'))
        .toMatchInlineSnapshot(`
        "{
          "overrides": [
            {
              "files": ["*.ts"],
              "rules": {
                "@angular-eslint/directive-selector": [
                  "error",
                  {
                    "type": "attribute",
                    "prefix": "app",
                    "style": "camelCase"
                  }
                ]
              }
            },
            {
              "files": ["*.ts"],
              "rules": {
                "@angular-eslint/prefer-standalone": ["error"]
              }
            }
          ]
        }
        "
      `);
    });

    it('should disable @angular-eslint/prefer-standalone in an existing override for angular eslint', async () => {
      writeJson(tree, 'apps/app1/.eslintrc.json', {
        overrides: [
          {
            files: ['*.ts'],
            rules: { 'no-unused-vars': 'error' },
          },
          {
            files: ['*.ts'],
            rules: {
              '@angular-eslint/directive-selector': [
                'error',
                { type: 'attribute', prefix: 'app', style: 'camelCase' },
              ],
            },
          },
        ],
      });

      await migration(tree);

      expect(tree.read('apps/app1/.eslintrc.json', 'utf8'))
        .toMatchInlineSnapshot(`
        "{
          "overrides": [
            {
              "files": ["*.ts"],
              "rules": {
                "no-unused-vars": "error"
              }
            },
            {
              "files": ["*.ts"],
              "rules": {
                "@angular-eslint/directive-selector": [
                  "error",
                  {
                    "type": "attribute",
                    "prefix": "app",
                    "style": "camelCase"
                  }
                ],
                "@angular-eslint/prefer-standalone": "off"
              }
            }
          ]
        }
        "
      `);
    });

    it('should disable @angular-eslint/prefer-standalone in an existing override for ts files', async () => {
      writeJson(tree, 'apps/app1/.eslintrc.json', {
        overrides: [
          {
            files: ['*.ts'],
            rules: { 'no-unused-vars': 'error' },
          },
        ],
      });

      await migration(tree);

      expect(tree.read('apps/app1/.eslintrc.json', 'utf8'))
        .toMatchInlineSnapshot(`
        "{
          "overrides": [
            {
              "files": ["*.ts"],
              "rules": {
                "no-unused-vars": "error",
                "@angular-eslint/prefer-standalone": "off"
              }
            }
          ]
        }
        "
      `);
    });

    it('should disable @angular-eslint/prefer-standalone in a new override', async () => {
      writeJson(tree, 'apps/app1/.eslintrc.json', {
        overrides: [
          {
            files: ['*.html'],
            rules: { 'some-rule-for-html': 'error' },
          },
        ],
      });

      await migration(tree);

      expect(tree.read('apps/app1/.eslintrc.json', 'utf8'))
        .toMatchInlineSnapshot(`
        "{
          "overrides": [
            {
              "files": ["*.html"],
              "rules": {
                "some-rule-for-html": "error"
              }
            },
            {
              "files": ["*.ts"],
              "rules": {
                "@angular-eslint/prefer-standalone": "off"
              }
            }
          ]
        }
        "
      `);
    });

});

describe('flat config', () => {
it('should not disable @angular-eslint/prefer-standalone when it is set', async () => {
tree.write('eslint.config.js', 'module.exports = [];');
tree.write(
'apps/app1/eslint.config.js',
`module.exports = [
          {
            files: ['*.ts'],
            rules: { '@angular-eslint/prefer-standalone': ['error'] },
          },
        ];
        `
);

      await migration(tree);

      expect(tree.read('apps/app1/eslint.config.js', 'utf8'))
        .toMatchInlineSnapshot(`
        "module.exports = [
          {
            files: ['*.ts'],
            rules: { '@angular-eslint/prefer-standalone': ['error'] },
          },
        ];
        "
      `);
    });

    it('should not disable @angular-eslint/prefer-standalone when there are multiple overrides for angular eslint and the rule is set in one of them', async () => {
      tree.write('eslint.config.js', 'module.exports = [];');
      tree.write(
        'apps/app1/eslint.config.js',
        `module.exports = [
          {
            files: ['*.ts'],
            rules: {
              '@angular-eslint/directive-selector': [
                'error',
                { type: 'attribute', prefix: 'app', style: 'camelCase' },
              ],
            },
          },
          {
            files: ['*.ts'],
            rules: { '@angular-eslint/prefer-standalone': ['error'] },
          },
        ];
        `
      );

      await migration(tree);

      expect(tree.read('apps/app1/eslint.config.js', 'utf8'))
        .toMatchInlineSnapshot(`
        "module.exports = [
          {
            files: ['*.ts'],
            rules: {
              '@angular-eslint/directive-selector': [
                'error',
                { type: 'attribute', prefix: 'app', style: 'camelCase' },
              ],
            },
          },
          {
            files: ['*.ts'],
            rules: { '@angular-eslint/prefer-standalone': ['error'] },
          },
        ];
        "
      `);
    });

    it('should disable @angular-eslint/prefer-standalone in an existing override for angular eslint', async () => {
      tree.write('eslint.config.js', 'module.exports = [];');
      tree.write(
        'apps/app1/eslint.config.js',
        `module.exports = [
          {
            files: ['*.ts'],
            rules: { 'no-unused-vars': 'error' },
          },
          {
            files: ['*.ts'],
            rules: {
              '@angular-eslint/directive-selector': [
                'error',
                { type: 'attribute', prefix: 'app', style: 'camelCase' },
              ],
            },
          },
        ];
        `
      );

      await migration(tree);

      expect(tree.read('apps/app1/eslint.config.js', 'utf8'))
        .toMatchInlineSnapshot(`
        "module.exports = [
          {
            files: ['*.ts'],
            rules: { 'no-unused-vars': 'error' },
          },
          {
            files: ['**/*.ts'],
            rules: {
              '@angular-eslint/directive-selector': [
                'error',
                {
                  type: 'attribute',
                  prefix: 'app',
                  style: 'camelCase',
                },
              ],
              '@angular-eslint/prefer-standalone': 'off',
            },
          },
        ];
        "
      `);
    });

    it('should disable @angular-eslint/prefer-standalone in an existing override for ts files', async () => {
      tree.write('eslint.config.js', 'module.exports = [];');
      tree.write(
        'apps/app1/eslint.config.js',
        `module.exports = [
          {
            files: ['*.ts'],
            rules: { 'no-unused-vars': 'error' },
          },
        ];
        `
      );

      await migration(tree);

      expect(tree.read('apps/app1/eslint.config.js', 'utf8'))
        .toMatchInlineSnapshot(`
        "module.exports = [
          {
            files: ['**/*.ts'],
            rules: {
              'no-unused-vars': 'error',
              '@angular-eslint/prefer-standalone': 'off',
            },
          },
        ];
        "
      `);
    });

    it('should disable @angular-eslint/prefer-standalone in a new override', async () => {
      tree.write('eslint.config.js', 'module.exports = [];');
      tree.write(
        'apps/app1/eslint.config.js',
        `module.exports = [
          {
            files: ['*.html'],
            rules: { 'some-rule-for-html': 'error' },
          },
        ];
        `
      );

      await migration(tree);

      expect(tree.read('apps/app1/eslint.config.js', 'utf8'))
        .toMatchInlineSnapshot(`
        "module.exports = [
          {
            files: ['*.html'],
            rules: { 'some-rule-for-html': 'error' },
          },
          {
            files: ['**/*.ts'],
            rules: {
              '@angular-eslint/prefer-standalone': 'off',
            },
          },
        ];
        "
      `);
    });

});
});



### `remove-angular-eslint-rules`
**Version**: 20.2.0-beta.8

Remove Angular ESLint rules that were removed in v19.0.0.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=19.0.0` |
#### Remove Angular ESLint Rules

Remove Angular ESLint rules that were removed in v19.0.0.

#### Sample Code Changes

Removes `@angular-eslint/no-host-metadata-property`, `@angular-eslint/sort-ngmodule-metadata-arrays` and `@angular-eslint/prefer-standalone-component` from any ESLint config file. Files to be searched include `.eslintrc.json`, `.eslintrc.base.json`, `.eslint.config.js` and `.eslint.config.base.js`.

##### Before

```json title="apps/app1/.eslintrc.json"
{
  "overrides": [
    {
      "files": ["*.ts"],
      "rules": {
        "@angular-eslint/no-host-metadata-property": ["error"],
        "@angular-eslint/sort-ngmodule-metadata-arrays": ["error"],
        "@angular-eslint/prefer-standalone-component": ["error"]
      }
    }
  ]
}
```

##### After

```json title="apps/app1/.eslintrc.json"
{
  "overrides": [
    {
      "files": ["*.ts"],
      "rules": {}
    }
  ]
}
```



### `remove-tailwind-config-from-ng-packagr-executors`
**Version**: 20.2.0-beta.8

Remove the deprecated 'tailwindConfig' option from ng-packagr executors. Tailwind CSS configurations located at the project or workspace root will be picked up automatically.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=19.0.0` |
#### Remove tailwindConfig from ng-packagr Executors

Remove the deprecated 'tailwindConfig' option from ng-packagr executors. Tailwind CSS configurations located at the project or workspace root will be picked up automatically.

#### Sample Code Changes

Remove `tailwindConfig` from the `@nx/angular:ng-packagr-lite` or `@nx/angular:package` executor options in project configuration.

##### Before

```json title="libs/my-lib/project.json"
{
  "targets": {
    "build": {
      "executor": "@nx/angular:ng-packagr-lite",
      "options": {
        "project": "libs/lib1/ng-package.json",
        "tailwindConfig": "libs/lib1/tailwind.config.js"
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
      "executor": "@nx/angular:ng-packagr-lite",
      "options": {
        "project": "libs/lib1/ng-package.json"
      }
    }
  }
}
```

Remove `tailwindConfig` from the `@nx/angular:ng-packagr-lite` or `@nx/angular:package` executor target defaults in `nx.json`.

##### Before

```json title="nx.json"
{
  "targetDefaults": {
    "@nx/angular:ng-packagr-lite": {
      "options": {
        "project": "{projectRoot}/ng-package.json",
        "tailwindConfig": "{projectRoot}/tailwind.config.js"
      }
    }
  }
}
```

##### After

```json title="nx.json"
{
  "targetDefaults": {
    "@nx/angular:ng-packagr-lite": {
      "options": {
        "project": "{projectRoot}/ng-package.json"
      }
    }
  }
}
```



### 20.2.0-module-federation-package-updates
**Version**: 20.2.0-beta.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@module-federation/enhanced` | `0.7.6` | Updated only
| `@module-federation/runtime` | `0.7.6` | Updated only
| `@module-federation/sdk` | `0.7.6` | Updated only
| `@module-federation/node` | `2.6.11` | Updated only


### 20.2.0-package-updates
**Version**: 20.2.0-beta.5


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@angular-devkit/build-angular` | `~19.0.0` | Updated only
| `@angular-devkit/core` | `~19.0.0` | Updated only
| `@angular-devkit/schematics` | `~19.0.0` | Updated only
| `@angular/build` | `~19.0.0` | Updated only
| `@angular/pwa` | `~19.0.0` | Updated only
| `@angular/ssr` | `~19.0.0` | Updated only
| `@schematics/angular` | `~19.0.0` | Updated only
| `@angular-devkit/architect` | `~0.1900.0` | Updated only
| `@angular-devkit/build-webpack` | `~0.1900.0` | Updated only
| `@angular/core` | `~19.0.0` | Added if not installed
| `@angular/material` | `~19.0.0` | Updated only
| `@angular/cdk` | `~19.0.0` | Updated only
| `@angular/google-maps` | `~19.0.0` | Updated only
| `ng-packagr` | `~19.0.0` | Updated only
| `zone.js` | `~0.15.0` | Updated only


### 20.2.0-jest-package-updates
**Version**: 20.2.0-beta.5


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `jest-preset-angular` | `~14.4.0` | Updated only


### 20.2.0-angular-eslint-package-updates
**Version**: 20.2.0-beta.5


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `angular-eslint` | `^19.0.0` | Updated only
| `@angular-eslint/eslint-plugin` | `^19.0.0` | Updated only
| `@angular-eslint/eslint-plugin-template` | `^19.0.0` | Updated only
| `@angular-eslint/template-parser` | `^19.0.0` | Updated only
| `@angular-eslint/utils` | `^19.0.0` | Updated only
| `@angular-eslint/schematics` | `^19.0.0` | Updated only
| `@angular-eslint/test-utils` | `^19.0.0` | Updated only
| `@angular-eslint/builder` | `^19.0.0` | Updated only
| `@angular-eslint/bundled-angular-compiler` | `^19.0.0` | Updated only


### 20.2.0-analog-package-updates
**Version**: 20.2.0-beta.7


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@analogjs/vitest-angular` | `~1.10.0` | Updated only
| `@analogjs/vite-plugin-angular` | `~1.10.0` | Updated only


### 20.2.2-angular-eslint-package-updates
**Version**: 20.2.2-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `angular-eslint` | `^19.0.2` | Updated only
| `@angular-eslint/eslint-plugin` | `^19.0.2` | Updated only
| `@angular-eslint/eslint-plugin-template` | `^19.0.2` | Updated only
| `@angular-eslint/template-parser` | `^19.0.2` | Updated only
| `@angular-eslint/utils` | `^19.0.2` | Updated only
| `@angular-eslint/schematics` | `^19.0.2` | Updated only
| `@angular-eslint/test-utils` | `^19.0.2` | Updated only
| `@angular-eslint/builder` | `^19.0.2` | Updated only
| `@angular-eslint/bundled-angular-compiler` | `^19.0.2` | Updated only



## 19.7.x

### 19.7.0-package-updates
**Version**: 19.7.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@module-federation/enhanced` | `~0.6.0` | Updated only
| `@module-federation/node` | `~2.5.0` | Updated only



## 19.6.x

### `update-19-6-0`
**Version**: 19.6.0-beta.4

Ensure Module Federation DTS is turned off by default.


### `update-angular-cli-version-18-2-0`
**Version**: 19.6.0-beta.7

Update the @angular/cli package version to ~18.2.0.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=18.2.0` |

### `update-19-6-1-ensure-module-federation-target-defaults`
**Version**: 19.6.1-beta.0

Ensure Target Defaults are set correctly for Module Federation.


### 19.6.0-package-updates
**Version**: 19.6.0-beta.7


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@angular-devkit/build-angular` | `~18.2.0` | Updated only
| `@angular-devkit/core` | `~18.2.0` | Updated only
| `@angular-devkit/schematics` | `~18.2.0` | Updated only
| `@angular/build` | `~18.2.0` | Updated only
| `@angular/pwa` | `~18.2.0` | Updated only
| `@angular/ssr` | `~18.2.0` | Updated only
| `@schematics/angular` | `~18.2.0` | Updated only
| `@angular-devkit/architect` | `~0.1802.0` | Updated only
| `@angular-devkit/build-webpack` | `~0.1802.0` | Updated only
| `@angular/core` | `~18.2.0` | Added if not installed
| `@angular/material` | `~18.2.0` | Updated only
| `@angular/cdk` | `~18.2.0` | Updated only
| `ng-packagr` | `~18.2.0` | Updated only
| `zone.js` | `~0.14.10` | Updated only


### 19.6.1-ngrx-package-updates
**Version**: 19.6.1-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@ngrx/store` | `^18.0.2` | Updated only



## 19.5.x

### `update-angular-cli-version-18-1-0`
**Version**: 19.5.0-beta.1

Update the @angular/cli package version to ~18.1.0.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=18.1.0` |

### 19.5.0-module-federation-package-updates
**Version**: 19.5.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@module-federation/node` | `^2.3.0` | Updated only


### 19.5.0-package-updates
**Version**: 19.5.0-beta.1


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@angular-devkit/build-angular` | `~18.1.0` | Updated only
| `@angular-devkit/core` | `~18.1.0` | Updated only
| `@angular-devkit/schematics` | `~18.1.0` | Updated only
| `@angular/build` | `~18.1.0` | Updated only
| `@angular/pwa` | `~18.1.0` | Updated only
| `@angular/ssr` | `~18.1.0` | Updated only
| `@schematics/angular` | `~18.1.0` | Updated only
| `@angular-devkit/architect` | `~0.1801.0` | Updated only
| `@angular-devkit/build-webpack` | `~0.1801.0` | Updated only
| `@angular/core` | `~18.1.0` | Added if not installed
| `@angular/material` | `~18.1.0` | Updated only
| `@angular/cdk` | `~18.1.0` | Updated only
| `ng-packagr` | `~18.1.0` | Updated only


### 19.5.4-ngrx-package-updates
**Version**: 19.5.4-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@ngrx/store` | `^18.0.1` | Updated only
| `@ngrx/operators` | `^18.0.1` | Updated only



## 19.4.x

### 19.4.0-ngrx-package-updates
**Version**: 19.4.0-beta.1


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@ngrx/store` | `^18.0.0` | Updated only



## 19.2.x

### `add-typescript-eslint-utils`
**Version**: 19.2.1-beta.0

Installs the '@typescript-eslint/utils' package when having installed '@angular-eslint/eslint-plugin' or '@angular-eslint/eslint-plugin-template' with version >=18.0.0.

#### Requires

| Name | Version |
|------|---------|
 `@angular-eslint/eslint-plugin` | `>=18.0.0` |


## 19.1.x

### `update-angular-cli-version-18-0-0`
**Version**: 19.1.0-beta.2

Update the @angular/cli package version to ~18.0.0.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=18.0.0` |

### 19.1.0-package-updates
**Version**: 19.1.0-beta.2


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@angular-devkit/build-angular` | `~18.0.0` | Updated only
| `@angular-devkit/core` | `~18.0.0` | Updated only
| `@angular-devkit/schematics` | `~18.0.0` | Updated only
| `@angular/pwa` | `~18.0.0` | Updated only
| `@angular/ssr` | `~18.0.0` | Updated only
| `@schematics/angular` | `~18.0.0` | Updated only
| `@angular-devkit/architect` | `~0.1800.0` | Updated only
| `@angular-devkit/build-webpack` | `~0.1800.0` | Updated only
| `@angular/core` | `~18.0.0` | Added if not installed
| `@angular/material` | `~18.0.0` | Updated only
| `@angular/cdk` | `~18.0.0` | Updated only
| `ng-packagr` | `~18.0.0` | Updated only


### 19.1.0-jest-package-updates
**Version**: 19.1.0-beta.2


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `jest-preset-angular` | `~14.1.0` | Updated only


### 19.1.2-package-updates
**Version**: 19.1.2-beta.1


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@angular-eslint/eslint-plugin` | `^18.0.1` | Updated only
| `@angular-eslint/eslint-plugin-template` | `^18.0.1` | Updated only
| `@angular-eslint/template-parser` | `^18.0.1` | Updated only
| `@angular-eslint/utils` | `^18.0.1` | Updated only
| `@angular-eslint/schematics` | `^18.0.1` | Updated only
| `@angular-eslint/test-utils` | `^18.0.1` | Updated only
| `@angular-eslint/builder` | `^18.0.1` | Updated only
| `@angular-eslint/bundled-angular-compiler` | `^18.0.1` | Updated only



## 18.2.x

### `update-angular-cli-version-17-3-0`
**Version**: 18.2.0-beta.0

Update the @angular/cli package version to ~17.3.0.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=17.3.0` |

### 18.2.0-package-updates
**Version**: 18.2.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@angular-devkit/build-angular` | `~17.3.0` | Updated only
| `@angular-devkit/core` | `~17.3.0` | Updated only
| `@angular-devkit/schematics` | `~17.3.0` | Updated only
| `@angular/pwa` | `~17.3.0` | Updated only
| `@angular/ssr` | `~17.3.0` | Updated only
| `@schematics/angular` | `~17.3.0` | Updated only
| `@angular-devkit/architect` | `~0.1703.0` | Updated only
| `@angular-devkit/build-webpack` | `~0.1703.0` | Updated only
| `@angular/core` | `~17.3.0` | Added if not installed
| `@angular/material` | `~17.3.0` | Updated only
| `@angular/cdk` | `~17.3.0` | Updated only
| `ng-packagr` | `~17.3.0` | Updated only


### 18.2.0-angular-eslint-package-updates
**Version**: 18.2.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@angular-eslint/eslint-plugin` | `~17.3.0` | Updated only
| `@angular-eslint/eslint-plugin-template` | `~17.3.0` | Updated only
| `@angular-eslint/template-parser` | `~17.3.0` | Updated only



## 18.1.x

### `update-angular-cli-version-17-2-0`
**Version**: 18.1.0-beta.1

Update the @angular/cli package version to ~17.2.0.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=17.2.0` |

### `fix-target-defaults-for-webpack-browser`
**Version**: 18.1.1-beta.0

Ensure targetDefaults inputs for task hashing when '@nx/angular:webpack-browser' is used are correct for Module Federation.


### 18.1.0-jest-package-updates
**Version**: 18.1.0-beta.2


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `jest-preset-angular` | `~14.0.3` | Updated only


### 18.1.0-package-updates
**Version**: 18.1.0-beta.1


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@angular-devkit/build-angular` | `~17.2.0` | Updated only
| `@angular-devkit/core` | `~17.2.0` | Updated only
| `@angular-devkit/schematics` | `~17.2.0` | Updated only
| `@angular/pwa` | `~17.2.0` | Updated only
| `@angular/ssr` | `~17.2.0` | Updated only
| `@schematics/angular` | `~17.2.0` | Updated only
| `@angular-devkit/architect` | `~0.1702.0` | Updated only
| `@angular-devkit/build-webpack` | `~0.1702.0` | Updated only
| `@angular/core` | `~17.2.0` | Added if not installed
| `@angular/material` | `~17.2.0` | Updated only
| `@angular/cdk` | `~17.2.0` | Updated only
| `ng-packagr` | `~17.2.0` | Updated only



## 18.0.x

### `add-module-federation-env-var-to-target-defaults`
**Version**: 18.0.0-beta.0

Add NX_MF_DEV_SERVER_STATIC_REMOTES to inputs for task hashing when '@nx/angular:webpack-browser' is used for Module Federation.



## 17.3.x

### `update-angular-cli-version-17-1-0`
**Version**: 17.3.0-beta.10

Update the @angular/cli package version to ~17.1.0.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=17.1.0` |

### `add-browser-sync-dependency`
**Version**: 17.3.0-beta.10

Add 'browser-sync' as dev dependency when '@angular-devkit/build-angular:ssr-dev-server' or '@nx/angular:module-federation-dev-ssr' is used.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=17.1.0` |

### `add-autoprefixer-dependency`
**Version**: 17.3.0-beta.10

Add 'autoprefixer' as dev dependency when '@nx/angular:ng-packagr-lite' or '@nx/angular:package` is used.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=17.1.0` |

### 17.3.0-types-node-package-updates
**Version**: 17.3.0-beta.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@types/node` | `^18.16.9` | Updated only


### 17.3.0-package-updates
**Version**: 17.3.0-beta.10


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@angular-devkit/build-angular` | `~17.1.0` | Updated only
| `@angular-devkit/core` | `~17.1.0` | Updated only
| `@angular-devkit/schematics` | `~17.1.0` | Updated only
| `@angular/pwa` | `~17.1.0` | Updated only
| `@angular/ssr` | `~17.1.0` | Updated only
| `@schematics/angular` | `~17.1.0` | Updated only
| `@angular-devkit/architect` | `~0.1701.0` | Updated only
| `@angular-devkit/build-webpack` | `~0.1701.0` | Updated only
| `@angular/core` | `~17.1.0` | Added if not installed
| `@angular/material` | `~17.1.0` | Updated only
| `@angular/cdk` | `~17.1.0` | Updated only
| `ng-packagr` | `~17.1.0` | Updated only
| `zone.js` | `~0.14.3` | Updated only



## 17.2.x

### `rename-webpack-dev-server-executor`
**Version**: 17.2.0-beta.2

Rename '@nx/angular:webpack-dev-server' executor to '@nx/angular:dev-server'


### 17.2.0-ngrx-package-updates
**Version**: 17.2.0-beta.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@ngrx/store` | `~17.0.0` | Updated only



## 17.1.x

### `update-angular-cli-version-17-0-0`
**Version**: 17.1.0-beta.5

Update the @angular/cli package version to ~17.0.0.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=17.0.0` |

### `rename-browser-target-to-build-target`
**Version**: 17.1.0-beta.5

Rename 'browserTarget' to 'buildTarget'.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=17.0.0` |

### `replace-nguniversal-builders`
**Version**: 17.1.0-beta.5

Replace usages of '@nguniversal/builders' with '@angular-devkit/build-angular'.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=17.0.0` |

### `replace-nguniversal-engines`
**Version**: 17.1.0-beta.5

Replace usages of '@nguniversal/' packages with '@angular/ssr'.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=17.0.0` |

### `update-zone-js-deep-import`
**Version**: 17.1.0-beta.5

Replace the deep imports from 'zone.js/dist/zone' and 'zone.js/dist/zone-testing' with 'zone.js' and 'zone.js/testing'.

#### Requires

| Name | Version |
|------|---------|
 `@angular/core` | `>=17.0.0` |

### 17.1.0-package-updates
**Version**: 17.1.0-beta.5


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@angular-devkit/architect` | `~0.1700.0` | Updated only
| `@angular-devkit/build-angular` | `~17.0.0` | Updated only
| `@angular-devkit/build-webpack` | `~0.1700.0` | Updated only
| `@angular-devkit/core` | `~17.0.0` | Updated only
| `@angular-devkit/schematics` | `~17.0.0` | Updated only
| `@angular/pwa` | `~17.0.0` | Updated only
| `@angular/core` | `~17.0.0` | Added if not installed
| `@angular/material` | `~17.0.0` | Updated only
| `@angular/cdk` | `~17.0.0` | Updated only
| `@schematics/angular` | `~17.0.0` | Updated only
| `ng-packagr` | `~17.0.0` | Updated only
| `zone.js` | `~0.14.0` | Updated only


### 17.1.0-jest-package-updates
**Version**: 17.1.0-beta.5


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `jest-preset-angular` | `~13.1.3` | Updated only


### 17.1.0-angular-eslint-package-updates
**Version**: 17.1.0-beta.5


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@angular-eslint/eslint-plugin` | `~17.0.0` | Updated only
| `@angular-eslint/eslint-plugin-template` | `~17.0.0` | Updated only
| `@angular-eslint/template-parser` | `~17.0.0` | Updated only


### 17.1.3-jest-package-updates
**Version**: 17.1.3-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `jest-preset-angular` | `~13.1.4` | Updated only


