# interceptor

Create a new nest interceptor

## Usage

```bash
nx generate interceptor ...
```

```bash
nx g in ... # same
```

By default, Nx will search for `interceptor` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/nest:interceptor ...
```

Show what will be generated without writing to disk:

```bash
nx g interceptor ... --dry-run
```

### Examples

Generate libs/myproject:

```bash
nx g interceptor myinterceptor --project=myproject
```

## Options

### linter

Default: `tslint`

Type: `string`

Possible values: `eslint`, `tslint`

The tool to use for running lint checks.

### name

Type: `string`

Interceptor name

### project

Alias(es): p

Type: `string`

A project where the interceptor is placed

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files

### unitTestRunner

Default: `jest`

Type: `string`

Possible values: `jest`, `none`

Test runner to use for unit tests
