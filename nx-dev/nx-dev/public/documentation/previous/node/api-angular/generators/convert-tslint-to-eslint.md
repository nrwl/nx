# convert-tslint-to-eslint

Convert a project from TSLint to ESLint

## Usage

```bash
nx generate convert-tslint-to-eslint ...
```

By default, Nx will search for `convert-tslint-to-eslint` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/angular:convert-tslint-to-eslint ...
```

Show what will be generated without writing to disk:

```bash
nx g convert-tslint-to-eslint ... --dry-run
```

### Examples

Convert the Angular project `myapp` from TSLint to ESLint:

```bash
nx g convert-tslint-to-eslint myapp
```

## Options

### project

Type: `string`

The name of the Angular project to convert.

### removeTSLintIfNoMoreTSLintTargets

Default: `true`

Type: `boolean`

If this conversion leaves no more TSLint usage in the workspace, it will remove TSLint and related dependencies and configuration
