# run-commands

Run any custom commands with Nx

Properties can be configured in workspace.json when defining the executor, or when invoking it.
Read more about how to use executors and the CLI here: https://nx.dev/react/getting-started/cli-overview#running-tasks.

## Examples

`workspace.json`:

```json
//...
"frontend": {
    "architect": {
        //...
        "ls-project-root": {
            "builder": "@nrwl/workspace:run-commands",
            "options": {
                "command": "ls apps/frontend/src"
            }
        }
    }
}
```

```bash
nx run frontend:ls-project-root
```

##### Chaining commands, interpolating args and setting the cwd

Let's say each of our workspace projects has some custom bash scripts in a `scripts` folder.
We want a simple way to create empty bash script files for a given project, that have the execute permissions already set.

Given that Nx knows our workspace structure, we should be able to give it a project and the name of our script, and it should take care of the rest.

The `commands` option accepts as many commands as you want. By default, they all run in parallel.
You can run them sequentially by setting `parallel: false`:

```json
"create-script": {
    "builder": "@nrwl/workspace:run-commands",
    "options": {
        "commands": [
          "mkdir -p scripts",
          "touch scripts/{args.name}.sh",
          "chmod +x scripts/{args.name}.sh"
        ],
        "cwd": "apps/frontend",
        "parallel": false
    }
}
```

By setting the `cwd` option, each command will run in the `apps/frontend` folder.

We run the above with:

```bash
nx run frontend:create-script --args="--name=example"
```

or simply with:

```bash
nx run frontend:create-script --name=example
```

##### Arguments forwarding

When interpolation is not present in the command, all arguments are forwarded to the command by default.

This is useful when you need to pass raw argument strings to your command.

For example, when you run:

nx run frontend:webpack --args="--config=example.config.js"

```json
"webpack": {
    "builder": "@nrwl/workspace:run-commands",
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
    "builder": "@nrwl/workspace:run-commands",
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

##### Custom **done** conditions

Normally, `run-commands` considers the commands done when all of them have finished running. If you don't need to wait until they're all done, you can set a special string, that considers the command finished the moment the string appears in `stdout` or `stderr`:

```json
"finish-when-ready": {
    "builder": "@nrwl/workspace:run-commands",
    "options": {
        "command": "echo 'READY' && sleep 5 && echo 'FINISHED'",
        "readyWhen": "READY"
    }
}
```

```bash
nx run frontend:finish-when-ready
```

The above command will finish immediately, instead of waiting for 5 seconds.

##### Nx Affected

The true power of `run-commands` comes from the fact that it runs through `nx`, which knows about your dependency graph. So you can run **custom commands** only for the projects that have been affected by a change.

We can create some configurations to generate docs, and if run using `nx affected`, it will only generate documentation for the projects that have been changed:

```bash
nx affected --target=generate-docs
```

```json
//...
"frontend": {
    "architect": {
        //...
        "generate-docs": {
            "builder": "@nrwl/workspace:run-commands",
            "options": {
                "command": "npx compodoc -p apps/frontend/tsconfig.app.json"
            }
        }
    }
},
"api": {
    "architect": {
        //...
        "generate-docs": {
            "builder": "@nrwl/workspace:run-commands",
            "options": {
                "command":  "npx compodoc -p apps/api/tsconfig.app.json"
            }
        }
    }
}
```

## Properties

### args

Type: `string`

Extra arguments. You can pass them as follows: nx run project:target --args='--wait=100'. You can then use {args.wait} syntax to interpolate them in the workspace config file. See example [above](#chaining-commands-interpolating-args-and-setting-the-cwd)

### color

Default: `false`

Type: `boolean`

Use colors when showing output of command

### command

Type: `string`

Command to run in child process

### commands

Type: `array`

### cwd

Type: `string`

Current working directory of the commands.

### envFile

Type: `string`

You may specify a custom .env file path

### outputPath

Type: `string | string[] `

Allows you to specify where the build artifacts are stored. This allows Nx Cloud to pick them up correctly, in the case that the build artifacts are placed somewhere other than the top level dist folder.

### parallel

Default: `true`

Type: `boolean`

Run commands in parallel

### readyWhen

Type: `string`

String to appear in stdout or stderr that indicates that the task is done. This option can only be used when parallel is set to true. If not specified, the task is done when all the child processes complete.
