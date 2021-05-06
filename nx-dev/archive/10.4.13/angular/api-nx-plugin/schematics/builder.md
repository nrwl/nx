# builder

Create a builder for an Nx Plugin

## Usage

```bash
nx generate builder ...
```

By default, Nx will search for `builder` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/nx-plugin:builder ...
```

Show what will be generated without writing to disk:

```bash
nx g builder ... --dry-run
```

### Examples

Generate libs/my-plugin/src/builders/my-builder:

```bash
nx g builder my-builder --project=my-plugin
```

## Options

### description

Alias(es): d

Type: `string`

Builder description

### name

Type: `string`

Builder name

### project

Alias(es): p

Type: `string`

The name of the project.

### unitTestRunner

Default: `jest`

Type: `string`

Possible values: `jest`, `none`

Test runner to use for unit tests
