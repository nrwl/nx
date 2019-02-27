# jest

Run Jest unit tests

## Properties

### updateSnapshot

Alias(es): u

Type: `boolean`

Re-record all failing snapshots. (https://jestjs.io/docs/en/cli#updatesnapshot)

### jestConfig

Type: `string`

The path of the Jest configuration. (https://jestjs.io/docs/en/configuration.html)

### setupFile

Type: `string`

The name of a setup file used by Jest. (https://jestjs.io/docs/en/configuration.html#setuptestframeworkscriptfile-string)

### watch

Default: `false`

Type: `boolean`

Run tests when files change. (https://jestjs.io/docs/en/cli#watch)

### onlyChanged

Alias(es): o

Type: `boolean`

Isolate tests affected by uncommitted changes. (https://jestjs.io/docs/en/cli#onlychanged)

### passWithNoTests

Type: `boolean`

Allow test suite to pass when no test files are found. (https://jestjs.io/docs/en/cli#passwithnotests)

### codeCoverage

Type: `boolean`

Export a code coverage report. (https://jestjs.io/docs/en/cli#coverage)

### tsConfig

Type: `string`

The name of the Typescript configuration file.

### ci

Type: `boolean`

Fail on missing snapshots. (https://jestjs.io/docs/en/cli#ci)

### bail

Type: `boolean`

Exit the test suite immediately upon the first failing test suite. (https://jestjs.io/docs/en/cli#bail)

### silent

Type: `boolean`

Prevent tests from printing messages through the console. (https://jestjs.io/docs/en/cli#silent)

### runInBand

Type: `boolean`

Run tests in a single process as opposed to multiple workers. Useful for CI. (https://jestjs.io/docs/en/cli.html#runinband)

### maxWorkers

Type: `number`

Max number of workers to run tests across. Useful for CI. (https://jestjs.io/docs/en/cli.html#maxworkers-num)

### testNamePattern

Alias(es): t

Type: `string`

Run only tests with a name that matches the regex. (https://jestjs.io/docs/en/cli.html#testnamepattern-regex)
