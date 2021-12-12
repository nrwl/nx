---
title: '@nrwl/angular:scam generator'
description: 'Generate a component with an accompanying Single Component Angular Module (SCAM).'
---

# @nrwl/angular:scam

Generate a component with an accompanying Single Component Angular Module (SCAM).

## Usage

```bash
nx generate scam ...
```

By default, Nx will search for `scam` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/angular:scam ...
```

Show what will be generated without writing to disk:

```bash
nx g scam ... --dry-run
```

## Options

### name (_**required**_)

Type: `string`

The name of the component.

### changeDetection

Alias(es): c

Default: `Default`

Type: `string`

Possible values: `Default`, `OnPush`

The change detection strategy to use in the new component.

### displayBlock

Alias(es): b

Default: `false`

Type: `boolean`

Specifies if the style will contain `:host { display: block; }`.

### flat

Default: `false`

Type: `boolean`

Create the new files at the top level of the current project.

### inlineScam

Default: `true`

Type: `boolean`

Create the NgModule in the same file as the Component.

### inlineStyle

Alias(es): s

Default: `false`

Type: `boolean`

Include styles inline in the component.ts file. Only CSS styles can be included inline. By default, an external styles file is created and referenced in the component.ts file.

### inlineTemplate

Alias(es): t

Default: `false`

Type: `boolean`

Include template inline in the component.ts file. By default, an external template file is created and referenced in the component.ts file.

### path (**hidden**)

Type: `string`

The path at which to create the component file, relative to the current workspace. Default is a folder with the same name as the component in the project root.

### prefix

Alias(es): p

Type: `string`

The prefix to apply to the generated component selector.

### project

Type: `string`

The name of the project.

### selector

Type: `string`

The HTML selector to use for this component.

### skipSelector

Default: `false`

Type: `boolean`

Specifies if the component should have a selector or not.

### skipTests

Default: `false`

Type: `boolean`

Do not create "spec.ts" test files for the new component.

### style

Default: `css`

Type: `string`

Possible values: `css`, `scss`, `sass`, `less`, `none`

The file extension or preprocessor to use for style files, or 'none' to skip generating the style file.

### type

Default: `Component`

Type: `string`

Adds a developer-defined type to the filename, in the format "name.type.ts".

### viewEncapsulation

Alias(es): v

Type: `string`

Possible values: `Emulated`, `None`, `ShadowDom`

The view encapsulation strategy to use in the new component.
