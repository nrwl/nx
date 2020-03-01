# middleware

Create a new nest middleware

## Usage

```bash
nx generate middleware ...
```

```bash
nx g mi ... # same
```

By default, Nx will search for `middleware` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/nest:middleware ...
```

Show what will be generated without writing to disk:

```bash
nx g middleware ... --dry-run
```

### Examples

Generate libs/myproject:

```bash
nx g middleware mymiddleware --project=myproject
```

## Options

### linter

Default: `tslint`

Type: `string`

Possible values: `eslint`, `tslint`

The tool to use for running lint checks.

### name

Type: `string`

middleware name

### project

Alias(es): p

Type: `string`

A project where the middleware is placed

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files

### unitTestRunner

Default: `jest`

Type: `string`

Possible values: `jest`, `none`

Test runner to use for unit tests
