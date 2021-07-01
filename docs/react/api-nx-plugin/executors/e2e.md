# e2e

Creates and runs the e2e tests for an Nx Plugin.

Properties can be configured in workspace.json when defining the executor, or when invoking it.
Read more about how to use executors and the CLI here: https://nx.dev/react/getting-started/nx-cli#running-tasks.

## Properties

### jestConfig

Type: `string`

Jest config file.

### target

Type: `string`

The build target for the Nx Plugin project.

### ~~tsSpecConfig~~

Type: `string`

**Deprecated:** Use the `tsconfig` property for `ts-jest` in the e2e project `jest.config.js` file. It will be removed in the next major release.

The tsconfig file for specs.
