# lint

Runs linting tools on application code in a given project folder using the configured linter.

## Usage

The `lint` command is a built-in alias to the [run command](/{{framework}}/cli/run).

These two commands are equivalent:

```bash
nx lint <project> [options]
```

```bash
nx run <project>:lint [options]
```

[Install `nx` globally]({{framework}}/getting-started/nx-setup#install-nx) to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpx nx`.

### Examples

Run lint checks for the `myapp` project and fix linter errors:

```bash
nx lint myapp --fix
```

## Common Options

The options below are common to the `lint` command used within an Nx workspace. The ESLint and Angular-specific lint options are listed after these options.

### exclude

Files to exclude from linting.

### files

Files to include in linting.

### fix

Fixes linting errors (may overwrite linted files).

### force

Succeeds even if there was linting errors.

### format

ESLint Output formatter (https://eslint.org/docs/user-guide/formatters). (default: stylish)

### silent

Hide output text.

### tsConfig

The name of the TypeScript configuration file.

### help

Show help information

### version

Show version number

## ESLint Options

### cache

Only check changed files.

### cacheLocation

Path to the cache file or directory.

### config

The name of the configuration file.

### linter

The tool to use for running lint checks.

Default: `tslint`

### outputFile

File to write report to.

## Angular-TSLint Options

### configuration (-c)

The linting configuration to use.

### tslint-config

The name of the TSLint configuration file.

### type-check

Controls the type check for linting.
