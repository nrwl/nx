# export

Export a Next.js app. The exported application is located at dist/$outputPath/exported.

Options can be configured in `angular.json` when defining the executor, or when invoking it.

## Options

### buildLibsFromSource

Default: `true`

Type: `boolean`

Read buildable libraries from source instead of building them separately.

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
