# cypress

Run Cypress e2e tests

## Properties

### baseUrl

Type: `string`

Use this to pass directly the address of your distant server address with the port running your application

### browser

Type: `string`

The browser to run tests in.

### cypressConfig

Type: `string`

The path of the Cypress configuration json file.

### devServerTarget

Type: `string`

Dev server target to run tests against.

### exit

Default: `true`

Type: `boolean`

Whether or not the Cypress Test Runner will stay open after running tests in a spec file

### headless

Default: `false`

Type: `boolean`

Whether or not to open the Cypress application to run the tests. If set to 'true', will run in headless mode

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

### tsConfig

Type: `string`

The path of the Cypress tsconfig configuration json file.

### watch

Default: `false`

Type: `boolean`

Recompile and run tests when files change.
