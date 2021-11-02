# @nrwl/angular:move

Moves an Angular application or library to another folder within the workspace and updates the project configuration.

## Usage

```bash
nx generate move ...
```

```bash
nx g mv ... # same
```

By default, Nx will search for `move` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/angular:move ...
```

Show what will be generated without writing to disk:

```bash
nx g move ... --dry-run
```

### Examples

Move libs/my-feature-lib to libs/shared/my-feature-lib:

```bash
nx g @nrwl/angular:move --project my-feature-lib shared/my-feature-lib
```

## Options

### destination (_**required**_)

Type: `string`

The folder to move the Angular project into.

### projectName (_**required**_)

Alias(es): project

Type: `string`

The name of the Angular project to move.

### importPath

Type: `string`

The new import path to use in the `tsconfig.base.json`.

### skipFormat

Alias(es): skip-format

Default: `false`

Type: `boolean`

Skip formatting files.

### updateImportPath

Default: `true`

Type: `boolean`

Update the import path to reflect the new location.
