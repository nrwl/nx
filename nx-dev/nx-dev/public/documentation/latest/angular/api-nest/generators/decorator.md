# @nrwl/nest:decorator

Run the `decorator` NestJS generator with Nx project support.

## Usage

```bash
nx generate decorator ...
```

By default, Nx will search for `decorator` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/nest:decorator ...
```

Show what will be generated without writing to disk:

```bash
nx g decorator ... --dry-run
```

## Options

### name (_**required**_)

Type: `string`

The name of the decorator.

### project (_**required**_)

Alias(es): p

Type: `string`

The Nest project to target.

### directory

Alias(es): dir,path

Type: `string`

Directory where the generated files are placed.

### flat

Default: `true`

Type: `boolean`

Flag to indicate if a directory is created.

### language

Type: `string`

Possible values: `js`, `ts`

Nest decorator language.

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files.
