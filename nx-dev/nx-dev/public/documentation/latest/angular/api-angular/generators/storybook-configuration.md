---
title: '@nrwl/angular:storybook-configuration generator'
description: 'Adds Storybook configuration to a project.'
---

# @nrwl/angular:storybook-configuration

Adds Storybook configuration to a project.

## Usage

```bash
nx generate storybook-configuration ...
```

By default, Nx will search for `storybook-configuration` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/angular:storybook-configuration ...
```

Show what will be generated without writing to disk:

```bash
nx g storybook-configuration ... --dry-run
```

## Options

### name (_**required**_)

Type: `string`

The name of the project.

### configureCypress

Default: `true`

Type: `boolean`

Specifies whether to configure Cypress or not.

### cypressDirectory

Type: `string`

A directory where the Cypress project will be placed. Placed at the root by default.

### generateCypressSpecs

Default: `true`

Type: `boolean`

Specifies whether to automatically generate `*.spec.ts` files in the generated Cypress e2e app.

### generateStories

Default: `true`

Type: `boolean`

Specifies whether to automatically generate `*.stories.ts` files for components declared in this project or not.

### linter

Default: `eslint`

Type: `string`

Possible values: `eslint`, `none`

The tool to use for running lint checks.
