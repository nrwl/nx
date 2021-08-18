# @nrwl/workspace:npm-package

Create a minimal npm package

## Usage

```bash
nx generate npm-package ...
```

By default, Nx will search for `npm-package` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/workspace:npm-package ...
```

Show what will be generated without writing to disk:

```bash
nx g npm-package ... --dry-run
```

## Options

### name (_**required**_)

Type: `string`

Package name
