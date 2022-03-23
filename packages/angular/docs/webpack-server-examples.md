##### Seving an application with a custom webpack configuration

This executor should be used along with `@nrwl/angular:webpack-browser` to serve an application using a custom webpack configuration.

Your `project.json` file should contain a `build` and `serve` target that matches the following:

```json
"build": {
    "executor": "@nrwl/angular:webpack-browser",
    "options": {
        ...
        "customWebpackConfig": {
          "path": "apps/appName/webpack.config.js"
        }
    }
},
"serve": {
    "executor": "@nrwl/angular:webpack-server",
    "configurations": {
        "production": {
            "browserTarget": "appName:build:production"
        },
        "development": {
            "browserTarget": "appName:build:development"
        }
    },
    "defaultConfiguration": "development",
}
```
