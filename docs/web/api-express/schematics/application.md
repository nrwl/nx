# application

Create an express application

## Usage

```bash
nx generate application ...

```

## Options

### directory

Type: `string`

The directory of the new application.

### frontendProject

Type: `string`

Frontend project that needs to access this application. This sets up proxy configuration.

### linter

Default: `tslint`

Type: `string`

The tool to use for running lint checks.

### name

Type: `string`

The name of the application.

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files

### skipPackageJson

Default: `false`

Type: `boolean`

Do not add dependencies to package.json.

### tags

Type: `string`

Add tags to the application (used for linting)

### unitTestRunner

Default: `jest`

Type: `string`

Test runner to use for unit tests
