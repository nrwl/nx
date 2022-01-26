---
title: '@nrwl/angular:scam-directive generator'
description: 'Generate a directive with an accompanying Single Component Angular Module (SCAM).'
---

# @nrwl/angular:scam-directive

Generate a directive with an accompanying Single Component Angular Module (SCAM).

## Usage

```bash
nx generate scam-directive ...
```

By default, Nx will search for `scam-directive` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/angular:scam-directive ...
```

Show what will be generated without writing to disk:

```bash
nx g scam-directive ... --dry-run
```

## Options

### name (_**required**_)

Type: `string`

The name of the directive.

### export

Default: `false`

Type: `boolean`

Specifies if the SCAM should be exported from the project's entry point (normally `index.ts`). It only applies to libraries.

### flat

Default: `true`

Type: `boolean`

Create the new files at the top level of the current project.

### inlineScam

Default: `true`

Type: `boolean`

Create the NgModule in the same file as the Directive.

### path (**hidden**)

Type: `string`

The path at which to create the directive file, relative to the current workspace. Default is a folder with the same name as the directive in the project root.

### prefix

Alias(es): p

Type: `string`

The prefix to apply to the generated directive selector.

### project

Type: `string`

The name of the project.

### selector

Type: `string`

The HTML selector to use for this directive.

### skipTests

Default: `false`

Type: `boolean`

Do not create "spec.ts" test files for the new directive.
