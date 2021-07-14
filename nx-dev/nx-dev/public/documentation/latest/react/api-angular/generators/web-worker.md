# web-worker

Create a Web Worker.

## Usage

```bash
nx generate web-worker ...
```

By default, Nx will search for `web-worker` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/angular:web-worker ...
```

Show what will be generated without writing to disk:

```bash
nx g web-worker ... --dry-run
```

## Options

### name

Type: `string`

The name of the worker.

### path

Type: `string`

The path at which to create the worker file, relative to the current workspace.

### project

Type: `string`

The name of the project.

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files.

### snippet

Default: `true`

Type: `boolean`

Add a worker creation snippet in a sibling file of the same name.
