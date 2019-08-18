# upgrade-module

Add an upgrade module

## Usage

```bash
ng generate upgrade-module ...
```

By default, Nx will search for `upgrade-module` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
ng g @nrwl/angular:upgrade-module ...
```

Show what will be generated without writing to disk:

```bash
ng g upgrade-module ... --dry-run
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
