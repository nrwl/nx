# run-commands

Run commands

Builder properties can be configured in workspace.json when defining the builder, or when invoking it.
Read more about how to use builders and the CLI here: https://nx.dev/react/guides/cli.

## Properties

### args

Type: `string`

Extra arguments. You can pass them as follows: ng run project:target --args='--wait=100'. You can them use {args.wait} syntax to interpolate them in the workspace config file.

### color

Default: `false`

Type: `boolean`

Use colors when showing output of command

### commands

Type: `array` of `object`

#### command

Type: `string`

Command to run in child process

### parallel

Default: `true`

Type: `boolean`

Run commands in parallel

### readyWhen

Type: `string`

String to appear in stdout or stderr that indicates that the task is done. This option can only be used when parallel is set to true. If not specified, the task is done when all the child processes complete.
