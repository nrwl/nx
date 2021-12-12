---
title: '@nrwl/react-native:application generator'
description: 'Create an application'
---

# @nrwl/react-native:application

Create an application

## Usage

```bash
nx generate application ...
```

```bash
nx g app ... # same
```

By default, Nx will search for `application` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/react-native:application ...
```

Show what will be generated without writing to disk:

```bash
nx g application ... --dry-run
```

### Examples

Generate apps/nested/myapp:

```bash
nx g app myapp --directory=nested
```

Use class components instead of functional components:

```bash
nx g app myapp --classComponent
```

## Options

### directory

Alias(es): d

Type: `string`

The directory of the new application.

### displayName

Type: `string`

The display name to show in the application. Defaults to name.

### e2eTestRunner

Default: `detox`

Type: `string`

Possible values: `detox`, `none`

Adds the specified e2e test runner

### js

Default: `false`

Type: `boolean`

Generate JavaScript files rather than TypeScript files

### linter

Default: `eslint`

Type: `string`

Possible values: `eslint`, `tslint`

The tool to use for running lint checks.

### name

Type: `string`

The name of the application.

### setParserOptionsProject

Default: `false`

Type: `boolean`

Whether or not to configure the ESLint "parserOptions.project" option. We do not do this by default for lint performance reasons.

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files

### tags

Alias(es): t

Type: `string`

Add tags to the application (used for linting)

### unitTestRunner

Default: `jest`

Type: `string`

Possible values: `jest`, `none`

Test runner to use for unit tests
