# run-commands

Run commands

## Properties

### parallel

Default: `true`

Type: `boolean`

Run commands in parallel

### readyWhen

Type: `string`

String to appear in stdout or stderr that indicates that the task is done. This option can only be used when parallel is set to true. If not specified, the task is one when all the child processes complete.
