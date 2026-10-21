For an overview of the plugin and setup instructions, see the [@nx/jest introduction](/docs/technologies/test-tools/jest/introduction).

The @nx/jest plugin provides various migrations to help you migrate to newer versions of jest projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 23.1.x

### `set-ts-jest-isolated-modules`
**Version**: 23.1.0-beta.4

Set `isolatedModules: true` in `tsconfig.spec.json` for ts-jest projects on TypeScript < 6 (ts-jest 29.2+ forces `moduleResolution: node10` on the CommonJS path, which ignores package `exports` maps and breaks resolution of exports-only workspace libraries), then verify the workspace still typechecks and remedy any failures the change surfaced.

#### Requires

| Name | Version |
|------|---------|
 `ts-jest` | `>=29.2.0` |
#### Set isolatedModules for ts-jest below TypeScript 6

The jest 30 path of `@nx/jest` bumps ts-jest to 29.4.x.
On the CommonJS jest path, ts-jest 29.2+ uses `moduleResolution: node10` when `bundler` is invalid alongside the forced `module: commonjs`, which is the case below TypeScript 6.
`node10` does not read package `exports` maps, so a workspace library that exposes types only through `exports` fails to resolve during the ts-jest type check:

```text
error TS2307: Cannot find module '@my-org/some-lib' or its corresponding type declarations.
```

The migration sets `isolatedModules: true` in each affected `tsconfig.spec.json`, so ts-jest transpiles each file independently and skips the cross-file type resolution that was failing.
This matches the `isolatedModules: true` that fresh ts-solution workspaces already set in `tsconfig.base.json`.
Type checking stays on each project's dedicated typecheck target.

The migration runs only below TypeScript 6, in ts-solution workspaces that do not already enable `isolatedModules`.
TypeScript 6 and above resolves `exports` under `bundler` with `commonjs`, so those workspaces are left unchanged.

#### Sample code changes

##### Before

```json title="tsconfig.spec.json"
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["jest", "node"]
  }
}
```

##### After

```json title="tsconfig.spec.json" {4}
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "isolatedModules": true,
    "types": ["jest", "node"]
  }
}
```

#### Verifying the workspace

After the migration runs, verify the workspace still typechecks and fix anything `isolatedModules` surfaced:

```bash
nx run-many -t typecheck
```

`isolatedModules` can fail typecheck (TS1205 - re-exporting a type needs `export type`; TS2748 - const enum access) or break a project's tests at runtime even when typecheck passes. The cause is a package that re-exports a value through both `module.exports` and an ESM `export` (for example napi bindings exposing a `const enum`); per-file transpilation cannot preserve it, and consumers of that const enum break too. To fix a broken project, remove `isolatedModules` from its `tsconfig.spec.json`; if that brings back the `TS2307: Cannot find module` error this migration was added to prevent, that project needs `isolatedModules`, so fix the source instead.



### 23.1.0-ts-jest-package-updates
**Version**: 23.1.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `ts-jest` | `^29.4.7` | Updated only


### 23.1.0-jest-preset-angular-package-updates
**Version**: 23.1.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `jest-preset-angular` | `~17.0.0` | Updated only



## 23.0.x

### `update-snapshot-guide-link`
**Version**: 23.0.0-beta.10

Update the Jest snapshot guide link in `.snap` files from the legacy `https://goo.gl/fbAQLP` URL to `https://jestjs.io/docs/snapshot-testing`, which Jest v30 now requires.

#### Requires

| Name | Version |
|------|---------|
 `jest` | `>=30.0.0` |
#### Update Jest Snapshot Guide Link

Updates the snapshot guide link at the top of every `.snap` file from the legacy `https://goo.gl/fbAQLP` to `https://jestjs.io/docs/snapshot-testing`. Jest v30 errors out at test setup time if it sees the old link, so existing snapshot files need to be rewritten before tests can run. Read more at the [Jest v30 migration notes](https://jestjs.io/docs/upgrading-to-jest30).

#### Examples

##### Before

```text title="apps/myapp/src/__snapshots__/example.spec.ts.snap"
// Jest Snapshot v1, https://goo.gl/fbAQLP

exports[`renders correctly 1`] = `"hello"`;
```

##### After

```text title="apps/myapp/src/__snapshots__/example.spec.ts.snap"
// Jest Snapshot v1, https://jestjs.io/docs/snapshot-testing

exports[`renders correctly 1`] = `"hello"`;
```



### `rewrite-jest-internal-subpath-imports`
**Version**: 23.0.0-beta.16

Rewrites `@nx/jest/src/*` subpath imports now that the `./src/*` subpath is no longer exposed by `@nx/jest`'s exports map. Named imports/exports of public symbols are routed to `@nx/jest` and the rest to the new `@nx/jest/internal` entry; `require`, dynamic `import` and `jest.mock` calls reference the whole module and are routed to `@nx/jest/internal`.


### `rewrite-jest-project-generator`
**Version**: 23.0.0-beta.16

Replaces the removed `jestProjectGenerator` export from `@nx/jest` with its replacement `configurationGenerator`.


### `migrate-jest-executor-setup-file`
**Version**: 23.0.0-beta.22

Migrate the deprecated `setupFile` option of the `@nx/jest:jest` executor: push the file path into `setupFilesAfterEnv` in the project's Jest config and remove the option from `project.json` and `nx.json` target defaults.

#### Migrate `setupFile` Option to `setupFilesAfterEnv`

Migrates the previously deprecated `setupFile` option of the `@nx/jest:jest` executor. The setup file path is appended to the `setupFilesAfterEnv` array in the project's Jest configuration (using `<rootDir>/...` form), and the deprecated option is removed from `project.json` and `nx.json` target defaults.

If the setup file cannot be migrated automatically (e.g. the Jest configuration cannot be parsed because it exports a factory function or assigns `setupFilesAfterEnv` to a non-array value, it sets `rootDir` to a non-literal value, or the target shares a Jest configuration with another target using a different setup file), the deprecated option is still removed and a warning is logged listing the affected targets so the setup file path can be moved manually.

#### Examples

Push the setup file into the project's Jest configuration and remove the option from `project.json`:

##### Before

```json title="apps/myapp/project.json" {7}
{
  "targets": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "apps/myapp/jest.config.ts",
        "setupFile": "apps/myapp/src/test-setup.ts"
      }
    }
  }
}
```

```ts title="apps/myapp/jest.config.ts"
export default {
  displayName: 'myapp',
};
```

##### After

```json title="apps/myapp/project.json"
{
  "targets": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "apps/myapp/jest.config.ts"
      }
    }
  }
}
```

```ts title="apps/myapp/jest.config.ts"
export default {
  displayName: 'myapp',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
};
```

Append to an existing `setupFilesAfterEnv` array:

##### Before

```json title="apps/myapp/project.json" {7}
{
  "targets": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "apps/myapp/jest.config.ts",
        "setupFile": "apps/myapp/src/test-setup.ts"
      }
    }
  }
}
```

```ts title="apps/myapp/jest.config.ts"
export default {
  displayName: 'myapp',
  setupFilesAfterEnv: ['<rootDir>/src/existing-setup.ts'],
};
```

##### After

```json title="apps/myapp/project.json"
{
  "targets": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "apps/myapp/jest.config.ts"
      }
    }
  }
}
```

```ts title="apps/myapp/jest.config.ts"
export default {
  displayName: 'myapp',
  setupFilesAfterEnv: [
    '<rootDir>/src/existing-setup.ts',
    '<rootDir>/src/test-setup.ts',
  ],
};
```

Remove the option from a target default using the `@nx/jest:jest` executor:

##### Before

```json title="nx.json" {7}
{
  "targetDefaults": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "{projectRoot}/jest.config.ts",
        "setupFile": "{projectRoot}/src/test-setup.ts"
      }
    }
  }
}
```

##### After

```json title="nx.json"
{
  "targetDefaults": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "{projectRoot}/jest.config.ts"
      }
    }
  }
}
```

Per-project paths don't make sense as workspace defaults, so the option is removed from `nx.json`. Base targets that inherited it don't lose their setup file: the inherited path is expanded and added to `setupFilesAfterEnv` in each project's Jest config, the same as if the target had declared the option itself. A warning is logged noting the removal from `nx.json`.

Remove the option from a target default entry matching on the `@nx/jest:jest` executor:

##### Before

```json title="nx.json" {6}
{
  "targetDefaults": {
    "@nx/jest:jest": {
      "options": {
        "jestConfig": "{projectRoot}/jest.config.ts",
        "setupFile": "{projectRoot}/src/test-setup.ts"
      }
    }
  }
}
```

##### After

```json title="nx.json"
{
  "targetDefaults": {
    "@nx/jest:jest": {
      "options": {
        "jestConfig": "{projectRoot}/jest.config.ts"
      }
    }
  }
}
```



### `migrate-jest-configuration-skip-setup-file`
**Version**: 23.0.0-beta.22

Migrate the deprecated `skipSetupFile` option of the `@nx/jest:configuration` generator stored as a default in `nx.json` or per-project `project.json` to `setupFile: 'none'` (when `true`) or remove it (when `false`).

#### Migrate `skipSetupFile` Generator Default to `setupFile`

Migrates the previously deprecated `skipSetupFile` option of the `@nx/jest:configuration` generator. When set as a default in `nx.json` `generators` or per-project `project.json` `generators`, it is rewritten as follows:

- `skipSetupFile: true` becomes `setupFile: 'none'` (preserving the original behavior of skipping the setup file). Existing `setupFile` values are left untouched.
- `skipSetupFile: false` is dropped (it was a no-op).

Both flat (`@nx/jest:configuration`) and nested (`@nx/jest` -> `configuration`) forms are handled.

#### Examples

Rewrite a `nx.json` generator default:

##### Before

```json title="nx.json" {4}
{
  "generators": {
    "@nx/jest:configuration": {
      "skipSetupFile": true
    }
  }
}
```

##### After

```json title="nx.json"
{
  "generators": {
    "@nx/jest:configuration": {
      "setupFile": "none"
    }
  }
}
```

Drop the option when set to `false`:

##### Before

```json title="nx.json" {4}
{
  "generators": {
    "@nx/jest:configuration": {
      "skipSetupFile": false,
      "testEnvironment": "jsdom"
    }
  }
}
```

##### After

```json title="nx.json"
{
  "generators": {
    "@nx/jest:configuration": {
      "testEnvironment": "jsdom"
    }
  }
}
```

Rewrite a per-project generator default:

##### Before

```json title="apps/myapp/project.json" {4}
{
  "generators": {
    "@nx/jest:configuration": {
      "skipSetupFile": true
    }
  }
}
```

##### After

```json title="apps/myapp/project.json"
{
  "generators": {
    "@nx/jest:configuration": {
      "setupFile": "none"
    }
  }
}
```

The nested form (`@nx/jest` -> `configuration`) is handled the same way.



### `update-23-0-0-migrate-create-nodes-v2-import`
**Version**: 23.0.0-beta.24

Rename imports of `createNodesV2` from `@nx/jest/plugin` to the canonical `createNodes` export.

#### Rename `createNodesV2` imports to `createNodes`

`@nx/jest` renamed its primary inferred-plugin export from `createNodesV2` to `createNodes`. The `createNodesV2` name is preserved as a deprecated alias for now, but new code should use `createNodes`.

This migration scans every `.ts`, `.tsx`, `.cts`, and `.mts` file in your workspace and rewrites named imports and re-exports of `createNodesV2` from `@nx/jest/plugin` to `createNodes`.

#### Sample Code Changes

##### Before

```ts
import { createNodesV2 } from '@nx/jest/plugin';
```

##### After

```ts
import { createNodes } from '@nx/jest/plugin';
```

Aliases are preserved (`createNodesV2 as cn` becomes `createNodes as cn`), and if a file already imports both names (`{ createNodes, createNodesV2 }`) the redundant binding is dropped.

#### What is not rewritten

Only static `import`/`export` named bindings from `@nx/jest/plugin` are rewritten. Namespace imports, dynamic `import(...)`, `require(...)` destructuring, and property access such as `plugin.createNodesV2` are left untouched — they keep working through the `createNodesV2` runtime alias. Update those by hand if you want to drop the deprecated name everywhere.



### 23.0.0-pin-jest-30-3-for-rn-compat-package-updates
**Version**: 23.0.0-beta.9


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `jest` | `~30.3.0` | Updated only
| `babel-jest` | `~30.3.0` | Updated only
| `@types/jest` | `~30.0.0` | Updated only



## 22.3.x

### `replace-removed-matcher-aliases-v22-3`
**Version**: 22.3.2-beta.0

Replace removed matcher aliases in Jest v30 with their corresponding matcher

#### Requires

| Name | Version |
|------|---------|
 `jest` | `>=30.0.0` |
#### Replace Removed Matcher Aliases

Replaces removed Jest matcher aliases in test files with their corresponding matchers to align with Jest v30 changes. Read more at the [Jest v30 migration notes](https://jestjs.io/docs/upgrading-to-jest30#jest-expect--matchers).

#### Examples

##### Before

```typescript title="apps/myapp/src/app.spec.ts"
describe('test', () => {
  it('should pass', async () => {
    expect(mockFn).toBeCalled();
    expect(mockFn).toBeCalledTimes(1);
    expect(mockFn).toBeCalledWith(arg);
    expect(mockFn).lastCalledWith(arg);
    expect(mockFn).nthCalledWith(1, arg);
    expect(mockFn).toReturn();
    expect(mockFn).toReturnTimes(1);
    expect(mockFn).toReturnWith(value);
    expect(mockFn).lastReturnedWith(value);
    expect(mockFn).nthReturnedWith(1, value);
    expect(() => someFn()).toThrowError();
    expect(() => someFn()).not.toThrowError();
    await expect(someAsyncFn()).rejects.toThrowError();
    await expect(someAsyncFn()).resolves.not.toThrowError();
  });
});
```

##### After

```typescript title="apps/myapp/src/app.spec.ts"
describe('test', () => {
  it('should pass', async () => {
    expect(mockFn).toHaveBeenCalled();
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith(arg);
    expect(mockFn).toHaveBeenLastCalledWith(arg);
    expect(mockFn).toHaveBeenNthCalledWith(1, arg);
    expect(mockFn).toHaveReturned();
    expect(mockFn).toHaveReturnedTimes(1);
    expect(mockFn).toHaveReturnedWith(value);
    expect(mockFn).toHaveLastReturnedWith(value);
    expect(mockFn).toHaveNthReturnedWith(1, value);
    expect(() => someFn()).toThrow();
    expect(() => someFn()).not.toThrow();
    await expect(someAsyncFn()).rejects.toThrow();
    await expect(someAsyncFn()).resolves.not.toThrow();
  });
});
```



### 22.3.0-package-updates
**Version**: 22.3.0-beta.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `jest` | `^30.0.0` | Updated only
| `@types/jest` | `^30.0.0` | Updated only
| `expect` | `^30.0.0` | Updated only
| `@jest/globals` | `^30.0.0` | Updated only
| `jest-jasmine2` | `^30.0.0` | Updated only
| `jest-environment-jsdom` | `^30.0.0` | Updated only
| `jest-util` | `^30.0.0` | Updated only
| `babel-jest` | `^30.0.0` | Updated only
| `@swc/jest` | `~0.2.38` | Updated only


### 22.3.0-jest-preset-angular-package-updates
**Version**: 22.3.0-beta.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `jest-preset-angular` | `~16.0.0` | Updated only



## 22.2.x

### `convert-jest-config-to-cjs`
**Version**: 22.2.0-beta.2

Convert jest.config.ts files from ESM to CJS syntax (export default -> module.exports, import -> require) for projects using CommonJS resolution to ensure correct loading under Node.js type-stripping.

#### Convert Jest Config to CJS

Converts `jest.config.ts` files to `jest.config.cts`. This is needed because Node.js type-stripping in newer versions (22+, 24+) can cause issues with ESM syntax in `.ts` files when the project is configured for CommonJS.

This migration only runs if `@nx/jest/plugin` is registered in `nx.json`.

#### Examples

##### Before

```typescript title="jest.config.ts"
import { foo } from 'bar';
import baz from 'qux';

export default {
  displayName: 'myapp',
  preset: foo,
  transform: baz,
};
```

##### After

```typescript title="jest.config.cts"
const { foo } = require('bar');
const baz = require('qux').default ?? require('qux');

module.exports = {
  displayName: 'myapp',
  preset: foo,
  transform: baz,
};
```




## 21.3.x

### `rename-test-path-pattern`
**Version**: 21.3.0-beta.3

Rename the CLI option `testPathPattern` to `testPathPatterns`.

#### Rename `testPathPattern` to `testPathPatterns`

Renames the `testPathPattern` option to `testPathPatterns` in the `@nx/jest:jest` executor configuration to align with Jest v30 CLI changes. Read more at the [Jest v30 migration notes](https://jestjs.io/docs/upgrading-to-jest30#--testpathpattern-was-renamed-to---testpathpatterns).

#### Examples

Rename the option in project configuration:

##### Before

```json title="apps/myapp/project.json" {7}
{
  "targets": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "apps/myapp/jest.config.ts",
        "testPathPattern": "some-regex"
      }
    }
  }
}
```

##### After

```json title="apps/myapp/project.json" {7}
{
  "targets": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "apps/myapp/jest.config.ts",
        "testPathPatterns": "some-regex"
      }
    }
  }
}
```

Rename the option in project configuration with configurations:

##### Before

```json title="apps/myapp/project.json" {7,10,11}
{
  "targets": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "apps/myapp/jest.config.ts",
        "testPathPattern": "some-regex"
      },
      "configurations": {
        "development": { "testPathPattern": "regex-dev" },
        "production": { "testPathPattern": "regex-prod" }
      }
    }
  }
}
```

##### After

```json title="apps/myapp/project.json" {7,10,11}
{
  "targets": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "apps/myapp/jest.config.ts",
        "testPathPatterns": "some-regex"
      },
      "configurations": {
        "development": { "testPathPatterns": "regex-dev" },
        "production": { "testPathPatterns": "regex-prod" }
      }
    }
  }
}
```

Rename the option in a target default using the `@nx/jest:jest` executor:

##### Before

```json title="nx.json" {7}
{
  "targetDefaults": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "{projectRoot}/jest.config.ts",
        "testPathPattern": "some-regex"
      }
    }
  }
}
```

##### After

```json title="nx.json" {7}
{
  "targetDefaults": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "{projectRoot}/jest.config.ts",
        "testPathPatterns": "some-regex"
      }
    }
  }
}
```

Rename the option in a target default using the `@nx/jest:jest` executor as the key:

##### Before

```json title="nx.json" {6}
{
  "targetDefaults": {
    "@nx/jest:jest": {
      "options": {
        "jestConfig": "{projectRoot}/jest.config.ts",
        "testPathPattern": "some-regex"
      }
    }
  }
}
```

##### After

```json title="nx.json" {6}
{
  "targetDefaults": {
    "@nx/jest:jest": {
      "options": {
        "jestConfig": "{projectRoot}/jest.config.ts",
        "testPathPatterns": "some-regex"
      }
    }
  }
}
```



### `replace-removed-matcher-aliases`
**Version**: 21.3.0-beta.3

Replace removed matcher aliases in Jest v30 with their corresponding matcher

#### Requires

| Name | Version |
|------|---------|
 `jest` | `>=30.0.0` |
#### Replace Removed Matcher Aliases

Replaces removed Jest matcher aliases in test files with their corresponding matchers to align with Jest v30 changes. Read more at the [Jest v30 migration notes](https://jestjs.io/docs/upgrading-to-jest30#jest-expect--matchers).

#### Examples

##### Before

```typescript title="apps/myapp/src/app.spec.ts"
describe('test', () => {
  it('should pass', async () => {
    expect(mockFn).toBeCalled();
    expect(mockFn).toBeCalledTimes(1);
    expect(mockFn).toBeCalledWith(arg);
    expect(mockFn).lastCalledWith(arg);
    expect(mockFn).nthCalledWith(1, arg);
    expect(mockFn).toReturn();
    expect(mockFn).toReturnTimes(1);
    expect(mockFn).toReturnWith(value);
    expect(mockFn).lastReturnedWith(value);
    expect(mockFn).nthReturnedWith(1, value);
    expect(() => someFn()).toThrowError();
    expect(() => someFn()).not.toThrowError();
    await expect(someAsyncFn()).rejects.toThrowError();
    await expect(someAsyncFn()).resolves.not.toThrowError();
  });
});
```

##### After

```typescript title="apps/myapp/src/app.spec.ts"
describe('test', () => {
  it('should pass', async () => {
    expect(mockFn).toHaveBeenCalled();
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith(arg);
    expect(mockFn).toHaveBeenLastCalledWith(arg);
    expect(mockFn).toHaveBeenNthCalledWith(1, arg);
    expect(mockFn).toHaveReturned();
    expect(mockFn).toHaveReturnedTimes(1);
    expect(mockFn).toHaveReturnedWith(value);
    expect(mockFn).toHaveLastReturnedWith(value);
    expect(mockFn).toHaveNthReturnedWith(1, value);
    expect(() => someFn()).toThrow();
    expect(() => someFn()).not.toThrow();
    await expect(someAsyncFn()).rejects.toThrow();
    await expect(someAsyncFn()).resolves.not.toThrow();
  });
});
```



### 21.3.0-package-updates
**Version**: 21.3.0-beta.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `jest` | `~30.0.0` | Updated only
| `@types/jest` | `~30.0.0` | Updated only
| `expect` | `~30.0.0` | Updated only
| `@jest/globals` | `~30.0.0` | Updated only
| `jest-jasmine2` | `~30.0.0` | Updated only
| `jest-environment-jsdom` | `~30.0.0` | Updated only
| `babel-jest` | `~30.0.0` | Updated only
| `@swc/jest` | `~0.2.38` | Updated only


### 21.3.3-package-updates
**Version**: 21.3.3-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `ts-jest` | `~29.4.0` | Updated only


### 21.3.3-jest-util-package-updates
**Version**: 21.3.3-beta.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `jest-util` | `~30.0.0` | Updated only



## 21.0.x

### `replace-getJestProjects-with-getJestProjectsAsync-v21`
**Version**: 21.0.0-beta.9

Replace usage of `getJestProjects` with `getJestProjectsAsync`.

#### Replace Usage of `getJestProjects` with `getJestProjectsAsync`

Replaces the usage of the removed `getJestProjects` function with the `getJestProjectsAsync` function.

#### Sample Code Changes

##### Before

```ts title="jest.config.ts"
import { getJestProjects } from '@nx/jest';

export default {
  projects: getJestProjects(),
};
```

##### After

```ts title="jest.config.ts"
import { getJestProjectsAsync } from '@nx/jest';

export default async () => ({
  projects: await getJestProjectsAsync(),
});
```



### `remove-tsconfig-option-from-jest-executor`
**Version**: 21.0.0-beta.10

Remove the previously deprecated and unused `tsConfig` option from the `@nx/jest:jest` executor.

#### Remove `tsConfig` Option from Jest Executor

Removes the previously deprecated and unused `tsConfig` option from the `@nx/jest:jest` executor configuration in all projects.

#### Examples

Remove the option from the project configuration:

##### Before

```json title="apps/myapp/project.json" {7}
{
  "targets": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "apps/myapp/jest.config.ts",
        "tsConfig": "apps/myapp/tsconfig.spec.json"
      }
    }
  }
}
```

##### After

```json title="apps/myapp/project.json"
{
  "targets": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "apps/myapp/jest.config.ts"
      }
    }
  }
}
```

Remove the option from a target default using the `@nx/jest:jest` executor:

##### Before

```json title="nx.json" {7}
{
  "targetDefaults": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "{projectRoot}/jest.config.ts",
        "tsConfig": "{projectRoot}/tsconfig.spec.json"
      }
    }
  }
}
```

##### After

```json title="nx.json"
{
  "targetDefaults": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "{projectRoot}/jest.config.ts"
      }
    }
  }
}
```

Remove the option from a target default using the `@nx/jest:jest` executor as the key:

##### Before

```json title="nx.json" {6}
{
  "targetDefaults": {
    "@nx/jest:jest": {
      "options": {
        "jestConfig": "{projectRoot}/jest.config.ts",
        "tsConfig": "{projectRoot}/tsconfig.spec.json"
      }
    }
  }
}
```

##### After

```json title="nx.json"
{
  "targetDefaults": {
    "@nx/jest:jest": {
      "options": {
        "jestConfig": "{projectRoot}/jest.config.ts"
      }
    }
  }
}
```



