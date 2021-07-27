# @nrwl/gatsby:application

Create an application

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
nx g @nrwl/gatsby:application ...
```

Show what will be generated without writing to disk:

```bash
nx g application ... --dry-run
```

## Options

### name (_**required**_)

Type: `string`

### directory

Alias(es): d

Type: `string`

A directory where the project is placed

### e2eTestRunner

Default: `cypress`

Type: `string`

Possible values: `cypress`, `none`

Adds the specified e2e test runner

### js

Default: `false`

Type: `boolean`

Generate JavaScript files rather than TypeScript files

### setParserOptionsProject

Default: `false`

Type: `boolean`

Whether or not to configure the ESLint "parserOptions.project" option. We do not do this by default for lint performance reasons.

### standaloneConfig

Default: `false`

Type: `boolean`

Split the project configuration into <projectRoot>/project.json rather than including it inside workspace.json

### style

Alias(es): s

Default: `css`

Type: `string`

Possible values: `css`, `scss`, `styl`, `less`, `styled-components`, `@emotion/styled`, `styled-jsx`, `none`

The file extension to be used for style files.

### tags

Alias(es): t

Type: `string`

Add tags to the project (used for linting)

### unitTestRunner

Default: `jest`

Type: `string`

Possible values: `jest`, `none`

Adds the specified unit test runner
