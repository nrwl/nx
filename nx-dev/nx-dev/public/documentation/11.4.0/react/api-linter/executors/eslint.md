# eslint

Run ESLint on a project

Properties can be configured in workspace.json when defining the executor, or when invoking it.
Read more about how to use executors and the CLI here: https://nx.dev/react/getting-started/cli-overview#running-tasks.

## Properties

### cache

Default: `false`

Type: `boolean`

Only check changed files.

### cacheLocation

Type: `string`

Path to the cache file or directory.

### eslintConfig

Type: `string`

The name of the ESLint configuration file.

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

### ignorePath

Type: `string`

The path of the .eslintignore file.

### lintFilePatterns

Type: `array`

One or more files/dirs/globs to pass directly to ESLint's lintFiles() method.

### maxWarnings

Default: `-1`

Type: `number`

Number of warnings to trigger nonzero exit code - default: -1

### noEslintrc

Default: `false`

Type: `boolean`

The equivalent of the --no-eslintrc flag on the ESLint CLI, it is false by default

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
