# service

Create a new nest service

## Usage

```bash
ng generate service ...
```

```bash
ng g s ... # same
```

By default, Nx will search for `service` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
ng g @nrwl/nest:service ...
```

Show what will be generated without writing to disk:

```bash
ng g service ... --dry-run
```

### Examples

Generate libs/myproject:

```bash
ng g service myservice --project=myproject
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

### skipTsConfig

Default: `false`

Type: `boolean`

Do not update tsconfig.json for development experience.

### tags

Alias(es): t

Type: `string`

Add tags to the service (used for linting)

### unitTestRunner

Default: `jest`

Type: `string`

Possible values: `jest`, `none`

Test runner to use for unit tests
