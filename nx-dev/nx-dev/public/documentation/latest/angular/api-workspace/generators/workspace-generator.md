# @nrwl/workspace:workspace-generator

Generates a workspace generator

## Usage

```bash
nx generate workspace-generator ...
```

```bash
nx g workspace-schematic ... # same
```

By default, Nx will search for `workspace-generator` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/workspace:workspace-generator ...
```

Show what will be generated without writing to disk:

```bash
nx g workspace-generator ... --dry-run
```

## Options

### name

Type: `string`

Generator name

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files
