---
title: '@nrwl/angular:ng-packagr-lite executor'
description: 'Builds a library with support for incremental builds.'
---

# @nrwl/angular:ng-packagr-lite

Builds a library with support for incremental builds.

Options can be configured in `angular.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/configuration/projectjson#targets.

## Options

### project (_**required**_)

Type: `string`

The file path for the ng-packagr configuration file, relative to the workspace root.

### buildableProjectDepsInPackageJsonType

Default: `peerDependencies`

Type: `string`

Possible values: `dependencies`, `peerDependencies`

When `updateBuildableProjectDepsInPackageJson` is `true`, this adds dependencies to either `peerDependencies` or `dependencies`.

### tailwindConfig

Type: `string`

The full path for the Tailwind configuration file, relative to the workspace root. If not provided and a `tailwind.config.js` file exists in the project or workspace root, it will be used. Otherwise, Tailwind will not be configured.

### tsConfig

Type: `string`

The full path for the TypeScript configuration file, relative to the workspace root.

### updateBuildableProjectDepsInPackageJson

Default: `true`

Type: `boolean`

Whether to update the buildable project dependencies in package.json.

### watch

Default: `false`

Type: `boolean`

Whether to run a build when any file changes.
