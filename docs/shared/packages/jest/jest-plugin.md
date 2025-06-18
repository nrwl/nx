---
title: Overview of the Nx Jest Plugin
description: The Nx Plugin for Jest contains executors and generators that support testing projects using Jest. This page also explains how to configure Jest on your Nx workspace.
---

# @nx/jest

[Jest](https://jestjs.io/) is an open source test runner created by Facebook. It has a lot of great features:

- Immersive watch mode for providing near instant feedback when developing tests.
- Snapshot testing for validating features.
- Great built-in reporter for printing out test results.

## Setting Up @nx/jest

### Installation

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/jest` version that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

In any Nx workspace, you can install `@nx/jest` by running the following command:

```shell {% skipRescope=true %}
nx add @nx/jest
```

This will install the correct version of `@nx/jest`.

#### Configuring @nx/jest/plugin for both E2E and Unit Tests

While Jest is most often used for unit tests, there are cases where it can be used for e2e tests as well as unit tests
within the same workspace. In this case, you can configure the `@nx/jest/plugin` twice for the different cases.

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/jest/plugin",
      "exclude": ["e2e/**/*"],
      "options": {
        "targetName": "test"
      }
    },
    {
      "plugin": "@nx/jest/plugin",
      "include": ["e2e/**/*"],
      "options": {
        "targetName": "e2e-local",
        "ciTargetName": "e2e-ci",
        "disableJestRuntime": false
      }
    }
  ]
}
```

If you experience slowness from `@nx/jest/plugin`, then set `disableJestRuntime` to `true` to skip creating the Jest runtime. By disabling the Jest runtime, Nx will use its own utilities to find `inputs`, `outputs`, and test files for [Atomized targets](/ci/features/split-e2e-tasks). This can reduce computation time by as much as 80%.

### Splitting E2E Tests

If Jest is used to run E2E tests, you can enable [splitting the tasks](/ci/features/split-e2e-tasks) by file to get
improved caching, distribution, and retrying flaky tests. Enable this Atomizer feature by providing a `ciTargetName`. This will create a
target with that name which can be used in CI to run the tests for each file in a distributed fashion.

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/jest/plugin",
      "include": ["e2e/**/*"],
      "options": {
        "targetName": "e2e-local",
        "ciTargetName": "e2e-ci"
      }
    }
  ]
}
```

### Customizing atomized unit/e2e tasks group name

By default, the atomized tasks group name is derived from the `ciTargetName`. For example, atomized tasks for the `e2e-ci` target will be grouped under the name "E2E (CI)" when displayed in Nx Cloud or `nx show project <project> --web` UI.
You can customize that name by explicitly providing the optional `ciGroupName` plugin option as such:

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/jest/plugin",
      "include": ["e2e/**/*"],
      "options": {
        "targetName": "e2e-local",
        "ciTargetName": "e2e-ci",
        "ciGroupname": "My E2E tests (CI)"
      }
    }
  ]
}
```

### How @nx/jest Infers Tasks

{% callout type="note" title="Inferred Tasks" %}
Since Nx 18, Nx plugins can infer tasks for your projects based on the configuration of different tools. You can read more about it at the [Inferred Tasks concept page](/concepts/inferred-tasks).
{% /callout %}

The `@nx/jest` plugin will create a task for any project that has an Jest configuration file present. Any of the following files will be recognized as an Jest configuration file:

- `jest.config.js`
- `jest.config.ts`
- `jest.config.mjs`
- `jest.config.mts`
- `jest.config.cjs`
- `jest.config.cts`

### View Inferred Tasks

To view inferred tasks for a project, open the [project details view](/concepts/inferred-tasks) in Nx Console or run `nx show project my-project --web` in the command line.

### @nx/jest Configuration

The `@nx/jest/plugin` is configured in the `plugins` array in `nx.json`.

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/jest/plugin",
      "options": {
        "targetName": "test"
      }
    }
  ]
}
```

- The `targetName` option controls the name of the inferred Jest tasks. The default name is `test`.

## Using Jest

### Generate a new project set up with Jest

By default, Nx will use Jest when creating applications and libraries.

```shell
nx g @nx/web:app apps/frontend
```

### Add Jest to a project

Run the `configuration` generator

```shell
nx g @nx/jest:configuration --project=<project-name>
```

> Hint: You can use the `--dry-run` flag to see what will be generated.

Replacing `<project-name>` with the name of the project you're wanting to add Jest too.

### Testing Applications

The recommended way to run/debug Jest tests via an editor

- [VSCode](https://marketplace.visualstudio.com/items?itemName=firsttris.vscode-jest-runner)
- [Webstorm](https://blog.jetbrains.com/webstorm/2018/10/testing-with-jest-in-webstorm/)

To run Jest tests via nx use

```shell
nx test frontend
```

### Testing Specific Files

Using a single positional argument or the `--testFile` flag will run all test files matching the regex. For more info check out the [Jest documentation](https://jestjs.io/docs/cli#jest-regexfortestfiles).

```shell
nx test frontend HomePage.tsx
# or
nx test frontend --testFile HomePage.tsx
```

### Watching for Changes

Using the `--watch` flag will run the tests whenever a file changes.

```shell
nx test frontend --watch
```

### Snapshot Testing

Jest has support for **Snapshot Testing**, a tool which simplifies validating data. Check out the [official Jest Documentation on Snapshot Testing](https://jestjs.io/docs/en/snapshot-testing).

Example of using snapshots:

```typescript
describe('SuperAwesomeFunction', () => {
  it('should return the correct data shape', () => {
    const actual = superAwesomeFunction();
    expect(actual).toMatchSnapshot();
  });
});
```

When using snapshots, you can update them with the `--updateSnapshot` flag, `-u` for short.

> By default, snapshots will be generated when there are not existing snapshots for the associated test.

```shell
nx test frontend -u
```

Snapshot files should be checked in with your code.

### Performance in CI

Typically, in CI it's recommended to use `nx affected -t test --parallel=[# CPUs] -- --runInBand` for the best performance.

This is because each [jest process creates a workers based on system resources](https://jestjs.io/docs/cli#--maxworkersnumstring), running multiple projects via nx and using jest workers will create too many process overall causing the system to run slower than desired. Using the `--runInBand` flag tells jest to run in a single process.

## Configurations

### Jest

Primary configurations for Jest will be via the `jest.config.ts` file that generated for your project. This file will extend the root `jest.preset.js` file. Learn more about [Jest configurations](https://jestjs.io/docs/configuration#options).

The root level `jest.config.ts` file configures [Jest multi project support](https://jestjs.io/docs/configuration#projects-arraystring--projectconfig).
This configuration allows editor/IDE integrations to pick up individual project's configurations rather than the one at the root.

{% tabs %}
{% tab label="Nx 18+" %}

The set of Jest projects within Nx workspaces tends to change. Instead of statically defining a list in `jest.config.ts`, Nx provides a utility function called `getJestProjectsAsync` which retrieves a list of paths to all the Jest config files from projects using the `@nx/jest:jest` executor or with tasks running the `jest` command.

You can manually add Jest projects not identified by the `getJestProjectsAsync` function by doing something like the following:

```typescript {% fileName="jest.config.ts" %}
import { getJestProjectsAsync } from '@nx/jest';

export default async () => ({
  projects: [
    ...(await getJestProjectsAsync()),
    '<rootDir>/path/to/jest.config.ts',
  ],
});
```

{% /tab %}

{% tab label="Nx < 18" %}

The set of Jest projects within Nx workspaces tends to change. Instead of statically defining a list in `jest.config.ts`, Nx provides a utility function called `getJestProjects` which queries for Jest configurations defined for targets which use the `@nx/jest:jest` executor.

You can add Jest projects which are not included in `getJestProjects()`, because they do not use the Nx Jest executor, by doing something like the following:

```typescript {% fileName="jest.config.ts" %}
import { getJestProjects } from '@nx/jest';

export default {
  projects: [...getJestProjects(), '<rootDir>/path/to/jest.config.ts'],
};
```

{% /tab %}
{% /tabs %}

### Nx

The Nx task options can be configured via the [project config file](/reference/project-configuration) or via the command line flags.

If you're using [inferred tasks](/concepts/inferred-tasks), or running Jest directly with the `nx:run-commands` executor, you can [provide the Jest args](/recipes/running-tasks/pass-args-to-commands) for the command you're running.

If you're using the `@nx/jest:jest` executor, you can provide [the options the executor accepts](/technologies/test-tools/jest/api/executors/jest#options).

### Code Coverage

Enable code coverage with the `--coverage` flag or by adding it to the executor options in the [project configuration file](/reference/project-configuration).

By default, coverage reports will be generated in the `coverage/` directory under projects name. i.e. `coverage/apps/frontend`. Modify this directory with the `--coverageDirectory` flag. Coverage reporters can also be customized with the `--coverageReporters` flag.

> `coverageDirectory` and `coverageReporters` are configurable via the project configuration file as well.

### Global setup/teardown with nx libraries

In order to use Jest's global setup/teardown functions that reference nx libraries, you'll need to register the TS path for jest to resolve the libraries.
Nx provides a helper function that you can import within your setup/teardown file.

```typescript {% fileName="global-setup.ts" %}
import { registerTsProject } from '@nx/js/src/internal';
const cleanupRegisteredPaths = registerTsProject('./tsconfig.base.json');

import { yourFancyFunction } from '@some-org/my-util-library';
export default async function () {
  yourFancyFunction();

  // make sure to run the clean up!
  cleanupRegisteredPaths();
}
```

If you're using `@swc/jest` and a global setup/teardown file, you have to set the `noInterop: false` and use dynamic imports within the setup function:

{% tabs %}
{% tab label="Using the config from .swcrc" %}

```typescript {% fileName="apps/<your-project>/jest.config.ts" %}
/* eslint-disable */
import { readFileSync } from 'fs';

// Reading the SWC compilation config and remove the "exclude"
// for the test files to be compiled by SWC
const { exclude: _, ...swcJestConfig } = JSON.parse(
  readFileSync(`${__dirname}/.swcrc`, 'utf-8')
);

// disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves.
// If we do not disable this, SWC Core will read .swcrc and won't transform our test files due to "exclude"
if (swcJestConfig.swcrc === undefined) {
  swcJestConfig.swcrc = false;
}

// jest needs EsModule Interop to find the default exported function
swcJestConfig.module.noInterop = false;

export default {
  globalSetup: '<rootDir>/src/global-setup-swc.ts',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  // other settings
};
```

{% /tab %}

{% tab label="Using the config from .spec.swcrc" %}

```typescript {% fileName="apps/<your-project>/jest.config.ts" %}
/* eslint-disable */
import { readFileSync } from 'fs';

// Reading the SWC compilation config for the spec files
const swcJestConfig = JSON.parse(
  readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8')
);

// Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
swcJestConfig.swcrc = false;

export default {
  globalSetup: '<rootDir>/src/global-setup-swc.ts',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  // other settings
};
```

{% /tab %}
{% /tabs %}

```typescript {% fileName="global-setup-swc.ts" %}
import { registerTsProject } from '@nx/js/src/internal';
const cleanupRegisteredPaths = registerTsProject('./tsconfig.base.json');

export default async function () {
  // swc will hoist all imports, and we need to make sure the register happens first
  // so we import all nx project alias within the setup function first.
  const { yourFancyFunction } = await import('@some-org/my-util-library');

  yourFancyFunction();

  // make sure to run the clean up!
  cleanupRegisteredPaths();
}
```

## More Documentation

- [Jest Docs](https://jestjs.io/)
