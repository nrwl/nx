# @nrwl/linter:lint

**[DEPRECATED]**: Please use the eslint builder instead, an automated migration was provided in v10.3.0

Options can be configured in `workspace.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/core-concepts/configuration#targets.

## Options

### linter (_**required**_)

Default: `eslint`

Type: `string`

Possible values: `eslint`, `tslint`

The tool to use for running lint checks.

### cache

Default: `false`

Type: `boolean`

Only check changed files.

### cacheLocation

Type: `string`

Path to the cache file or directory.

### config

Type: `string`

The name of the configuration file.

### exclude

Type: `array`

Files to exclude from linting.

### files

Type: `array`

Files to include in linting.

### fix

Default: `false`

Type: `boolean`

Fixes linting errors (may overwrite linted files).

### force

Default: `false`

Type: `boolean`

Succeeds even if there was linting errors.

### format

Default: `stylish`

Type: `string`

ESLint Output formatter (https://eslint.org/docs/user-guide/formatters).

### maxWarnings

Default: `-1`

Type: `number`

Number of warnings to trigger nonzero exit code - default: -1

### outputFile

Type: `string`

File to write report to.

### quiet

Default: `false`

Type: `boolean`

Report errors only - default: false

### silent

Default: `false`

Type: `boolean`

Hide output text.

### tsConfig

Type: `string | string[] `

The name of the TypeScript configuration file.
