# library

Create a library

## Usage

```bash
nx generate library ...

```

## Options

### directory

Type: `string`

A directory where the app is placed

### linter

Default: `tslint`

Type: `string`

The tool to use for running lint checks.

### name

Type: `string`

Library name

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files

### skipTsConfig

Default: `false`

Type: `boolean`

Do not update tsconfig.json for development experience.

### tags

Type: `string`

Add tags to the library (used for linting)

### unitTestRunner

Default: `jest`

Type: `string`

Test runner to use for unit tests
