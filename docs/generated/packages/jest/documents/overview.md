[Jest](https://jestjs.io/) is an open source test runner created by Facebook. It has a lot of great features:

- Immersive watch mode for providing near instant feedback when developing tests.
- Snapshot testing for validating features.
- Great built-in reporter for printing out test results.

## Setting up Jest

By default, Nx will use Jest when creating applications and libraries.

```shell
nx g @nrwl/web:app frontend
```

### Adding Jest to an Existing Project

Add Jest to a project using the `jest-project` generator from `@nrwl/jest`.

First, install `@nrwl/jest`, if not already installed using your preferred package manager.

```shell
npm install --save-dev @nrwl/jest
```

```shell
yarn add --dev @nrwl/jest
```

Once installed, run the `jest-project` generator

```shell
nx g @nrwl/jest:jest-project --project=<project-name>
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

The set of Jest projects within Nx workspaces tends to change. Instead of statically defining a list in `jest.config.ts`, Nx provides a utility function called `getJestProjects` which queries for Jest configurations defined for targets which use the `@nrwl/jest:jest` executor.

You can add Jest projects which are not included in `getJestProjects()`, because they do not use the Nx Jest executor, by doing something like the following:

```typescript {% fileName="jest.config.ts"}
import { getJestProjects } from '@nrwl/jest';

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
import { registerTsProject } from 'nx/src/plugins/js/utils/register';
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
You'll have to set the global setup/teardown file to be transformed with ts-jest.
For example, if your files are named `global-setup.ts` and `global-teardown.ts`,
then you would need to add to your _project level `jest.config.ts`_ a new entry in the transformers object

```typescript {% fileName="apps/<your-project>/jest.config.ts" %}
export default {
  transform: {
    'global-(setup|teardown).ts': 'ts-jest',
    // resest of the transformers
  },
};
```

{% /callout %}

## More Documentation

- [Jest Docs](https://jestjs.io/)
- [@nrwl/jest options](/packages/jest)
