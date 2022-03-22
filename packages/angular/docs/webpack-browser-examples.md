##### Using a custom webpack configuration

The executor supports providing a path to a custom webpack configuration. This allows you to customize how your Angular application is built. It currently supports the following types of webpack configurations:

- `object`
- `Function`
- `Promise<object|Function>`

The executor will merge the provided configuration with the webpack configuration that Angular Devkit uses. The merge order is:

- Angular Devkit Configuration
- Provided Configuration

To use a custom webpack configuration when building your Angular application, change the `build` target in your `project.json` to match the following:

```ts
"build": {
    "executor": "@nrwl/angular:webpack-browser",
    "options": {
        ...
        "customWebpackConfig": {
          "path": "apps/appName/webpack.config.js"
        }
    }
}
```

##### Incrementally Building your Application

The executor supports incrementally building your Angular application by building the workspace libraries it depends on _(that have been marked as buildable)_ and then building your application using the built source of the libraries.

This can improve build time as the building of the workspace libraries can be cached, meaning they only have to be rebuilt if they have changed.

> Note: There may be some additional overhead in the linking of the built libraries' sources which may reduce the overall improvement in build time. Therefore this approach only benefits large applications and would likely have a negative impact on small and medium applications.  
> You can read more about when to use incremental builds [here](/ci/incremental-builds#when-should-i-use-incremental-builds).

To allow your Angular application to take advantage of incremental building, change the `build` target in your `project.json` to match the following:

```ts
"build": {
    "executor": "@nrwl/angular:webpack-browser",
    "options": {
        ...
        "buildLibsFromSource": false
    }
}
```
