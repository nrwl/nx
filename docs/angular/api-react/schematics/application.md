# application

Create an application

## Usage

```bash
ng generate application ...
```

```bash
ng g app ... # same
```

By default, Nx will search for `application` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
ng g @nrwl/react:application ...
```

Show what will be generated without writing to disk:

```bash
ng g application ... --dry-run
```

### Examples

Generate apps/myorg/myapp and apps/myorg/myapp-e2e:

```bash
ng g app myapp --directory=myorg
```

Use class components instead of functional components:

```bash
ng g app myapp --classComponent
```

Set up routing:

```bash
ng g app myapp --routing
```

## Options

### classComponent

Alias(es): C

Default: `false`

Type: `boolean`

Use class components instead of functional component

### directory

Alias(es): d

Type: `string`

The directory of the new application.

### e2eTestRunner

Default: `cypress`

Type: `string`

Possible values: `cypress`, `none`

Test runner to use for end to end (e2e) tests

### linter

Default: `tslint`

Type: `string`

Possible values: `eslint`, `tslint`

The tool to use for running lint checks.

### name

Type: `string`

The name of the application.

### pascalCaseFiles

Alias(es): P

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

### skipWorkspaceJson

Default: `false`

Type: `boolean`

Skip updating workspace.json with default schematic options based on values provided to this app (e.g. babel, style)

### style

Alias(es): s

Default: `css`

Type: `string`

Possible values: `css`, `scss`, `styl`, `less`, `styled-components`, `@emotion/styled`

The file extension to be used for style files.

### tags

Alias(es): t

Type: `string`

Add tags to the application (used for linting)

### unitTestRunner

Default: `jest`

Type: `string`

Possible values: `jest`, `none`

Test runner to use for unit tests
