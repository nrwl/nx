# schematic

Create a schematic for an Nx Plugin

## Usage

```bash
nx generate schematic ...
```

By default, Nx will search for `schematic` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/nx-plugin:schematic ...
```

Show what will be generated without writing to disk:

```bash
nx g schematic ... --dry-run
```

### Examples

Generate libs/my-plugin/src/schematics/my-schematic:

```bash
nx g schematic my-schematic --project=my-plugin
```

## Options

### description

Alias(es): d

Type: `string`

Schematic description

### name

Type: `string`

Schematic name

### project

Alias(es): p

Type: `string`

The name of the project.

### unitTestRunner

Default: `jest`

Type: `string`

Possible values: `jest`, `none`

Test runner to use for unit tests
