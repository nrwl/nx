# redux

Create a redux slice for a project

## Usage

```bash
ng generate redux ...
```

```bash
ng g slice ... # same
```

By default, Nx will search for `redux` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
ng g @nrwl/react:redux ...
```

Show what will be generated without writing to disk:

```bash
ng g redux ... --dry-run
```

## Options

### appProject

Alias(es): a

Type: `string`

The application project to add the slice to.

### directory

Alias(es): d

Type: `string`

The name of the folder used to contain/group the generated Redux files.

### name

Type: `string`

Redux slice name

### project

Alias(es): p

Type: `string`

The name of the project to add the slice to. If it is an application, then the store configuration will be updated too.
