# upgrade-module

Generates UpgradeModule setup

## Usage

```bash
ng generate upgrade-module ...

```

## Options

### angularJsCmpSelector

Type: `string`

The selector of an AngularJS component (e.g., --angularJsCmpSelector=myComponent)

### angularJsImport

Type: `string`

Import expression of the AngularJS application (e.g., --angularJsImport=some_node_module/my_app).

### name

Type: `string`

The name of the main AngularJS module.

### project

Type: `string`

The name of the project

### router

Default: `false`

Type: `boolean`

Sets up router synchronization (e.g., --router)

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files

### skipPackageJson

Default: `false`

Type: `boolean`

Do not add @angular/upgrade to package.json (e.g., --skipPackageJson)
