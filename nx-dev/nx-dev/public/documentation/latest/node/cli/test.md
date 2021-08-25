# test

Runs unit tests in a project using the configured unit test runner.

## Usage

The `test` command is a built-in alias to the [run command](/{{framework}}/cli/run).

These two commands are equivalent:

```bash
nx test <project> [options]
```

```bash
nx run <project>:test [options]
```

[Install `nx` globally]({{framework}}/getting-started/nx-setup#install-nx) to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpx nx`.

### Examples

Run unit tests:

```bash
nx test myapp
```

## Common Options

The options below are common to the `test` command used within an Nx workspace. The Jest and Karma-specific test options are listed after these options.

### codeCoverage

Indicates that test coverage information should be collected and reported in the output. (https://jestjs.io/docs/en/cli#coverage)

### tsConfig

The path to the Typescript configuration file.

### watch

Watch files for changes and rerun tests.

### help

Show help information.

### version

Show version number

## Jest Options

### bail

Exit the test suite immediately after `n` number of failing tests. (https://jestjs.io/docs/en/cli#bail)

### ci

Whether to run Jest in continuous integration (CI) mode. This option is on by default in most popular CI environments. It will prevent snapshots from being written unless explicitly requested. (https://jestjs.io/docs/en/cli#ci)

### color

Forces test results output color highlighting (even if stdout is not a TTY). Set to false if you would like to have no colors. (https://jestjs.io/docs/en/cli#colors)

### colors

Forces test results output highlighting even if stdout is not a TTY. (https://jestjs.io/docs/en/cli#colors)

### coverageReporters

A list of reporter names that Jest uses when writing coverage reports. Any istanbul reporter

### coverageDirectory

An array of regexp pattern strings that are matched against all file paths before executing the test. If the file path matches any of the patterns, coverage information will be skipped.

### config

The path to a Jest config file specifying how to find and execute tests. If no rootDir is set in the config, the directory containing the config file is assumed to be the rootDir for the project. This can also be a JSON-encoded value which Jest will use as configuration

### clearCache

Deletes the Jest cache directory and then exits without running tests. Will delete Jest's default cache directory. _Note: clearing the cache will reduce performance_.

### findRelatedTests

Find and run the tests that cover a comma separated list of source files that were passed in as arguments. (https://jestjs.io/docs/en/cli#findrelatedtests-spaceseparatedlistofsourcefiles)

### jestConfig

The path of the Jest configuration. (https://jestjs.io/docs/en/configuration)

### json

Prints the test results in JSON. This mode will send all other test output and user messages to stderr. (https://jestjs.io/docs/en/cli#json)

### maxWorkers

Specifies the maximum number of workers the worker-pool will spawn for running tests. This defaults to the number of the cores available on your machine. Useful for CI. (its usually best not to override this default) (https://jestjs.io/docs/en/cli#maxworkers-num)

### onlyChanged

Attempts to identify which tests to run based on which files have changed in the current repository. Only works if you're running tests in a git or hg repository at the moment. (https://jestjs.io/docs/en/cli#onlychanged)

### outputFile

Write test results to a file when the --json option is also specified. (https://jestjs.io/docs/en/cli#outputfile-filename)

### passWithNoTests

Will not fail if no tests are found (for example while using `--testPathPattern`.) (https://jestjs.io/docs/en/cli#passwithnotests)

### reporters

Run tests with specified reporters. Reporter options are not available via CLI. Example with multiple reporters: jest --reporters="default" --reporters="jest-junit" (https://jestjs.io/docs/en/cli#reporters)

### runInBand

Run all tests serially in the current process (rather than creating a worker pool of child processes that run tests). This is sometimes useful for debugging, but such use cases are pretty rare. Useful for CI. (https://jestjs.io/docs/en/cli#runinband)

### setupFile

The name of a setup file used by Jest. (https://jestjs.io/docs/en/configuration#setupfilesafterenv-array)

### silent

Prevent tests from printing messages through the console. (https://jestjs.io/docs/en/cli#silent)

### testFile

The name of the file to test.

### testNamePattern

Run only tests with a name that matches the regex pattern. (https://jestjs.io/docs/en/cli#testnamepattern-regex)

### testPathPattern

An array of regexp pattern strings that is matched against all tests paths before executing the test. (https://jestjs.io/docs/en/cli#testpathpattern-regex)

### testLocationInResults

Adds a location field to test results. Used to report location of a test in a reporter. { "column": 4, "line": 5 } (https://jestjs.io/docs/en/cli#testlocationinresults)

### testResultsProcessor

Node module that implements a custom results processor. (https://jestjs.io/docs/en/configuration#testresultsprocessor-string)

### updateSnapshot

Use this flag to re-record snapshots. Can be used together with a test suite pattern or with `--testNamePattern` to re-record snapshot for test matching the pattern. (https://jestjs.io/docs/en/cli#updatesnapshot)

### useStderr

Divert all output to stderr.

### verbose

Display individual test results with the test suite hierarchy. (https://jestjs.io/docs/en/cli#verbose)

### watchAll

Watch files for changes and rerun all tests when something changes. If you want to re-run only the tests that depend on the changed files, use the `--watch` option. (https://jestjs.io/docs/en/cli#watchall)

## Karma Options

### browsers

Override which browsers tests are run against.

### codeCoverage

Output a code coverage report.

### codeCoverageExclude

Globs to exclude from code coverage.

### configuration (-c)

A named build target, as specified in the "configurations" section of angular.json.
Each named target is accompanied by a configuration of option defaults for that target.
Setting this explicitly overrides the `--prod` flag.

### environment

Defines the build environment.

### evalSourceMap

Output in-file eval sourcemaps.

### help

Shows a help message for this command in the console.

### include

Globs of files to include, relative to workspace or project root.

There are 2 special cases:

- when a path to directory is provided, all spec files ending ".spec.@(ts|tsx)" will be included
- when a path to a file is provided, and a matching spec file exists it will be included instead

### karmaConfig

The name of the Karma configuration file.

### main

The name of the main entry-point file.

### poll

Enable and define the file watching poll time period in milliseconds.

### polyfills

The name of the polyfills file.

### preserveSymlinks

Do not use the real path when resolving modules.

### prod

Shorthand for "--configuration=production". When true, sets the build configuration to the production target. By default, the production target is set up in the workspace configuration such that all builds make use of bundling, limited tree-shaking, and also limited dead code elimination.

### progress

Log progress to the console while building.

### reporters

Karma reporters to use. Directly passed to the karma runner.

### sourceMap

Output sourcemaps.

### tsConfig

The name of the TypeScript configuration file.

### vendorSourceMap

Resolve vendor packages sourcemaps.

### watch

Run build when files change.

### webWorkerTsConfig

TypeScript configuration for Web Worker modules.
