# library

Create a library

## Usage

```bash
ng generate library ...
```

```bash
ng g lib ... # same
```

By default, Nx will search for `library` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
ng g @nrwl/react:library ...
```

Show what will be generated without writing to disk:

```bash
ng g library ... --dry-run
```

### Examples

Generate libs/myapp/mylib:

```bash
ng g lib mylib --directory=myapp
```

Generate a library with routes and add them to myapp:

```bash
ng g lib mylib --appProject=myapp
```

## Options

### appProject

Alias(es): a

Type: `string`

The application project to add the library route to

### directory

Alias(es): d

Type: `string`

A directory where the app is placed

### linter

Default: `tslint`

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

Use pascal case component file name (e.g. App.tsx)

### publishable

Type: `boolean`

Create a publishable library. A "build" architect will be added for this project the workspace configuration.

### routing

Type: `boolean`

Generate library with routes

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files

### skipTsConfig

Default: `false`

Type: `boolean`

Do not update tsconfig.json for development experience.

### style

Alias(es): s

Default: `css`

Type: `string`

Possible values: `css`, `scss`, `styl`, `less`, `styled-components`, `@emotion/styled`

The file extension to be used for style files.

### tags

Alias(es): t

Type: `string`

Add tags to the library (used for linting)

### unitTestRunner

Default: `jest`

Type: `string`

Possible values: `jest`, `none`

Test runner to use for unit tests
