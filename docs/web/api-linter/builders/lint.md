# lint

Lint a project

Builder properties can be configured in workspace.json when defining the builder, or when invoking it.
Read more about how to use builders and the CLI here: https://nx.dev/web/guides/cli.

## Properties

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

### format

Default: `stylish`

Type: `string`

ESLint Output formatter (https://eslint.org/docs/user-guide/formatters).

### linter

Default: `tslint`

Type: `string`

Possible values: `eslint`, `tslint`

The tool to use for running lint checks.

### outputFile

Type: `string`

Output file for formatted output.

### tsConfig

Type: `string`

The name of the TypeScript configuration file.
