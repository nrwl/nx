[Jest](https://jestjs.io/) is an open source test runner created by Facebook. It has a lot of great features:

- Immersive watch mode for providing near instant feedback when developing tests.
- Snapshot testing for validating features.
- Great built-in reporter for printing out test results.

## Setting up Jest

By default, Nx will use Jest when creating applications and libraries.

```shell
nx g @nx/web:app frontend
```

### Adding Jest to an Existing Project

Add Jest to a project using the `jest-project` generator from `@nx/jest`.

First, install `@nx/jest`, if not already installed using your preferred package manager.

```shell
npm install --save-dev @nx/jest
```

```shell
yarn add --dev @nx/jest
```

Once installed, run the `jest-project` generator

```shell
nx g @nx/jest:jest-project --project=<project-name>
```

> Hint: You can use the `--dry-run` flag to see what will be generated.

Replacing `<project-name>` with the name of the project you're wanting to add Jest too.

## Using Jest

### Testing Applications

The recommended way to run/debug Jest tests via an editor

- [VSCode](https://marketplace.visualstudio.com/items?itemName=firsttris.vscode-jest-runner)
- [Webstorm](https://blog.jetbrains.com/webstorm/2018/10/testing-with-jest-in-webstorm/)

To run Jest tests via nx use

```shell
nx test frontend
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
describe('SuperAwesomFunction', () => {
  it('should return the correct data shape', () => {
    const actual = superAwesomFunction();
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

The set of Jest projects within Nx workspaces tends to change. Instead of statically defining a list in `jest.config.ts`, Nx provides a utility function called `getJestProjects` which queries for Jest configurations defined for targets which use the `@nx/jest:jest` executor.

You can add Jest projects which are not included in `getJestProjects()`, because they do not use the Nx Jest executor, by doing something like the following:

```typescript {% fileName="jest.config.ts"}
import { getJestProjects } from '@nx/jest';

export default {
  projects: [...getJestProjects(), '<rootDir>/path/to/jest.config.ts'],
};
```

### Nx

Nx Jest Plugin options can be configured via the [project config file](/reference/project-configuration) or via the [command line flags](/packages/jest).

> Hint: Use `--help` to see all available options
>
> ```shell
> nx test <project-name> --help
> ```

### Code Coverage

Enable code coverage with the `--coverage` flag or by adding it to the executor options in the [project configuration file](/reference/project-configuration).

By default, coverage reports will be generated in the `coverage/` directory under projects name. i.e. `coverage/apps/frontend`. Modify this directory with the `--coverageDirectory` flag. Coverage reporters can also be customized with the `--coverageReporters` flag.

> `coverageDirectory` and `coverageReporters` are configurable via the project configuration file as well.

### Global setup/teardown with nx libraries

In order to use Jest's global setup/teardown functions that reference nx libraries, you'll need to register the TS path for jest to resolve the libraries.
Nx provides a helper function that you can import within your setup/teardown file.

```typescript {% fileName="global-setup.ts" %}
import { registerTsProject } from '@nx/js/src/internal';
const cleanupRegisteredPaths = registerTsProject('.', 'tsconfig.base.json');

import { yourFancyFunction } from '@some-org/my-util-library';
export default async function () {
  yourFancyFunction();
}
// make sure to run the clean up!
cleanupRegisteredPaths();
```

{% callout type="note" title="@swc/jest & global scripts" %}
When using @swc/jest and a global setup/teardown file,
You have to set the `noInterop: false` and use dynamic imports within the setup function

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

```typescript {% fileName="global-setup-swc.ts" %}
import { registerTsProject } from '@nx/js/src/internal';
const cleanupRegisteredPaths = registerTsProject('.', 'tsconfig.base.json');

export default async function () {
  // swc will hoist all imports, and we need to make sure the register happens first
  // so we import all nx project alias within the setup function first.
  const { yourFancyFunction } = await import('@some-org/my-util-library');

  yourFancyFunction();

  // make sure to run the clean up!
  cleanupRegisteredPaths();
}
```

{% /callout %}

## More Documentation

- [Jest Docs](https://jestjs.io/)
- [@nx/jest options](/packages/jest)
