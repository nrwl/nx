# export

Export a Next.js app. The exported application is located at dist/$outputPath/exported.

Properties can be configured in angular.json when defining the executor, or when invoking it.

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
