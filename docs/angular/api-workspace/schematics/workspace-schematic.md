# workspace-schematic

Generates a workspace schematic

## Usage

```bash
nx generate workspace-schematic ...
```

By default, Nx will search for `workspace-schematic` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/workspace:workspace-schematic ...
```

Show what will be generated without writing to disk:

```bash
nx g workspace-schematic ... --dry-run
```

## Options

### name

Type: `string`

Schematic name

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files
