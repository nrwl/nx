---
title: '@nrwl/nest:library generator'
description: 'Create a new NestJS library.'
---

# @nrwl/nest:library

Create a new NestJS library.

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
nx g @nrwl/nest:library ...
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

Library name.

### buildable

Default: `false`

Type: `boolean`

Generate a buildable library.

### controller

Default: `false`

Type: `boolean`

Include a controller with the library.

### directory

Alias(es): dir

Type: `string`

A directory where the library is placed.

### global

Default: `false`

Type: `boolean`

Add the Global decorator to the generated module.

### importPath

Type: `string`

The library name used to import it, like @myorg/my-awesome-lib. Must be a valid npm name.

### linter

Default: `eslint`

Type: `string`

Possible values: `eslint`, `none`

The tool to use for running lint checks.

### publishable

Type: `boolean`

Create a publishable library.

### service

Default: `false`

Type: `boolean`

Include a service with the library.

### setParserOptionsProject

Default: `false`

Type: `boolean`

Whether or not to configure the ESLint "parserOptions.project" option. We do not do this by default for lint performance reasons.

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files.

### skipTsConfig

Default: `false`

Type: `boolean`

Do not update tsconfig.base.json for development experience.

### standaloneConfig

Default: `true`

Type: `boolean`

Split the project configuration into <projectRoot>/project.json rather than including it inside workspace.json

### strict

Default: `false`

Type: `boolean`

Whether to enable tsconfig strict mode or not.

### tags

Alias(es): t

Type: `string`

Add tags to the library (used for linting).

### target

Default: `es6`

Type: `string`

Possible values: `es5`, `es6`, `esnext`, `es2015`, `es2016`, `es2017`, `es2018`, `es2019`, `es2020`

The ES target, Nest suggest using es6 or higher.

### testEnvironment

Default: `node`

Type: `string`

Possible values: `jsdom`, `node`

The test environment for jest, for node applications this should stay as node unless doing DOM testing.

### unitTestRunner

Default: `jest`

Type: `string`

Possible values: `jest`, `none`

Test runner to use for unit tests.
