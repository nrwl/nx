# @nrwl/workspace:run-script

Run an npm script using Nx

Options can be configured in `angular.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/core-concepts/configuration#targets.

## Examples

`workspace.json`:

```json
"frontend": {
    "root": "packages/frontend",
    "targets": {
        "build": {
            "executor": "@nrwl/workspace:run-script",
            "options": {
                "script": "build-my-project"
            }
        }
    }
}
```

```bash
nx run frontend:build
```

The `build` target is going to run `npm run build-my-project` (or `yarn build-my-project`) in the `packages/frontend` directory.

#### Caching Artifacts

By default, Nx is going to cache `dist/packages/frontend`, `packages/frontend/dist`, `packages/frontend/build`, `packages/frontend/public`. If your npm script writes files to other places, you can override the list of cached outputs as follows:

```json
"frontend": {
    "root": "packages/frontend",
    "targets": {
        "build": {
            "executor": "@nrwl/workspace:run-script",
            "outputs": ["packages/frontend/dist", "packaged/frontend/docs"],
            "options": {
                "script": "build-my-project"
            }
        }
    }
}
```

## Options

### script (_**required**_)

Type: `string`

An npm script name in the package.json file of the project (e.g., build)
