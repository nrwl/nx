---
title: '@nrwl/js:library generator'
description: 'Create a library'
---

# @nrwl/js:library

Create a library

## Usage

```bash
nx generate library ...
```

```bash
nx g lib ... # same
```

By default, Nx will search for `library` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/js:library ...
```

Show what will be generated without writing to disk:

```bash
nx g library ... --dry-run
```

### Examples

Generate libs/myapp/mylib:

```bash
nx g lib mylib --directory=myapp
```

## Options

### name (_**required**_)

Type: `string`

Library name

### buildable

Default: `true`

Type: `boolean`

Generate a buildable library.

### compiler

Default: `tsc`

Type: `string`

Possible values: `tsc`, `swc`

The compiler used by the build and test targets

### config

Default: `project`

Type: `string`

Possible values: `workspace`, `project`, `npm-scripts`

Determines whether the project's executors should be configured in workspace.json, project.json or as npm scripts

### directory

Type: `string`

A directory where the lib is placed

### importPath

Type: `string`

The library name used to import it, like @myorg/my-awesome-lib

### js

Default: `false`

Type: `boolean`

Generate JavaScript files rather than TypeScript files

### linter

Default: `eslint`

Type: `string`

Possible values: `eslint`, `none`

The tool to use for running lint checks.

### pascalCaseFiles

Alias(es): P

Default: `false`

Type: `boolean`

Use pascal case file names.

### publishable

Default: `false`

Type: `boolean`

Generate a publishable library.

### setParserOptionsProject

Default: `false`

Type: `boolean`

Whether or not to configure the ESLint "parserOptions.project" option. We do not do this by default for lint performance reasons.

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files

### skipTsConfig

Default: `false`

Type: `boolean`

Do not update tsconfig.json for development experience.

### skipTypeCheck

Default: `false`

Type: `boolean`

Whether to skip TypeScript type checking for SWC compiler.

### strict

Default: `true`

Type: `boolean`

Whether to enable tsconfig strict mode or not.

### tags

Type: `string`

Add tags to the library (used for linting)

### testEnvironment

Default: `jsdom`

Type: `string`

Possible values: `jsdom`, `node`

The test environment to use if unitTestRunner is set to jest

### unitTestRunner

Default: `jest`

Type: `string`

Possible values: `jest`, `none`

Test runner to use for unit tests
