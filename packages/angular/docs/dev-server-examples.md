##### Seving an application with a custom webpack configuration

This executor should be used along with `@nx/angular:webpack-browser` to serve an application using a custom webpack configuration.

Your `project.json` file should contain a `build` and `serve` target that matches the following:

```json
"build": {
    "executor": "@nx/angular:webpack-browser",
    "options": {
        ...
        "customWebpackConfig": {
          "path": "apps/appName/webpack.config.js"
        }
    }
},
"serve": {
    "executor": "@nx/angular:dev-server",
    "configurations": {
        "production": {
            "buildTarget": "appName:build:production"
        },
        "development": {
            "buildTarget": "appName:build:development"
        }
    },
    "defaultConfiguration": "development",
}
```
