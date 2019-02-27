# node-application

Create a NodeJS Application

## Usage

```bash
ng generate node-application ...

```

## Options

### name

Type: `string`

The name of the application.

### directory

Type: `string`

The directory of the new application.

### framework

Default: `nestjs`

Type: `string`

Node Framework to use for application.

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files

### skipPackageJson

Default: `false`

Type: `boolean`

Do not add dependencies to package.json.

### unitTestRunner

Default: `jest`

Type: `string`

Test runner to use for unit tests

### tags

Type: `string`

Add tags to the application (used for linting)

### frontendProject

Type: `string`

Frontend project that needs to access this application. This sets up proxy configuration.
