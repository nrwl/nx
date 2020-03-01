# service

Create a new nest service

## Usage

```bash
nx generate service ...
```

```bash
nx g s ... # same
```

By default, Nx will search for `service` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/nest:service ...
```

Show what will be generated without writing to disk:

```bash
nx g service ... --dry-run
```

### Examples

Generate libs/myproject:

```bash
nx g service myservice --project=myproject
```

## Options

### linter

Default: `tslint`

Type: `string`

Possible values: `eslint`, `tslint`

The tool to use for running lint checks.

### name

Type: `string`

Service name

### project

Alias(es): p

Type: `string`

A project where the service is placed

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files

### unitTestRunner

Default: `jest`

Type: `string`

Possible values: `jest`, `none`

Test runner to use for unit tests
