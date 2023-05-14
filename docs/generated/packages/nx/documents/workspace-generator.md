---
title: 'workspace-generator - CLI command'
description: 'Runs a workspace generator from the tools/generators directory'
---

# workspace-generator

**Deprecated:** Use a local plugin instead. See: https://nx.dev/deprecated/workspace-generators

Runs a workspace generator from the tools/generators directory

## Usage

```shell
nx workspace-generator [generator]
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

## Options

### dryRun

Type: `boolean`

Default: `false`

Preview the changes without updating files

### generator

Type: `string`

Name of the generator (e.g., @nx/js:library, library)

### help

Type: `boolean`

Show help

### interactive

Type: `boolean`

Default: `true`

When false disables interactive input prompts for options

### quiet

Type: `boolean`

Hides logs from tree operations (e.g. `CREATE package.json`)

### verbose

Type: `boolean`

Prints additional information about the commands (e.g., stack traces)

### version

Type: `boolean`

Show version number
