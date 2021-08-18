# @nrwl/react:redux

Create a redux slice for a project

## Usage

```bash
nx generate redux ...
```

```bash
nx g slice ... # same
```

By default, Nx will search for `redux` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/react:redux ...
```

Show what will be generated without writing to disk:

```bash
nx g redux ... --dry-run
```

## Options

### name (_**required**_)

Type: `string`

Redux slice name.

### appProject

Alias(es): a

Type: `string`

The application project to add the slice to.

### directory

Alias(es): dir

Type: `string`

The name of the folder used to contain/group the generated Redux files.

### js

Default: `false`

Type: `boolean`

Generate JavaScript files rather than TypeScript files.

### project

Alias(es): p

Type: `string`

The name of the project to add the slice to. If it is an application, then the store configuration will be updated too.
