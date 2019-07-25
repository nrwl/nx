# application

Create an application

## Usage

```bash
ng generate application ...

```

## Options

### babel

Default: `false`

Type: `boolean`

Use Babel and TypeScript preset instead of ts-loader (Useful if you need Babel plugins)

### classComponent

Default: `false`

Type: `boolean`

Use class components instead of functional component

### directory

Type: `string`

The directory of the new application.

### e2eTestRunner

Default: `cypress`

Type: `string`

Test runner to use for end to end (e2e) tests

### linter

Default: `tslint`

Type: `string`

The tool to use for running lint checks.

### name

Type: `string`

The name of the application.

### pascalCaseFiles

Default: `false`

Type: `boolean`

Use pascal case component file name (e.g. App.tsx)

### routing

Type: `boolean`

Generate application with routes

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files

### style

Default: `css`

Type: `string`

The file extension to be used for style files.

### tags

Type: `string`

Add tags to the application (used for linting)

### unitTestRunner

Default: `jest`

Type: `string`

Test runner to use for unit tests
