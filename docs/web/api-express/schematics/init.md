# init

Initialize the @nrwl/express plugin

## Usage

```bash
nx generate init ...
```

By default, Nx will search for `init` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/express:init ...
```

Show what will be generated without writing to disk:

```bash
nx g init ... --dry-run
```

## Options

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files
