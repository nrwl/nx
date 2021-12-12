---
title: '@nrwl/jest:jest executor'
description: 'Run Jest unit tests'
---

# @nrwl/jest:jest

Run Jest unit tests

Options can be configured in `angular.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/core-concepts/configuration#targets.

## Options

### jestConfig (_**required**_)

Type: `string`

The path of the Jest configuration. (https://jestjs.io/docs/en/configuration)

### bail

Alias(es): b

Type: `number | boolean `

Exit the test suite immediately after `n` number of failing tests. (https://jestjs.io/docs/cli#--bail)

### changedSince

Type: `string`

Runs tests related to the changes since the provided branch or commit hash. If the current branch has diverged from the given branch, then only changes made locally will be tested. (https://jestjs.io/docs/cli#--changedsince)

### ci

Type: `boolean`

Whether to run Jest in continuous integration (CI) mode. This option is on by default in most popular CI environments. It will prevent snapshots from being written unless explicitly requested. (https://jestjs.io/docs/cli#--ci)

### clearCache

Type: `boolean`

Deletes the Jest cache directory and then exits without running tests. Will delete Jest's default cache directory. _Note: clearing the cache will reduce performance_.

### codeCoverage

Alias(es): coverage

Type: `boolean`

Indicates that test coverage information should be collected and reported in the output. (https://jestjs.io/docs/cli#--coverageboolean)

### color

Alias(es): colors

Type: `boolean`

Forces test results output color highlighting (even if stdout is not a TTY). Set to false if you would like to have no colors. (https://jestjs.io/docs/cli#--colors)

### colors

Type: `boolean`

Forces test results output highlighting even if stdout is not a TTY. (https://jestjs.io/docs/cli#--colors)

### config

Type: `string`

The path to a Jest config file specifying how to find and execute tests. If no rootDir is set in the config, the directory containing the config file is assumed to be the rootDir for the project. This can also be a JSON-encoded value which Jest will use as configuration

### coverageDirectory

Type: `string`

The directory where Jest should output its coverage files.

### coverageReporters

Type: `array`

A list of reporter names that Jest uses when writing coverage reports. Any istanbul reporter

### detectOpenHandles

Type: `boolean`

Attempt to collect and print open handles preventing Jest from exiting cleanly (https://jestjs.io/docs/cli#--detectopenhandles)

### findRelatedTests

Type: `string`

Find and run the tests that cover a comma separated list of source files that were passed in as arguments. (https://jestjs.io/docs/cli#--findrelatedtests-spaceseparatedlistofsourcefiles)

### json

Type: `boolean`

Prints the test results in JSON. This mode will send all other test output and user messages to stderr. (https://jestjs.io/docs/cli#--json)

### maxWorkers

Alias(es): w

Type: `number | string `

Specifies the maximum number of workers the worker-pool will spawn for running tests. This defaults to the number of the cores available on your machine. Useful for CI. (its usually best not to override this default) (https://jestjs.io/docs/cli#--maxworkersnumstring)

### onlyChanged

Alias(es): o

Type: `boolean`

Attempts to identify which tests to run based on which files have changed in the current repository. Only works if you're running tests in a git or hg repository at the moment. (https://jestjs.io/docs/cli#--onlychanged)

### outputFile

Type: `string`

Write test results to a file when the --json option is also specified. (https://jestjs.io/docs/cli#--outputfilefilename)

### passWithNoTests

Type: `boolean`

Will not fail if no tests are found (for example while using `--testPathPattern`.) (https://jestjs.io/docs/cli#--passwithnotests)

### reporters

Type: `array`

Run tests with specified reporters. Reporter options are not available via CLI. Example with multiple reporters: jest --reporters="default" --reporters="jest-junit" (https://jestjs.io/docs/cli#--reporters)

### runInBand

Alias(es): i

Type: `boolean`

Run all tests serially in the current process (rather than creating a worker pool of child processes that run tests). This is sometimes useful for debugging, but such use cases are pretty rare. Useful for CI. (https://jestjs.io/docs/cli#--runinband)

### ~~setupFile~~

Type: `string`

**Deprecated:** The name of a setup file used by Jest. (use Jest config file https://jestjs.io/docs/en/configuration#setupfilesafterenv-array)

### showConfig

Type: `boolean`

Print your Jest config and then exits. (https://jestjs.io/docs/en/cli#--showconfig)

### silent

Type: `boolean`

Prevent tests from printing messages through the console. (https://jestjs.io/docs/cli#--silent)

### testFile

Type: `string`

The name of the file to test.

### testLocationInResults

Type: `boolean`

Adds a location field to test results. Used to report location of a test in a reporter. { "column": 4, "line": 5 } (https://jestjs.io/docs/cli#--testlocationinresults)

### testNamePattern

Alias(es): t

Type: `string`

Run only tests with a name that matches the regex pattern. (https://jestjs.io/docs/cli#--testnamepatternregex)

### testPathIgnorePatterns

Type: `array`

An array of regexp pattern strings that is matched against all tests paths before executing the test. Only run those tests with a path that does not match with the provided regexp expressions. (https://jestjs.io/docs/cli#--testpathignorepatternsregexarray)

### testPathPattern

Type: `array`

An array of regexp pattern strings that is matched against all tests paths before executing the test. (https://jestjs.io/docs/cli#--testpathpatternregex)

### testResultsProcessor

Type: `string`

Node module that implements a custom results processor. (https://jestjs.io/docs/en/configuration#testresultsprocessor-string)

### testTimeout

Type: `number`

Default timeout of a test in milliseconds. Default value: 5000. (https://jestjs.io/docs/cli#--testtimeoutnumber)

### ~~tsConfig~~

Type: `string`

**Deprecated:** The name of the Typescript configuration file. Set the tsconfig option in the jest config file.

### updateSnapshot

Alias(es): u

Type: `boolean`

Use this flag to re-record snapshots. Can be used together with a test suite pattern or with `--testNamePattern` to re-record snapshot for test matching the pattern. (https://jestjs.io/docs/cli#--updatesnapshot)

### useStderr

Type: `boolean`

Divert all output to stderr.

### verbose

Type: `boolean`

Display individual test results with the test suite hierarchy. (https://jestjs.io/docs/cli#--verbose)

### watch

Type: `boolean`

Watch files for changes and rerun tests related to changed files. If you want to re-run all tests when a file has changed, use the `--watchAll` option. (https://jestjs.io/docs/cli#--watch)

### watchAll

Type: `boolean`

Watch files for changes and rerun all tests when something changes. If you want to re-run only the tests that depend on the changed files, use the `--watch` option. (https://jestjs.io/docs/cli#--watchall)
