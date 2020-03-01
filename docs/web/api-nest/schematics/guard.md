# guard

Create a new nest guard

## Usage

```bash
nx generate guard ...
```

```bash
nx g gu ... # same
```

By default, Nx will search for `guard` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/nest:guard ...
```

Show what will be generated without writing to disk:

```bash
nx g guard ... --dry-run
```

### Examples

Generate libs/myproject:

```bash
nx g guard myguard --project=myproject
```

## Options

### linter

Default: `tslint`

Type: `string`

Possible values: `eslint`, `tslint`

The tool to use for running lint checks.

### name

Type: `string`

Guard name

### project

Alias(es): p

Type: `string`

A project where the guard is placed

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

Add tags to the guard (used for linting)

### unitTestRunner

Default: `jest`

Type: `string`

Possible values: `jest`, `none`

Test runner to use for unit tests
