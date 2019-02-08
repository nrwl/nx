# node-execute

Execute a Node application

### Properties

| Name               | Description                                        | Type   | Default value |
| ------------------ | -------------------------------------------------- | ------ | ------------- |
| `buildTarget`      | The target to run to build you the app             | string | `undefined`   |
| `waitUntilTargets` | The targets to run to before starting the node app | array  | `undefined`   |
| `port`             | The port to inspect the process on                 | number | `7777`        |
| `inspect`          | Ensures the app is starting with debugging         | string | `inspect`     |
| `args`             | Extra args when starting the app                   | array  | `undefined`   |
