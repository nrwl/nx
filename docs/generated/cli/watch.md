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

### Examples

Watch the "app" project and echo the project name and the file that changed:

```terminal
 nx watch app -- "echo &1; echo &2"
```

Watch "app1" and "app2" and echo the project name whenever a specified project or its dependencies change:

```terminal
 nx watch --projects=app1,app2 --includeDependencies -- "echo &1"
```

Watch all projects and all files in the workspace:

```terminal
 nx watch --all --includeGlobalWorkspaceFiles -- "echo &1"
```

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
