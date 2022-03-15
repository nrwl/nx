# Jest Plugin

![Jest logo](/shared/jest-logo.png)

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

Typically, in CI it's recommended to use `nx affected --target=test --parallel=[# CPUs] -- --runInBand` for the best performance.

This is because each [jest process creates a workers based on system resources](https://jestjs.io/docs/cli#--maxworkersnumstring), running multiple projects via nx and using jest workers will create too many process overall causing the system to run slower than desired. Using the `--runInBand` flag tells jest to run in a single process.

## Configurations

### Jest

Primary configurations for Jest will be via the `jest.config.js` file that generated for your project. This file will extend the root `jest.config.js` file. Learn more about [Jest configurations](https://jestjs.io/docs/configuration#options).

### Nx

Nx Jest Plugin options can be configured via the [project config file](/configuration/projectjson) or via the [command line flags](/jest/jest).

> Hint: Use `--help` to see all available options
>
> ```shell
> nx test <project-name> --help
> ```

### Code Coverage

Enable code coverage with the `--coverage` flag or by adding it to the executor options in the [project configuration file](/configuration/projectjson).

By default, coverage reports will be generated in the `coverage/` directory under projects name. i.e. `coverage/apps/frontend`. Modify this directory with the `--coverageDirectory` flag. Coverage reporters can also be customized with the `--coverageReporters` flag.

> `coverageDirectory` and `coverageReporters` are configurable via the project configuration file as well.

## Debugging Failing Tests

If your code editor doesn't provide a way to debug your tests, you can leverage the Chrome DevTools to debug your tests with the `--inspect-brk` flag for node.

```shell
node --inspect-brk ./node_modules/@nrwl/cli/bin/nx test <project-name>
```

Enter [chrome://inspect](chrome://inspect) in Chrome address bar and inspect the target to attach to the node process. Visit the official [Jest documentation](https://jestjs.io/docs/en/troubleshooting#tests-are-failing-and-you-don-t-know-why) to find out more.

## More Documentation

- [Jest Docs](https://jestjs.io/)
- [@nrwl/jest options](/jest/jest)
