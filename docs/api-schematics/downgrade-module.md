# downgrade-module

Generates downgradeModule setup

## Usage

```bash
ng generate downgrade-module ...

```

## Options

### project

Type: `string`

The name of the project

### name

Type: `string`

The name of the main AngularJS module.

### angularJsImport

Type: `string`

Import expression of the AngularJS application (e.g., --angularJsImport=some_node_module/my_app).

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files

### skipPackageJson

Default: `false`

Type: `boolean`

Do not add @angular/upgrade to package.json (e.g., --skipPackageJson)
