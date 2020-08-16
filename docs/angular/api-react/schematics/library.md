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

Alias(es): d

Type: `string`

A directory where the lib is placed.

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

### name

Type: `string`

Library name

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

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files.

### skipTsConfig

Default: `false`

Type: `boolean`

Do not update tsconfig.json for development experience.

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
