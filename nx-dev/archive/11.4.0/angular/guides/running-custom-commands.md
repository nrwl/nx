# Running Custom Commands

[Compodoc](https://compodoc.app/) is a great tool for automatically generating documentation for Angular projects. In order to use it, you need to run a simple command in the terminal.

This recipe will show how to run any terminal command within the nx build-chain using Compodoc as an example.

## Steps

##### 1. Define the terminal command to be run

The command we want to run for each project is:

```bash
compodoc -p [path/to/tsconfig.json]
```

##### 2. Update `angular.json`

For each project for which you want to enable compodoc, add a target in `angular.json`:

```json
// ...
"my-app": {
    "architect": {
        "compodoc": {
            "builder": "@nrwl/workspace:run-commands",
                "options": {
                "commands": [
                    {
                        "command": "npx compodoc -p apps/my-app/tsconfig.app.json"
                    }
                ]
            }
        }
        // ...
    }
}
```

For more information, see the [run-commands api doc](/{{framework}}/workspace/run-commands-executor).

Note: Replace `apps/my-app/tsconfig.app.json` with the appropriate `tsconfig.json` path for each project.

##### 3. Trigger the builder from the terminal

To run the builder for a single project:

```bash
nx run my-app:compodoc
```

To run the builder for all affected projects:

```bash
nx affected --target=compodoc
```

For more information, see the [nx affected](/{{framework}}/cli/affected).
