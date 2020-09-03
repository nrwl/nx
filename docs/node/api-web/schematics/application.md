# application

Create an application

## Usage

```bash
nx generate application ...
```

```bash
nx g app ... # same
```

By default, Nx will search for `application` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/web:application ...
```

Show what will be generated without writing to disk:

```bash
nx g application ... --dry-run
```

## Options

### directory

Type: `string`

The directory of the new application.

### e2eTestRunner

Default: `cypress`

Type: `string`

Possible values: `cypress`, `none`

Test runner to use for end to end (e2e) tests

### linter

Default: `eslint`

Type: `string`

Possible values: `eslint`, `tslint`

The tool to use for running lint checks.

### name

Type: `string`

The name of the application.

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files

### style

Default: `css`

Type: `string`

Possible values: `css`, `scss`, `styl`, `less`

The file extension to be used for style files.

### tags

Type: `string`

Add tags to the application (used for linting)

### unitTestRunner

Default: `jest`

Type: `string`

Possible values: `jest`, `none`

Test runner to use for unit tests
