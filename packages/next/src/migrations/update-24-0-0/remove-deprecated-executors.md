#### Convert `@nx/next` build and server targets to inferred tasks

Nx 24 removes the `@nx/next:build` and `@nx/next:server` executors and their `@nrwl` aliases. The migration registers `@nx/next/plugin` in `nx.json` and converts the targets that use those executors to inferred tasks. It moves build options into `next.config.*`. A target with nothing left to override is removed from project configuration. When several projects share the same remaining options, those options move to a `targetDefaults` entry scoped to the plugin. `targetDefaults` entries keyed by a removed executor are removed once no target uses that executor.

The migration lists the targets the converter cannot convert safely. In agentic runs, an AI prompt finishes them and validates the project graph.

#### Sample code changes

##### Before

```json title="apps/my-app/project.json"
{
  "name": "my-app",
  "targets": {
    "build": {
      "executor": "@nx/next:build",
      "defaultConfiguration": "production",
      "options": {
        "outputPath": "dist/apps/my-app"
      },
      "configurations": {
        "development": {
          "outputPath": "apps/my-app"
        },
        "production": {}
      }
    },
    "serve": {
      "executor": "@nx/next:server",
      "defaultConfiguration": "development",
      "options": {
        "dev": true,
        "port": 4200
      },
      "configurations": {
        "development": {
          "buildTarget": "my-app:build:development",
          "dev": true
        },
        "production": {
          "buildTarget": "my-app:build:production",
          "dev": false
        }
      }
    }
  }
}
```

##### After

```json title="apps/my-app/project.json"
{
  "name": "my-app",
  "targets": {
    "build": {
      "configurations": {
        "development": {}
      }
    },
    "serve": {
      "configurations": {
        "development": {},
        "production": {}
      },
      "defaultConfiguration": "development",
      "options": {
        "port": 4200
      }
    }
  }
}
```

```json title="nx.json"
{
  "plugins": [
    {
      "plugin": "@nx/next/plugin",
      "options": {
        "buildTargetName": "build",
        "devTargetName": "serve",
        "serveStaticTargetName": "serve-static",
        "startTargetName": "start"
      }
    }
  ]
}
```
