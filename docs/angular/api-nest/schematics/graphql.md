# graphql

Configure the @nestjs/graphql module

## Usage

```bash
nx generate graphql ...
```

By default, Nx will search for `graphql` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/nest:graphql ...
```

Show what will be generated without writing to disk:

```bash
nx g graphql ... --dry-run
```

## Options

### project

Type: `string`

The name of the project

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files

### skipInstall

Default: `false`

Type: `boolean`

Skip installing dependency packages.

### skipPackageJson

Default: `false`

Type: `boolean`

Do not add @nestjs/graphql to package.json (e.g., --skipPackageJson)
