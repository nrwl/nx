# library

Create a library

## Usage

```bash
nx generate library ...
```

```bash
nx g lib ... # same
```

By default, Nx will search for `library` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/workspace:library ...
```

Show what will be generated without writing to disk:

```bash
nx g library ... --dry-run
```

### Examples

Generate libs/myapp/mylib:

```bash
nx g lib mylib --directory=myapp
```

## Options

### babelJest

Default: `false`

Type: `boolean`

Use babel instead ts-jest

### directory

Type: `string`

A directory where the lib is placed

### importPath

Type: `string`

The library name used to import it, like @myorg/my-awesome-lib

### js

Default: `false`

Type: `boolean`

Generate JavaScript files rather than TypeScript files

### linter

Default: `eslint`

Type: `string`

Possible values: `eslint`, `tslint`

The tool to use for running lint checks.

### name

Type: `string`

Library name

### pascalCaseFiles

Alias(es): P

Default: `false`

Type: `boolean`

Use pascal case file names.

### skipBabelrc

Default: `false`

Type: `boolean`

Do not generate .babelrc file. Useful for Node libraries that are not compiled by Babel

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files

### skipTsConfig

Default: `false`

Type: `boolean`

Do not update tsconfig.json for development experience.

### strict

Default: `false`

Type: `boolean`

Whether to enable tsconfig strict mode or not.

### tags

Type: `string`

Add tags to the library (used for linting)

### testEnvironment

Default: `jsdom`

Type: `string`

Possible values: `jsdom`, `node`

The test environment to use if unitTestRunner is set to jest

### unitTestRunner

Default: `jest`

Type: `string`

Possible values: `jest`, `none`

Test runner to use for unit tests
