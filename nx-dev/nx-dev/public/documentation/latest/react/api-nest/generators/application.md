# @nrwl/nest:application

Create a NestJS application.

## Usage

```bash
nx generate application ...
```

```bash
nx g app ... # same
```

By default, Nx will search for `application` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/nest:application ...
```

Show what will be generated without writing to disk:

```bash
nx g application ... --dry-run
```

## Options

### name (_**required**_)

Type: `string`

The name of the application.

### directory

Type: `string`

The directory of the new application.

### frontendProject

Type: `string`

Frontend project that needs to access this application. This sets up proxy configuration.

### linter

Default: `eslint`

Type: `string`

Possible values: `eslint`, `none`

The tool to use for running lint checks.

### setParserOptionsProject

Default: `false`

Type: `boolean`

Whether or not to configure the ESLint "parserOptions.project" option. We do not do this by default for lint performance reasons.

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files.

### skipPackageJson

Default: `false`

Type: `boolean`

Do not add dependencies to package.json.

### standaloneConfig

Type: `boolean`

Split the project configuration into <projectRoot>/project.json rather than including it inside workspace.json.

### tags

Type: `string`

Add tags to the application (used for linting).

### unitTestRunner

Default: `jest`

Type: `string`

Possible values: `jest`, `none`

Test runner to use for unit tests.
