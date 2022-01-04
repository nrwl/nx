---
title: '@nrwl/linter:eslint executor'
description: 'Run ESLint on a project'
---

# @nrwl/linter:eslint

Run ESLint on a project

Options can be configured in `angular.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/configuration/projectjson#targets.

## Options

### lintFilePatterns (_**required**_)

Type: `array`

One or more files/dirs/globs to pass directly to ESLint's lintFiles() method.

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

### hasTypeAwareRules

Type: `boolean`

When set to true, the linter will invalidate its cache when any of its dependencies changes.

### ignorePath

Type: `string`

The path of the .eslintignore file.

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
