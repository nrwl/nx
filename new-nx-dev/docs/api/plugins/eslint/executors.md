---
title: '@nx/eslint Executors'
description: 'Complete reference for all @nx/eslint executor commands'
sidebar_label: Executors
---

# @nx/eslint Executors

The @nx/eslint plugin provides various executors to run tasks on your eslint projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

## Available Executors

### `lint`

ESLint Lint Target.

**Usage:**

```bash
nx run &lt;project&gt;:lint [options]
```

#### Options

| Option                            | Type    | Description                                                                                                  | Default             |
| --------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------ | ------------------- |
| `--cache`                         | boolean | Only check changed files.                                                                                    | `false`             |
| `--cacheLocation`                 | string  | Path to the cache file or directory.                                                                         |                     |
| `--cacheStrategy`                 | string  | Strategy to use for detecting changed files in the cache.                                                    | `metadata`          |
| `--errorOnUnmatchedPattern`       | boolean | When set to false, equivalent of the `--no-error-on-unmatched-pattern` flag on the ESLint CLI.               | `true`              |
| `--eslintConfig`                  | string  | The name of the ESLint configuration file.                                                                   |                     |
| `--fix`                           | boolean | Fixes linting errors (may overwrite linted files).                                                           | `false`             |
| `--force`                         | boolean | Succeeds even if there was linting errors.                                                                   | `false`             |
| `--format`                        | string  | ESLint Output formatter (https://eslint.org/docs/user-guide/formatters).                                     | `stylish`           |
| `--hasTypeAwareRules`             | boolean | When set to `true`, the linter will invalidate its cache when any of its dependencies changes.               |                     |
| `--ignorePath`                    | string  | The path of the `.eslintignore` file. Not supported for Flat Config.                                         |                     |
| `--lintFilePatterns`              | array   | One or more files/dirs/globs to pass directly to ESLint's `lintFiles()` method.                              | `["{projectRoot}"]` |
| `--maxWarnings`                   | number  | Number of warnings to trigger nonzero exit code - default: `-1`.                                             | `-1`                |
| `--noEslintrc`                    | boolean | The equivalent of the `--no-eslintrc` flag on the ESLint CLI, it is `false` by default.                      | `false`             |
| `--outputFile`                    | string  | File to write report to.                                                                                     |                     |
| `--printConfig`                   | string  | The equivalent of the `--print-config` flag on the ESLint CLI.                                               |                     |
| `--quiet`                         | boolean | Report errors only - default: `false`.                                                                       | `false`             |
| `--reportUnusedDisableDirectives` | string  | The equivalent of the `--report-unused-disable-directives` flag on the ESLint CLI.                           |                     |
| `--resolvePluginsRelativeTo`      | string  | The equivalent of the `--resolve-plugins-relative-to` flag on the ESLint CLI. Not supported for Flat Config. |                     |
| `--rulesdir`                      | array   | The equivalent of the `--rulesdir` flag on the ESLint CLI.                                                   | `[]`                |
| `--silent`                        | boolean | Hide output text.                                                                                            | `false`             |

## Getting Help

You can get help for any executor by adding the `--help` flag:

```bash
nx run &lt;project&gt;:&lt;executor&gt; --help
```
