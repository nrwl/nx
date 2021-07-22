# @nrwl/web:migrate-to-webpack-5

Add webpack 5 compatible dependencies to the workspace

## Usage

```bash
nx generate migrate-to-webpack-5 ...
```

```bash
nx g webpack5 ... # same
```

By default, Nx will search for `migrate-to-webpack-5` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/web:migrate-to-webpack-5 ...
```

Show what will be generated without writing to disk:

```bash
nx g migrate-to-webpack-5 ... --dry-run
```
