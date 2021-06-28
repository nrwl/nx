# pipe

Run the `pipe` NestJS generator with Nx project support.

## Usage

```bash
nx generate pipe ...
```

By default, Nx will search for `pipe` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/nest:pipe ...
```

Show what will be generated without writing to disk:

```bash
nx g pipe ... --dry-run
```

## Options

### directory

Alias(es): d,path

Type: `string`

Directory where the generated files are placed.

### flat

Default: `true`

Type: `boolean`

Flag to indicate if a directory is created.

### language

Type: `string`

Possible values: `js`, `ts`

Nest pipe language.

### name

Type: `string`

The name of the pipe.

### project

Alias(es): p

Type: `string`

The Nest project to target.

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files.

### unitTestRunner

Default: `jest`

Type: `string`

Possible values: `jest`, `none`

Test runner to use for unit tests.
