# e2e

Builds and serves an app, then runs end-to-end tests using the configured E2E test runner.

## Usage

The `e2e` command is a built-in alias to the [run command](/{{framework}}/cli/run).

These two commands are equivalent:

```bash
nx e2e <project>
```

```bash
nx run <project>:e2e
```

[Install `nx` globally]({{framework}}/getting-started/nx-setup#install-nx) to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpx nx`.

### Examples

Run E2E test with a custom base url:

```bash
nx e2e myapp-e2e --base-url http://localhost:4201
```

Run E2E test with a specific target:

```bash
nx e2e myapp-e2e --configuration smoke
```

Run E2E test in watch mode:

```bash
nx e2e myapp-e2e --watch
```

## Common Options

The options below are common to the E2E commands used within an Nx workspace. Cypress and Protractor-specific options are listed below.

### baseUrl

Use this to pass directly the address of your distant server address with the port running your application. Setting this will ignore any local server targets. To skip running local targets, reset the `devServerTarget` to empty string.

### configuration (-c)

A named build target, as specified in the "configurations" section of angular.json. Each named target is accompanied by a configuration of option defaults for that target. Setting this explicitly overrides the `--prod` option.

### devServerTarget

Dev server target to run tests against.

### prod

Shorthand for `--configuration=production`. When true, sets the build configuration to the production target. By default, the production target is set up in the workspace configuration such that all builds make use of bundling, limited tree-shaking, and also limited dead code elimination.

### version

Show version number

### watch

Open the Cypress test runner & automatically run tests when files are updated

## Cypress Options

### browser

The browser to run tests in.

### ci-build-id

A unique identifier for a run to enable grouping or parallelization.

### ci-build-id

A unique identifier for a run to enable grouping or parallelization.

### cypress-config

The path of the Cypress configuration json file.

### exit

Whether or not the Cypress Test Runner will stay open after running tests in a spec file

### group

A named group for recorded runs in the Cypress dashboard.

### headless

Whether or not to open the Cypress application to run the tests. If set to 'true', will run in headless mode.

### help

Shows a help message for this command in the console.

### key

The key cypress should use to run tests in parallel/record the run (CI only).

### parallel

Whether or not Cypress should run its tests in parallel (CI only).

### record

Whether or not Cypress should record the results of the tests

### spec

A comma delimited glob string that is provided to the Cypress runner to specify which spec files to run. For example: '**examples/**,**actions.spec**

### ts-config

The path of the Cypress tsconfig configuration json file.

## Protractor Options

### element-explorer

Start Protractor's Element Explorer for debugging.

### host

Host to listen on.

### port

The port to use to serve the application.

### protractor-config

The name of the Protractor configuration file.

### specs

Override specs in the protractor config.

### suite

Override suite in the protractor config.

### webdriver-update

Try to update webdriver.
