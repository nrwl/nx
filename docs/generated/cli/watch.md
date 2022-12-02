---
title: 'watch - CLI command'
description: 'Watch for changes within projects, and execute commands'
---

# watch

Watch for changes within projects, and execute commands

## Usage

```terminal
nx watch [project]
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

## Options

### all

Type: `boolean`

Watch all projects.

### help

Type: `boolean`

Show help

### includeDependentProjects

Type: `boolean`

When watching selected projects, include dependent projects as well.

### includeGlobalWorkspaceFiles

Type: `boolean`

Include global workspace files that are not part of a project. For example, the root eslint, or tsconfig file.

### project

Type: `string`

The project to watch

### projects

Type: `string`

Projects to watch (comma delimited).

### verbose

Type: `boolean`

Run watch mode in verbose mode, where commands are logged before execution.

### version

Type: `boolean`

Show version number
