# jest

Run Jest unit tests

### Properties

| Name              | Description                                                                                                                 | Type    | Default value |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- | ------- | ------------- |
| `updateSnapshot`  | Re-record all failing snapshots. (https://jestjs.io/docs/en/cli#updatesnapshot)                                             | boolean | `undefined`   |
| `jestConfig`      | The path of the Jest configuration. (https://jestjs.io/docs/en/configuration.html)                                          | string  | `undefined`   |
| `setupFile`       | The name of a setup file used by Jest. (https://jestjs.io/docs/en/configuration.html#setuptestframeworkscriptfile-string)   | string  | `undefined`   |
| `watch`           | Run tests when files change. (https://jestjs.io/docs/en/cli#watch)                                                          | boolean | `false`       |
| `onlyChanged`     | Isolate tests affected by uncommitted changes. (https://jestjs.io/docs/en/cli#onlychanged)                                  | boolean | `undefined`   |
| `passWithNoTests` | Allow test suite to pass when no test files are found. (https://jestjs.io/docs/en/cli#passwithnotests)                      | boolean | `undefined`   |
| `codeCoverage`    | Export a code coverage report. (https://jestjs.io/docs/en/cli#coverage)                                                     | boolean | `undefined`   |
| `tsConfig`        | The name of the Typescript configuration file.                                                                              | string  | `undefined`   |
| `ci`              | Fail on missing snapshots. (https://jestjs.io/docs/en/cli#ci)                                                               | boolean | `undefined`   |
| `bail`            | Exit the test suite immediately upon the first failing test suite. (https://jestjs.io/docs/en/cli#bail)                     | boolean | `undefined`   |
| `silent`          | Prevent tests from printing messages through the console. (https://jestjs.io/docs/en/cli#silent)                            | boolean | `undefined`   |
| `runInBand`       | Run tests in a single process as opposed to multiple workers. Useful for CI. (https://jestjs.io/docs/en/cli.html#runinband) | boolean | `undefined`   |
| `maxWorkers`      | Max number of workers to run tests across. Useful for CI. (https://jestjs.io/docs/en/cli.html#maxworkers-num)               | number  | `undefined`   |
| `testNamePattern` | Run only tests with a name that matches the regex. (https://jestjs.io/docs/en/cli.html#testnamepattern-regex)               | string  | `undefined`   |
