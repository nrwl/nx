# @nrwl/angular:convert-tslint-to-eslint

Converts a project from TSLint to ESLint.

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

The following will first configure the project, `myapp`, the same way a _new_ project is configured i.e. It will use Nx's new recommended ESLint config. By default, this also adds the existing TSLint configuration on top of the default ESLint config from Nx to continue checking what it checks today. This is done by migrating TSLint rules to their equivalent ESLint rules to the best of its abilities. Some TSLint rules may not have ESLint equivalents and will be reported during the conversion:

```bash
nx g convert-tslint-to-eslint myapp
```

If your TSLint config isn't extremely important to you, ignoring it makes this process more deterministic. Unlike the prior example, this will discard the existing TSLint configuration, meaning that the project will only have the Nx's latest recommended ESLint configuration which may be good enough for some workspaces:

```bash
nx g convert-tslint-to-eslint myapp --ignoreExistingTslintConfig=true
```

By default, this process removes the TSLint related dependencies and configuration once no more projects use TSLint. This can be disabled with the following flag to keep TSLint related dependencies and configuration in the repo:

```bash
nx g convert-tslint-to-eslint myapp --removeTSLintIfNoMoreTSLintTargets=false
```

## Options

### project (_**required**_)

Type: `string`

The name of the Angular project to convert. Please note, if the project is an Angular app with an associated Cypress e2e project, it will also attempt to convert that.

### ignoreExistingTslintConfig

Default: `false`

Type: `boolean`

If true, it will not use existing TSLint config as a reference, it will just reset the project with the latest recommended ESLint config.

### removeTSLintIfNoMoreTSLintTargets

Default: `true`

Type: `boolean`

If this conversion leaves no more TSLint usage in the workspace, it will remove TSLint and related dependencies and configuration.

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files.
