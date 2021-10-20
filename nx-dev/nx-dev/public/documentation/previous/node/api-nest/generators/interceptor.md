# @nrwl/nest:interceptor

Run the `interceptor` NestJS generator with Nx project support.

## Usage

```bash
nx generate interceptor ...
```

By default, Nx will search for `interceptor` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/nest:interceptor ...
```

Show what will be generated without writing to disk:

```bash
nx g interceptor ... --dry-run
```

## Options

### name (_**required**_)

Type: `string`

The name of the interceptor.

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

Nest interceptor language.

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files.

### unitTestRunner

Default: `jest`

Type: `string`

Possible values: `jest`, `none`

Test runner to use for unit tests.
