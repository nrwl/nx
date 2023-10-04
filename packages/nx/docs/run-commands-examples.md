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

```bash
nx run frontend:ls-project-root
```

## Examples

{% tabs %}
{% tab label="Chaining commands" %}

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

{% /tab %}
{% tab label="Setting the cwd" %}

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

{% /tab %}
{% tab label="Interpolating Args" %}

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

```bash
nx run frontend:create-script --args="--name=example"
```

or simply with:

```bash
nx run frontend:create-script --name=example
```

{% /tab %}
{% tab label="Arguments forwarding" %}
When interpolation is not present in the command, all arguments are forwarded to the command by default.

This is useful when you need to pass raw argument strings to your command.

For example, when you run:

```bash
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

{% /tab %}
{% tab label="Shorthand" %}
When you only need to run a single command, you can use a shorthand for nx:run-commands:

```json
"webpack": {
    "command": "webpack"
}
```

{% /tab %}
{% tab label="Custom done conditions" %}

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

```bash
nx run frontend:finish-when-ready
```

The above commands will finish immediately, instead of waiting for 5 seconds.
{% /tab %}
{% tab label="Nx Affected" %}

The true power of `run-commands` comes from the fact that it runs through `nx`, which knows about your project graph. So you can run **custom commands** only for the projects that have been affected by a change.

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

{% /tab %}
{% /tabs %}

---
