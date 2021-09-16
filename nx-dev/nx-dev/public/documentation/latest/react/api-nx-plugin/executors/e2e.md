# @nrwl/nx-plugin:e2e

Creates and runs the e2e tests for an Nx Plugin.

Options can be configured in `workspace.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/core-concepts/configuration#targets.

## Options

### jestConfig (_**required**_)

Type: `string`

Jest config file.

### target (_**required**_)

Type: `string`

The build target for the Nx Plugin project.

### ~~tsSpecConfig~~

Type: `string`

**Deprecated:** Use the `tsconfig` property for `ts-jest` in the e2e project `jest.config.js` file. It will be removed in the next major release.

The tsconfig file for specs.
