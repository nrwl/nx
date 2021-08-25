# @nrwl/nest:module

Run the `module` NestJS generator with Nx project support.

## Usage

```bash
nx generate module ...
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

### name (_**required**_)

Type: `string`

The name of the module.

### project (_**required**_)

Alias(es): p

Type: `string`

The Nest project to target.

### directory

Alias(es): dir,path

Type: `string`

Directory where the generated files are placed.

### flat

Default: `false`

Type: `boolean`

Flag to indicate if a directory is created.

### language

Type: `string`

Possible values: `js`, `ts`

Nest module language.

### module

Type: `string`

The path to import the module.

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files.

### skipImport

Default: `false`

Type: `boolean`

Flag to skip the module import.
