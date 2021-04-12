# export

Export a Next.js app. The exported application is located at dist/\$outputPath/exported.

Builder properties can be configured in workspace.json when defining the builder, or when invoking it.
Read more about how to use builders and the CLI here: https://nx.dev/react/guides/cli.

## Properties

### buildTarget

Type: `string`

Target which builds the application

### silent

Default: `false`

Type: `boolean`

Hide progress or not (default is false)

### threads

Type: `number`

Number of worker threads to utilize (defaults to the number of CPUs)
