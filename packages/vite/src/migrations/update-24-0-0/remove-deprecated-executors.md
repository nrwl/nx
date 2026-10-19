#### Convert `@nx/vite` and `@nx/vitest:test` targets to inferred tasks

Nx 24 removes the `@nx/vite:build`, `@nx/vite:dev-server` and `@nx/vite:preview-server` executors and their `@nrwl` aliases. The migration registers `@nx/vite/plugin` in `nx.json` and converts the targets that use those executors to inferred tasks. It moves build options into `vite.config.*`. It also converts `@nx/vitest:test` targets with the `@nx/vitest` converter, because `@nx/vitest` can be installed only as a transitive dependency and its own migration may not run. A target with nothing left to override is removed from project configuration. When several projects share the same remaining options, those options move to a `targetDefaults` entry scoped to the plugin. `targetDefaults` entries keyed by a removed executor are removed once no target uses that executor.

The migration lists the targets the converter cannot convert safely. In agentic runs, an AI prompt finishes them and validates the project graph.

#### Sample code changes

The `serve` and `preview` targets have no options that differ from the inferred targets, so they are removed.

##### Before

```json title="myapp/project.json"
{
  "name": "myapp",
  "targets": {
    "build": {
      "executor": "@nx/vite:build",
      "outputs": ["{workspaceRoot}/dist/myapp"],
      "options": {
        "configFile": "myapp/vite.config.ts"
      }
    },
    "serve": {
      "executor": "@nx/vite:dev-server",
      "options": {
        "buildTarget": "myapp:build"
      }
    },
    "preview": {
      "executor": "@nx/vite:preview-server",
      "options": {
        "buildTarget": "myapp:build"
      }
    }
  }
}
```

##### After

```json title="myapp/project.json"
{
  "name": "myapp",
  "targets": {
    "build": {
      "options": {
        "config": "./vite.config.ts"
      }
    }
  }
}
```

```json title="nx.json"
{
  "plugins": [
    {
      "plugin": "@nx/vite/plugin",
      "options": {
        "buildTargetName": "build",
        "devTargetName": "dev",
        "previewTargetName": "preview",
        "serveStaticTargetName": "serve-static",
        "serveTargetName": "serve",
        "typecheckTargetName": "typecheck"
      }
    }
  ]
}
```
