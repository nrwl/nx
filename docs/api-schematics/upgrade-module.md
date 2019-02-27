# upgrade-module

Generates UpgradeModule setup

## Usage

```bash
ng generate upgrade-module ...

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

### angularJsCmpSelector

Type: `string`

The selector of an AngularJS component (e.g., --angularJsCmpSelector=myComponent)

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files

### skipPackageJson

Default: `false`

Type: `boolean`

Do not add @angular/upgrade to package.json (e.g., --skipPackageJson)

### router

Default: `false`

Type: `boolean`

Sets up router synchronization (e.g., --router)
