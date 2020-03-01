# pipe

Create a new nest pipe

## Usage

```bash
nx generate pipe ...
```

```bash
nx g pi ... # same
```

By default, Nx will search for `pipe` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/nest:pipe ...
```

Show what will be generated without writing to disk:

```bash
nx g pipe ... --dry-run
```

### Examples

Generate libs/myproject:

```bash
nx g pipe mypipe --project=myproject
```

## Options

### linter

Default: `tslint`

Type: `string`

Possible values: `eslint`, `tslint`

The tool to use for running lint checks.

### name

Type: `string`

Pipe name

### project

Alias(es): p

Type: `string`

A project where the pipe is placed

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files

### skipTsConfig

Default: `false`

Type: `boolean`

Do not update tsconfig.json for development experience.

### tags

Alias(es): t

Type: `string`

Add tags to the pipe (used for linting)

### unitTestRunner

Default: `jest`

Type: `string`

Possible values: `jest`, `none`

Test runner to use for unit tests
