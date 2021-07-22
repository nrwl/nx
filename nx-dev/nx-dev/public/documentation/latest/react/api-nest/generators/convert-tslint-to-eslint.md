# @nrwl/nest:convert-tslint-to-eslint

Convert a project from TSLint to ESLint.

## Usage

```bash
nx generate convert-tslint-to-eslint ...
```

By default, Nx will search for `convert-tslint-to-eslint` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/nest:convert-tslint-to-eslint ...
```

Show what will be generated without writing to disk:

```bash
nx g convert-tslint-to-eslint ... --dry-run
```

### Examples

Convert the NestJS project `myapp` from TSLint to ESLint:

```bash
nx g convert-tslint-to-eslint myapp
```

## Options

### project (_**required**_)

Type: `string`

The name of the NestJS project to convert.

### ignoreExistingTslintConfig

Default: `false`

Type: `boolean`

If true we will not use existing TSLint config as a reference, we will just reset the project with the latest recommended ESLint config.

### removeTSLintIfNoMoreTSLintTargets

Default: `true`

Type: `boolean`

If this conversion leaves no more TSLint usage in the workspace, it will remove TSLint and related dependencies and configuration.

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files.
