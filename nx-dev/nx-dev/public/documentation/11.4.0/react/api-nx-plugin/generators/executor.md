# executor

Create a executor for an Nx Plugin

## Usage

```bash
nx generate executor ...
```

By default, Nx will search for `executor` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/nx-plugin:executor ...
```

Show what will be generated without writing to disk:

```bash
nx g executor ... --dry-run
```

### Examples

Generate libs/my-plugin/src/executors/my-executor:

```bash
nx g executor my-executor --project=my-plugin
```

## Options

### description

Alias(es): d

Type: `string`

Executor description

### name

Type: `string`

Executor name

### project

Alias(es): p

Type: `string`

The name of the project.

### unitTestRunner

Default: `jest`

Type: `string`

Possible values: `jest`, `none`

Test runner to use for unit tests
