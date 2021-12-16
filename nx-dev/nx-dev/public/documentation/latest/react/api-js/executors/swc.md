---
title: '@nrwl/js:swc executor'
description: 'Build a project using SWC'
---

# @nrwl/js:swc

Build a project using SWC

Options can be configured in `workspace.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/core-concepts/configuration#targets.

## Options

### main (_**required**_)

Type: `string`

The name of the main entry-point file.

### outputPath (_**required**_)

Type: `string`

The output path of the generated files.

### tsConfig (_**required**_)

Type: `string`

The path to the Typescript configuration file.

### assets

Type: `array`

List of static assets.

### skipTypeCheck

Default: `false`

Type: `boolean`

Whether to skip TypeScript type checking.
