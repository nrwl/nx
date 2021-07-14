# tsc

Build a project using TypeScript.

Properties can be configured in workspace.json when defining the executor, or when invoking it.
Read more about how to use executors and the CLI here: https://nx.dev/node/getting-started/nx-cli#running-tasks.

## Properties

### assets

Type: `array`

List of static assets.

### main

Type: `string`

The name of the main entry-point file.

### outputPath

Type: `string`

The output path of the generated files.

### tsConfig

Type: `string`

The path to the Typescript configuration file.
