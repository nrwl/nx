The @nx/jest plugin provides various migrations to help you migrate to newer versions of jest projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 23.0.x

### `update-snapshot-guide-link`
**Version**: 23.0.0-beta.6

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




## 20.0.x

### `replace-getJestProjects-with-getJestProjectsAsync`
**Version**: 20.0.0-beta.5

Replace usage of `getJestProjects` with `getJestProjectsAsync`.

#### Replace Usage of `getJestProjects` with `getJestProjectsAsync`

Replaces the usage of the deprecated `getJestProjects` function with the `getJestProjectsAsync` function.

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



