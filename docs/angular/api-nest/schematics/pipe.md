# pipe

Create a new nest pipe

## Usage

```bash
ng generate pipe ...
```

```bash
ng g pi ... # same
```

By default, Nx will search for `pipe` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
ng g @nrwl/nest:pipe ...
```

Show what will be generated without writing to disk:

```bash
ng g pipe ... --dry-run
```

### Examples

Generate libs/myproject:

```bash
ng g pipe mypipe --project=myproject
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

### unitTestRunner

Default: `jest`

Type: `string`

Possible values: `jest`, `none`

Test runner to use for unit tests
