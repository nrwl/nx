# @nrwl/node:library

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
nx g @nrwl/node:library ...
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

### name (_**required**_)

Type: `string`

Library name

### babelJest

Default: `false`

Type: `boolean`

Use babel instead ts-jest

### buildable

Default: `false`

Type: `boolean`

Generate a buildable library.

### directory

Alias(es): dir

Type: `string`

A directory where the lib is placed

### experimentalSwc

Default: `false`

Type: `boolean`

Use swc as TypeScript loader instead of tsc and babel

### importPath

Type: `string`

The library name used to import it, like @myorg/my-awesome-lib. Must be a valid npm name.

### js

Default: `false`

Type: `boolean`

Generate JavaScript files rather than TypeScript files.

### linter

Default: `eslint`

Type: `string`

Possible values: `eslint`, `tslint`

The tool to use for running lint checks.

### pascalCaseFiles

Alias(es): P

Default: `false`

Type: `boolean`

Use pascal case file names.

### publishable

Type: `boolean`

Create a publishable library.

### rootDir

Alias(es): srcRootForCompilationRoot

Type: `string`

Sets the rootDir for TypeScript compilation. When not defined, it uses the project's root property, or srcRootForCompilationRoot if it is defined.

### setParserOptionsProject

Default: `false`

Type: `boolean`

Whether or not to configure the ESLint "parserOptions.project" option. We do not do this by default for lint performance reasons.

### simpleModuleName

Default: `false`

Type: `boolean`

Keep the module name simple (when using --directory)

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files

### skipTsConfig

Default: `false`

Type: `boolean`

Do not update tsconfig.base.json for development experience.

### standaloneConfig

Type: `boolean`

Split the project configuration into <projectRoot>/project.json rather than including it inside workspace.json

### strict

Default: `false`

Type: `boolean`

Whether to enable tsconfig strict mode or not.

### tags

Alias(es): t

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
