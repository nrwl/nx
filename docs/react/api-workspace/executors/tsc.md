# @nrwl/workspace:tsc

Build a project using TypeScript.

Options can be configured in `workspace.json` when defining the executor, or when invoking it.
Read more about how to use executors and the CLI here: https://nx.dev/react/getting-started/nx-cli#running-tasks.

## Options

### main (_**required**_)

Type: `string`

The name of the main entry-point file.

### outputPath (_**required**_)

Type: `string`

The output path of the generated files.

### tsConfig (_**required**_)

Type: `string`

The path to the Typescript configuration file.

### assets

Type: `array`

List of static assets.
