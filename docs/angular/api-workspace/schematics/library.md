# library

Create a library

## Usage

```bash
ng generate library ...
```

```bash
ng g lib ... # same
```

By default, Nx will search for `library` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
ng g @nrwl/workspace:library ...
```

Show what will be generated without writing to disk:

```bash
ng g library ... --dry-run
```

### Examples

Generate libs/myapp/mylib:

```bash
ng g lib mylib --directory=myapp
```

## Options

### directory

Type: `string`

A directory where the app is placed

### linter

Default: `tslint`

Type: `string`

Possible values: `eslint`, `tslint`

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

Possible values: `jest`, `none`

Test runner to use for unit tests
