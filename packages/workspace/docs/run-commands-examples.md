`workspace.json`:

```json
//...
"frontend": {
    "targets": {
        //...
        "ls-project-root": {
            "executor": "@nrwl/workspace:run-commands",
            "options": {
                "command": "ls apps/frontend/src"
            }
        }
    }
}
```

```bash
<%= cli %> run frontend:ls-project-root
```

##### Chaining commands, interpolating args and setting the cwd

Let's say each of our workspace projects has some custom bash scripts in a `scripts` folder.
We want a simple way to create empty bash script files for a given project, that have the execute permissions already set.

Given that Nx knows our workspace structure, we should be able to give it a project and the name of our script, and it should take care of the rest.

The `commands` option accepts as many commands as you want. By default, they all run in parallel.
You can run them sequentially by setting `parallel: false`:

```json
"create-script": {
    "executor": "@nrwl/workspace:run-commands",
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
<%= cli %> run frontend:create-script --args="--name=example"
```

or simply with:

```bash
<%= cli %> run frontend:create-script --name=example
```

##### Arguments forwarding

When interpolation is not present in the command, all arguments are forwarded to the command by default.

This is useful when you need to pass raw argument strings to your command.

For example, when you run:

<%= cli %> run frontend:webpack --args="--config=example.config.js"

```json
"webpack": {
    "executor": "@nrwl/workspace:run-commands",
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
    "executor": "@nrwl/workspace:run-commands",
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

Normally, `run-commands` considers the commands done when all of them have finished running. If you don't need to wait until they're all done, you can set a special string that considers the commands finished the moment the string appears in `stdout` or `stderr`:

```json
"finish-when-ready": {
    "executor": "@nrwl/workspace:run-commands",
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

```bash
<%= cli %> run frontend:finish-when-ready
```

The above commands will finish immediately, instead of waiting for 5 seconds.

##### Custom **done** conditions per command and waiting for other commands

Additionally, each command can specify a prior command to wait for using the `waitUntilCommand` property. This can be combined with individual commands having a `readyWhen` condition set to orchestrate some complex scenarios, such as waiting for your API to be stable and serving traffic before starting the web app.

```json
"serve-with-api": {
    "executor": "@nrwl/workspace:run-commands",
    "options": {
        "commands": [
            {
                "name": "serveApi",
                "command": "nx serve nest-api",
                "readyWhen": "No issues found."
            },
            {
                "name": "waitForApi",
                "command": "ECHO 'Waiting for API...' && until curl --silent https://my-api:3333/api/health-check | grep 'OK'; do sleep 0.5; echo '  performing health check...'; done;",
                "waitUntilCommand": "serveApi"
            },
            {
                "command": "nx serve react-app-vitejs",
                "waitUntilCommand": "waitForApi"
            }
        ]
    }
},
```

```bash
<%= cli %> run frontend:serve-with-api
```

##### Nx Affected

The true power of `run-commands` comes from the fact that it runs through `nx`, which knows about your dependency graph. So you can run **custom commands** only for the projects that have been affected by a change.

We can create some configurations to generate docs, and if run using `nx affected`, it will only generate documentation for the projects that have been changed:

```bash
nx affected --target=generate-docs
```

```json
//...
"frontend": {
    "targets": {
        //...
        "generate-docs": {
            "executor": "@nrwl/workspace:run-commands",
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
            "executor": "@nrwl/workspace:run-commands",
            "options": {
                "command":  "npx compodoc -p apps/api/tsconfig.app.json"
            }
        }
    }
}
```
