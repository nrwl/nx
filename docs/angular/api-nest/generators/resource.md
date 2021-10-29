# @nrwl/nest:resource

Run the `resource` NestJS generator with Nx project support.

## Usage

```bash
nx generate resource ...
```

By default, Nx will search for `resource` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/nest:resource ...
```

Show what will be generated without writing to disk:

```bash
nx g resource ... --dry-run
```

## Options

### name (_**required**_)

Type: `string`

The name of the resource.

### project (_**required**_)

Alias(es): p

Type: `string`

The Nest project to target.

### crud

Default: `true`

Type: `boolean`

When true, CRUD entry points are generated.

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

Nest class language.

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files.

### skipImport

Default: `false`

Type: `boolean`

Flag to skip the module import.

### type

Default: `rest`

Type: `string`

Possible values: `rest`, `graphql-code-first`, `graphql-schema-first`, `microservice`, `ws`

The transport layer.

### unitTestRunner

Default: `jest`

Type: `string`

Possible values: `jest`, `none`

Test runner to use for unit tests.
