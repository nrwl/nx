---
title: '@nrwl/cypress:cypress executor'
description: 'Run Cypress e2e tests'
---

# @nrwl/cypress:cypress

Run Cypress e2e tests

Options can be configured in `angular.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/configuration/projectjson#targets.

## Options

### cypressConfig (_**required**_)

Type: `string`

The path of the Cypress configuration json file.

### baseUrl

Type: `string`

The address (with the port) which your application is running on

### browser

Type: `string`

The browser to run tests in.

### ciBuildId

Type: `string`

A unique identifier for a run to enable grouping or parallelization.

### ~~copyFiles~~

Type: `string`

**Deprecated:** A regex string that is used to choose what additional integration files to copy to the dist folder

### devServerTarget

Type: `string`

Dev server target to run tests against.

### exit

Default: `true`

Type: `boolean`

Whether or not the Cypress Test Runner will stay open after running tests in a spec file

### group

Type: `string`

A named group for recorded runs in the Cypress dashboard.

### headed

Default: `false`

Type: `boolean`

Displays the browser instead of running headlessly. Set this to 'true' if your run depends on a Chrome extension being loaded.

### ~~headless~~

Default: `false`

Type: `boolean`

**Deprecated:** Hide the browser instead of running headed (default for cypress run).

### ignoreTestFiles

Type: `string`

A String or Array of glob patterns used to ignore test files that would otherwise be shown in your list of tests. Cypress uses minimatch with the options: {dot: true, matchBase: true}. We suggest using https://globster.xyz to test what files would match.

### key

Type: `string`

The key cypress should use to run tests in parallel/record the run (CI only)

### parallel

Default: `false`

Type: `boolean`

Whether or not Cypress should run its tests in parallel (CI only)

### record

Default: `false`

Type: `boolean`

Whether or not Cypress should record the results of the tests

### reporter

Type: `string`

The reporter used during cypress run

### reporterOptions

Type: `string`

The reporter options used. Supported options depend on the reporter.

### skipServe

Default: `false`

Type: `boolean`

Skip dev-server build.

### spec

Type: `string`

A comma delimited glob string that is provided to the Cypress runner to specify which spec files to run. i.e. '**examples/**,**actions.spec**

### testingType

Default: `e2e`

Type: `string`

Possible values: `component`, `e2e`

Specify the type of tests to execute

### tsConfig

Type: `string`

The path of the Cypress tsconfig configuration json file.

### watch

Default: `false`

Type: `boolean`

Recompile and run tests when files change.
