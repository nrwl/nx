# service

Run the 'service' NestJs Schematic with Nx project support

## Usage

```bash
nx generate service ...
```

By default, Nx will search for `service` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/nest:service ...
```

Show what will be generated without writing to disk:

```bash
nx g service ... --dry-run
```

### Examples

Generates a new class in the nest-api project:

```bash
nx g @nrwl/nest:schematics new-class --type=class --project=nest-api
```

## Options

### directory

Alias(es): d,path

Type: `string`

A directory where the resulting files are placed

### flat

Default: `false`

Type: `boolean`

Flag to indicate if a directory is created.

### name

Type: `string`

The name of resulting Nest schematic file

### project

Alias(es): p

Type: `string`

The nest project to target

### type

Alias(es): t

Type: `string`

Possible values: `class`, `controller`, `decorator`, `filter`, `gateway`, `guard`, `interceptor`, `interface`, `middleware`, `module`, `pipe`, `provider`, `resolver`, `service`

The Nest schematic to run

### unitTestRunner

Default: `jest`

Type: `string`

Possible values: `jest`, `none`

Test runner to use for unit tests
