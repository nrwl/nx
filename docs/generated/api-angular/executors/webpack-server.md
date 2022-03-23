---
title: '@nrwl/angular:webpack-server executor'
description: 'The webpack-server executor is very similar to the standard dev server builder provided by the Angular Devkit. It is usually used in tandem with `@nrwl/angular:webpack-browser` when your Angular application uses a custom webpack configuration.'
---

# @nrwl/angular:webpack-server

The webpack-server executor is very similar to the standard dev server builder provided by the Angular Devkit. It is usually used in tandem with `@nrwl/angular:webpack-browser` when your Angular application uses a custom webpack configuration.

Options can be configured in `workspace.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/configuration/projectjson#targets.

## Examples

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

## Options

### browserTarget (_**required**_)

Type: `string`

A browser builder target to serve in the format of `project:target[:configuration]`. You can also pass in more than one configuration name as a comma-separated list. Example: `project:target:production,staging`.

### allowedHosts

Type: `array`

List of hosts that are allowed to access the dev server.

### disableHostCheck

Default: `false`

Type: `boolean`

Don't verify connected clients are part of allowed hosts.

### hmr

Default: `false`

Type: `boolean`

Enable hot module replacement.

### host

Default: `localhost`

Type: `string`

Host to listen on.

### liveReload

Default: `true`

Type: `boolean`

Whether to reload the page on change, using live-reload.

### open

Alias(es): o

Default: `false`

Type: `boolean`

Opens the url in default browser.

### poll

Type: `number`

Enable and define the file watching poll time period in milliseconds.

### port

Default: `4200`

Type: `number`

Port to listen on.

### proxyConfig

Type: `string`

Proxy configuration file. For more information, see https://angular.io/guide/build#proxying-to-a-backend-server.

### publicHost

Type: `string`

The URL that the browser client (or live-reload client, if enabled) should use to connect to the development server. Use for a complex dev server setup, such as one with reverse proxies.

### servePath

Type: `string`

The pathname where the app will be served.

### ssl

Default: `false`

Type: `boolean`

Serve using HTTPS.

### sslCert

Type: `string`

SSL certificate to use for serving HTTPS.

### sslKey

Type: `string`

SSL key to use for serving HTTPS.

### verbose

Type: `boolean`

Adds more details to output logging.

### watch

Default: `true`

Type: `boolean`

Rebuild on change.
