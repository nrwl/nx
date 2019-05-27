# library

Create a library

## Usage

```bash
ng generate library ...

```

## Options

### directory

Type: `string`

A directory where the app is placed

### name

Type: `string`

Library name

### parentRoute

Type: `string`

Add new route to the parent component as specified by this path

### pascalCaseFiles

Default: `false`

Type: `boolean`

Use pascal case component file name (e.g. App.tsx)®

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

Default: `css`

Type: `string`

The file extension to be used for style files.

### tags

Type: `string`

Add tags to the library (used for linting)

### unitTestRunner

Default: `jest`

Type: `string`

Test runner to use for unit tests
