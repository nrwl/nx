# module

Create a new nest module

## Usage

```bash
nx generate module ...
```

```bash
nx g m ... # same
```

By default, Nx will search for `module` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/nest:module ...
```

Show what will be generated without writing to disk:

```bash
nx g module ... --dry-run
```

## Options

### flat

Default: `false`

Type: `boolean`

Create module at the source root rather than its own directory.

### name

Type: `string`

Module name

### path

Default: `/`

Type: `string`

The path to create the module.

### project

Type: `string`

The name of the project

### skipImport

Default: `false`

Type: `boolean`

Flag to skip the module import.
