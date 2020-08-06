# lint

Lint a project

Builder properties can be configured in angular.json when defining the builder, or when invoking it.

## Properties

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

### linter

Default: `eslint`

Type: `string`

Possible values: `eslint`, `tslint`

The tool to use for running lint checks.

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

Type: `string | string[]`

The name of the TypeScript configuration file.
