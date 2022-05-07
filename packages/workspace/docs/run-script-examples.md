`workspace.json`:

```json
"frontend": {
    "root": "packages/frontend",
    "targets": {
        "build": {
            "executor": "nx:run-script",
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
            "executor": "nx:run-script",
            "outputs": ["packages/frontend/dist", "packaged/frontend/docs"],
            "options": {
                "script": "build-my-project"
            }
        }
    }
}
```
