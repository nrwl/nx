# run-commands

Run commands

## Properties

### args

Type: `string`

Extra arguments. You can pass them as follows: ng run project:target --args='--wait=100'. You can them use {args.wait} syntax to interpolate them in angular.json

### parallel

Default: `true`

Type: `boolean`

Run commands in parallel

### readyWhen

Type: `string`

String to appear in stdout or stderr that indicates that the task is done. This option can only be used when parallel is set to true. If not specified, the task is done when all the child processes complete.
