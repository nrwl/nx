#### Convert `@nx/rspack` build and dev-server targets to inferred tasks

Nx 24 removes the `@nx/rspack:rspack` and `@nx/rspack:dev-server` executors and their `@nrwl` aliases. The migration registers `@nx/rspack/plugin` in `nx.json` and converts the targets that use those executors to inferred tasks. It moves the executor options into `rspack.config.*`. A target with nothing left to override is removed from project configuration. When several projects share the same remaining options, those options move to a `targetDefaults` entry scoped to the plugin. `targetDefaults` entries keyed by a removed executor are removed once no target uses that executor.

The migration lists the targets the converter cannot convert safely. In agentic runs, an AI prompt finishes them and validates the project graph.

The `@nx/rspack:ssr-dev-server` executor and the Module Federation executors stay.

#### Sample code changes

The example shows the `build` target. Its options move into `rspack.config.*`, so only the configuration names stay on the target.

##### Before

```json title="apps/app1/project.json"
{
  "name": "app1",
  "targets": {
    "build": {
      "executor": "@nx/rspack:rspack",
      "options": {
        "rspackConfig": "apps/app1/rspack.config.js",
        "outputPath": "dist/apps/app1",
        "index": "apps/app1/src/index.html",
        "main": "apps/app1/src/main.tsx",
        "tsConfig": "apps/app1/tsconfig.app.json",
        "assets": ["apps/app1/src/favicon.ico", "apps/app1/src/assets"],
        "styles": ["apps/app1/src/styles.scss"],
        "scripts": []
      },
      "configurations": {
        "development": {
          "extractLicenses": false,
          "optimization": false,
          "sourceMap": true,
          "vendorChunk": true
        },
        "production": {
          "fileReplacements": [
            {
              "replace": "apps/app1/src/environments/environment.ts",
              "with": "apps/app1/src/environments/environment.prod.ts"
            }
          ],
          "optimization": true,
          "outputHashing": "all",
          "sourceMap": false,
          "namedChunks": false,
          "extractLicenses": true,
          "vendorChunk": false
        }
      },
      "defaultConfiguration": "production"
    }
  }
}
```

##### After

```json title="apps/app1/project.json"
{
  "name": "app1",
  "targets": {
    "build": {
      "configurations": {
        "development": {},
        "production": {}
      },
      "defaultConfiguration": "production"
    }
  }
}
```

```json title="nx.json"
{
  "plugins": [
    {
      "plugin": "@nx/rspack/plugin",
      "options": {
        "buildTargetName": "build",
        "previewTargetName": "preview",
        "serveStaticTargetName": "serve-static",
        "serveTargetName": "serve"
      }
    }
  ]
}
```
