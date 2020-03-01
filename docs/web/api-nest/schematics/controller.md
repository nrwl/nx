# controller

Create a new nest controller

## Usage

```bash
nx generate controller ...
```

```bash
nx g co ... # same
```

By default, Nx will search for `controller` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/nest:controller ...
```

Show what will be generated without writing to disk:

```bash
nx g controller ... --dry-run
```

### Examples

Generate libs/myproject:

```bash
nx g controller mycontroller --project=myproject
```

## Options

### linter

Default: `tslint`

Type: `string`

Possible values: `eslint`, `tslint`

The tool to use for running lint checks.

### name

Type: `string`

Controller name

### project

Alias(es): p

Type: `string`

A project where the controller is placed

### service

Default: `false`

Type: `boolean`

Include a service with the controller

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files

### unitTestRunner

Default: `jest`

Type: `string`

Possible values: `jest`, `none`

Test runner to use for unit tests
