
  The @nx/nx plugin provides various executors to help you create and configure nx projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

### `noop`
An executor that does nothing.


### `run-commands`
Run any custom commands with Nx.

`project.json`:

```json
{
  // ...
  "targets": {
    //...
    "ls-project-root": {
      "executor": "nx:run-commands",
      "options": {
        "command": "ls apps/frontend/src"
      }
    }
  }
}
```

```shell
nx run frontend:ls-project-root
```

### Examples

###### Chaining commands

The `commands` option accepts as many commands as you want. By default, they all run in parallel.
You can run them sequentially by setting `parallel: false`:

```json
"create-script": {
    "executor": "nx:run-commands",
    "options": {
        "commands": [
          "mkdir -p apps/frontend/scripts",
          "touch apps/frontend/scripts/my-script.sh",
          "chmod +x apps/frontend/scripts/my-script.sh"
        ],
        "parallel": false
    }
}
```

###### Setting the cwd

By setting the `cwd` option, each command will run in the `apps/frontend` folder.

```json
"create-script": {
    "executor": "nx:run-commands",
    "options": {
        "cwd": "apps/frontend",
        "commands": [
          "mkdir -p scripts",
          "touch scripts/my-script.sh",
          "chmod +x scripts/my-script.sh"
        ],
        "parallel": false
    }
}
```

###### Interpolating Args

You can use custom arguments in your scripts with `{args.[someFlag]}`:

```json
"create-script": {
    "executor": "nx:run-commands",
    "options": {
        "cwd": "apps/frontend",
        "commands": [
          "mkdir -p scripts",
          "touch scripts/{args.name}.sh",
          "chmod +x scripts/{args.name}.sh"
        ],
        "parallel": false
    }
}
```

We run the above with:

```shell
nx run frontend:create-script --args="--name=example"
```

or simply with:

```shell
nx run frontend:create-script --name=example
```

###### Arguments forwarding

When interpolation is not present in the command, all arguments are forwarded to the command by default.

This is useful when you need to pass raw argument strings to your command.

For example, when you run:

```shell
nx run frontend:webpack --args="--config=example.config.js"
```

```json
"webpack": {
    "executor": "nx:run-commands",
    "options": {
        "command": "webpack"
    }
}
```

The above command will execute: `webpack --config=example.config.js`

This functionality can be disabled by using `commands` and expanding each `command` into an object
that sets the `forwardAllArgs` option to `false` as shown below:

```json
"webpack": {
    "executor": "nx:run-commands",
    "options": {
        "commands": [
            {
                "command": "webpack",
                "forwardAllArgs": false
            }
        ]
    }
}
```

###### Shorthand

When you only need to run a single command, you can use a shorthand for nx:run-commands:

```json
"webpack": {
    "command": "webpack"
}
```

###### Custom done conditions

Normally, `run-commands` considers the commands done when all of them have finished running. If you don't need to wait until they're all done, you can set a special string that considers the commands finished the moment the string appears in `stdout` or `stderr`:

```json
"finish-when-ready": {
    "executor": "nx:run-commands",
    "options": {
        "commands": [
            "sleep 5 && echo 'FINISHED'",
            "echo 'READY'"
        ],
        "readyWhen": "READY",
        "parallel": true
    }
}
```

```shell
nx run frontend:finish-when-ready
```

The above commands will finish immediately, instead of waiting for 5 seconds.

When we have multiple commands running in parallel, there is a possibility that we want to wait for more than 1 string to appear in stdout or stderr.
For example, imagine a case where we are running multiple commands to start multiple dev servers in parallel.

```json
"finish-when-multiple-ready": {
    "executor": "nx:run-commands",
    "options": {
        "commands": [
            "sleep $[ ( $RANDOM % 10 ) + 1 ] && echo 'READY1' && sleep 3600",
            "sleep $[ ( $RANDOM % 10 ) + 1 ] && echo 'READY2' && sleep 3600",
        ],
        "readyWhen": ["READY1", "READY2"],
        "parallel": true
    }
}
```

```shell
nx run frontend:finish-when-multiple-ready
```

The above commands will finish as soon as both the 1st and the 2nd command echoed "READY" (between 1 and 10 seconds), instead of waiting for the extra hour.

###### Nx Affected

The true power of `run-commands` comes from the fact that it runs through `nx`, which knows about your project graph. So you can run **custom commands** only for the projects that have been affected by a change.

We can create some configurations to generate docs, and if run using `nx affected`, it will only generate documentation for the projects that have been changed:

```shell
nx affected --target=generate-docs
```

```json
//...
"frontend": {
    "targets": {
        //...
        "generate-docs": {
            "executor": "nx:run-commands",
            "options": {
                "command": "npx compodoc -p apps/frontend/tsconfig.app.json"
            }
        }
    }
},
"api": {
    "targets": {
        //...
        "generate-docs": {
            "executor": "nx:run-commands",
            "options": {
                "command":  "npx compodoc -p apps/api/tsconfig.app.json"
            }
        }
    }
}
```

---
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `__unparsed__` | array |  |  |
| `args` | string | Extra arguments. You can pass them as follows: nx run project:target --args='--wait=100'. You can then use {args.wait} syntax to interpolate them in the workspace config file. See example [above](#chaining-commands-interpolating-args-and-setting-the-cwd) |  |
| `color` | boolean | Use colors when showing output of command. | `false` |
| `command` | string | Command to run in child process. |  |
| `commands` | array | Commands to run in child process. |  |
| `cwd` | string | Current working directory of the commands. If it's not specified the commands will run in the workspace root, if a relative path is specified the commands will run in that path relative to the workspace root and if it's an absolute path the commands will run in that path. |  |
| `env` | object | Environment variables that will be made available to the commands. This property has priority over the `.env` files. |  |
| `envFile` | string | You may specify a custom .env file path. |  |
| `forwardAllArgs` | boolean | Whether arguments should be forwarded when interpolation is not present. | `true` |
| `parallel` | boolean | Run commands in parallel. | `true` |
| `readyWhen` | string | String or array of strings to appear in `stdout` or `stderr` that indicate that the task is done. When running multiple commands, this option can only be used when `parallel` is set to `true`. If not specified, the task is done when all the child processes complete. |  |
| `tty` | boolean | Whether commands should be run with a tty terminal |  |

### `run-script`
Run any NPM script of a project in the project's root directory.

`project.json`:

```json
"targets": {
    "build": {
        "executor": "nx:run-script",
        "options": {
            "script": "build-my-project"
        }
    }
}
```

```shell
nx run frontend:build
```

The `build` target is going to run `npm run build-my-project` (or `yarn build-my-project`) in the `packages/frontend` directory.

##### Caching Artifacts

By default, Nx is going to cache `dist/packages/frontend`, `packages/frontend/dist`, `packages/frontend/build`, `packages/frontend/public`. If your npm script writes files to other places, you can override the list of cached outputs as follows:

```json
"targets": {
    "build": {
        "executor": "nx:run-script",
        "outputs": ["{projectRoot}/dist", "{projectRoot}/docs"],
        "options": {
            "script": "build-my-project"
        }
    }
}
```
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `script` | string [**required**] | An npm script name in the `package.json` file of the project (e.g., `build`). |  |
| `__unparsed__` | array |  |  |
