# Running Custom Commands

This recipe will show how to run any terminal command within the nx build-chain.

## Steps

##### 1. Define the terminal command to be run

The command we want to run for each project is:

```bash
make hello
```

With this `Makefile` in the root of the project:

```shell script
hello:
  echo "Hello, world!"
```

##### 2. Update `workspace.json`

For each project for which you want to enable `make`, add a target in `workspace.json`:

```json
// ...
"my-app": {
    "architect": {
        "make": {
            "builder": "@nrwl/workspace:run-commands",
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
}
```

For more information, see the [run-commands api doc](/{{framework}}/plugins/workspace/builders/run-commands).

##### 3. Trigger the builder from the terminal

To run the builder for a single project:

```bash
nx run my-app:make
```

To run the builder for all affected projects:

```bash
nx affected --target=make
```

For more information, see the [nx affected](/{{framework}}/cli/affected).
