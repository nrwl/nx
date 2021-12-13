---
title: '@nrwl/angular:scam-pipe generator'
description: 'Generate a pipe with an accompanying Single Component Angular Module (SCAM).'
---

# @nrwl/angular:scam-pipe

Generate a pipe with an accompanying Single Component Angular Module (SCAM).

## Usage

```bash
nx generate scam-pipe ...
```

By default, Nx will search for `scam-pipe` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/angular:scam-pipe ...
```

Show what will be generated without writing to disk:

```bash
nx g scam-pipe ... --dry-run
```

## Options

### name (_**required**_)

Type: `string`

The name of the pipe.

### flat

Default: `true`

Type: `boolean`

Create the new files at the top level of the current project.

### inlineScam

Default: `true`

Type: `boolean`

Create the NgModule in the same file as the Pipe.

### path (**hidden**)

Type: `string`

The path at which to create the pipe file, relative to the current workspace. Default is a folder with the same name as the pipe in the project root.

### prefix

Alias(es): p

Type: `string`

The prefix to apply to the generated pipe selector.

### project

Type: `string`

The name of the project.

### skipTests

Default: `false`

Type: `boolean`

Do not create "spec.ts" test files for the new pipe.
