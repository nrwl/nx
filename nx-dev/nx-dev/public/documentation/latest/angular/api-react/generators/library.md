# @nrwl/react:library

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
nx g @nrwl/react:library ...
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

Generate a library with routes and add them to myapp:

```bash
nx g lib mylib --appProject=myapp
```

## Options

### name (_**required**_)

Type: `string`

Library name

### appProject

Alias(es): a

Type: `string`

The application project to add the library route to.

### buildable

Default: `false`

Type: `boolean`

Generate a buildable library.

### component

Default: `true`

Type: `boolean`

Generate a default component.

### directory

Alias(es): dir

Type: `string`

A directory where the lib is placed.

### globalCss

Default: `false`

Type: `boolean`

When true, the stylesheet is generated using global CSS instead of CSS modules (e.g. file is '_.css' rather than '_.module.css').

### importPath

Type: `string`

The library name used to import it, like @myorg/my-awesome-lib

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

Use pascal case component file name (e.g. App.tsx).

### publishable

Type: `boolean`

Create a publishable library.

### routing

Type: `boolean`

Generate library with routes.

### setParserOptionsProject

Default: `false`

Type: `boolean`

Whether or not to configure the ESLint "parserOptions.project" option. We do not do this by default for lint performance reasons.

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files.

### skipTsConfig

Default: `false`

Type: `boolean`

Do not update tsconfig.json for development experience.

### standaloneConfig

Type: `boolean`

Split the project configuration into <projectRoot>/project.json rather than including it inside workspace.json

### strict

Default: `true`

Type: `boolean`

Whether to enable tsconfig strict mode or not.

### style

Alias(es): s

Default: `css`

Type: `string`

Possible values: `css`, `scss`, `styl`, `less`, `styled-components`, `@emotion/styled`, `styled-jsx`, `none`

The file extension to be used for style files.

### tags

Alias(es): t

Type: `string`

Add tags to the library (used for linting).

### unitTestRunner

Default: `jest`

Type: `string`

Possible values: `jest`, `none`

Test runner to use for unit tests.
