# Running Custom Commands

This recipe will show how to run any terminal command within the nx build-chain.

## Steps

##### 1. Define the terminal command to be run

The command we want to run for each project is:

```bash
make hello
```

With this `Makefile` in the root of the project:

```bash
hello:
  echo "Hello, world!"
```

##### 2. Update `project.json`

For each project for which you want to enable `make`, add a target in its `project.json`:

```json
// ...
"targets": {
    "make": {
        "executor": "@nrwl/workspace:run-commands",
            "options": {
            "commands": [
                {
                    "command": "make hello"
                }
            ]
        }
    }
    // ...
}
```

For more information, see the [run-commands api doc](/workspace/run-commands-executor).

##### 3. Trigger the executor from the terminal

To run the executor for a single project:

```bash
nx run my-app:make
```

To run the executor for all affected projects:

```bash
nx affected --target=make
```

For more information, see the [nx affected](/cli/affected).
