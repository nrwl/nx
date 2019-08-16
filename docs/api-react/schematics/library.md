# library

Create a library

## Usage

```bash
ng generate library ...

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

The tool to use for running lint checks.

### name

Type: `string`

Library name

### pascalCaseFiles

Alias(es): P

Default: `false`

Type: `boolean`

Use pascal case component file name (e.g. App.tsx)

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

The file extension to be used for style files.

### tags

Alias(es): t

Type: `string`

Add tags to the library (used for linting)

### unitTestRunner

Default: `jest`

Type: `string`

Test runner to use for unit tests
