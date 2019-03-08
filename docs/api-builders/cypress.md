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

### headless

Default: `false`

Type: `boolean`

Whether or not the open the Cypress application to run the tests. If set to 'true', will run in headless mode

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
