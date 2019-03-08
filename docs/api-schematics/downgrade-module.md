# downgrade-module

Generates downgradeModule setup

## Usage

```bash
ng generate downgrade-module ...

```

## Options

### angularJsImport

Type: `string`

Import expression of the AngularJS application (e.g., --angularJsImport=some_node_module/my_app).

### name

Type: `string`

The name of the main AngularJS module.

### project

Type: `string`

The name of the project

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files

### skipPackageJson

Default: `false`

Type: `boolean`

Do not add @angular/upgrade to package.json (e.g., --skipPackageJson)
