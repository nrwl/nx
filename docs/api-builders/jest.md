# jest

Run Jest unit tests

## Properties

### bail

Type: `boolean`

Exit the test suite immediately upon the first failing test suite. (https://jestjs.io/docs/en/cli#bail)

### ci

Type: `boolean`

Fail on missing snapshots. (https://jestjs.io/docs/en/cli#ci)

### codeCoverage

Type: `boolean`

Export a code coverage report. (https://jestjs.io/docs/en/cli#coverage)

### jestConfig

Type: `string`

The path of the Jest configuration. (https://jestjs.io/docs/en/configuration.html)

### maxWorkers

Type: `number`

Max number of workers to run tests across. Useful for CI. (https://jestjs.io/docs/en/cli.html#maxworkers-num)

### onlyChanged

Alias(es): o

Type: `boolean`

Isolate tests affected by uncommitted changes. (https://jestjs.io/docs/en/cli#onlychanged)

### passWithNoTests

Type: `boolean`

Allow test suite to pass when no test files are found. (https://jestjs.io/docs/en/cli#passwithnotests)

### runInBand

Type: `boolean`

Run tests in a single process as opposed to multiple workers. Useful for CI. (https://jestjs.io/docs/en/cli.html#runinband)

### setupFile

Type: `string`

The name of a setup file used by Jest. (https://jestjs.io/docs/en/configuration.html#setuptestframeworkscriptfile-string)

### silent

Type: `boolean`

Prevent tests from printing messages through the console. (https://jestjs.io/docs/en/cli#silent)

### testNamePattern

Alias(es): t

Type: `string`

Run only tests with a name that matches the regex. (https://jestjs.io/docs/en/cli.html#testnamepattern-regex)

### tsConfig

Type: `string`

The name of the Typescript configuration file.

### updateSnapshot

Alias(es): u

Type: `boolean`

Re-record all failing snapshots. (https://jestjs.io/docs/en/cli#updatesnapshot)

### watch

Default: `false`

Type: `boolean`

Run tests when files change. (https://jestjs.io/docs/en/cli#watch)
