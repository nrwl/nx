# run-commands

Run commands

### Properties

| Name        | Description                                                                                                                                                                                                    | Type    | Default value |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------- |
| `parallel`  | Run commands in parallel                                                                                                                                                                                       | boolean | `true`        |
| `readyWhen` | String to appear in stdout or stderr that indicates that the task is done. This option can only be used when parallel is set to true. If not specified, the task is one when all the child processes complete. | string  | `undefined`   |
