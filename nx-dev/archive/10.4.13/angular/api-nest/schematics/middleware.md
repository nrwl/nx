# middleware

Run the 'middleware' NestJs Schematic with Nx project support

## Usage

```bash
nx generate middleware ...
```

By default, Nx will search for `middleware` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/nest:middleware ...
```

Show what will be generated without writing to disk:

```bash
nx g middleware ... --dry-run
```

## Options

### directory

Alias(es): d,path

Type: `string`

Directory where the generated files are placed

### flat

Default: `false`

Type: `boolean`

Flag to indicate if a directory is created.

### name

Type: `string`

The name of generated schematic

### project

Alias(es): p

Type: `string`

The nest project to target

### unitTestRunner

Default: `jest`

Type: `string`

Possible values: `jest`, `none`

Test runner to use for unit tests
