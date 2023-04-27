# Using environment variables in Angular applications

Angular builders (e.g. `@nx/angular:webpack-browser` and `@angular-devkit/build-angular:browser`) don't have built-in support for using environment variables when building applications.

To add support for environment variables we need to use the webpack `DefinePlugin` in our own custom webpack configuration. We'll see how to do so in the following sections.

## A note on `NODE_ENV`

The webpack-based Angular builders (e.g. `@nx/angular:webpack-browser` and `@angular-devkit/build-angular:browser`) set the webpack's `mode` configuration option based on the values for the following in the builder options:

- `optimization`
- `optimization.scripts`
- `optimization.styles`
- `optimization.styles.minify`

If any of the above is set to `true`, webpack's `mode` is set to `production`. Otherwise, it's set to `development`.

By default, webpack automatically sets the `NODE_ENV` variable to the value of the `mode` configuration option. Therefore, Angular applications code have access to that environment variable at build time, but we can't change the `NODE_ENV` variable value directly as we would do with other environment variables because Angular always set the `mode` configuration option based on the above.

To change the `NODE_ENV` variable we can do one of the following:

- Turn on the builder optimizations to set it to `production`
- Turn off the builder optimizations to set it to `development`
- Use a custom webpack configuration to override the webpack `mode` set by Angular builders

The first two options is a matter of changing your build target configuration or passing the specific flag in the command line. We'll see how to do the last in the following section.

## Use a custom webpack configuration to support environment variables

First, install `@types/node` so we can use `process.env` in our code.

```shell
npm install --save-dev @types/node

# Or with yarn
yarn add --dev @types/node
```

Next, update the `build` and `serve` targets (in `project.json` or `angular.json` file), to the following.

```json lines
{
  "build": {
    // NOTE: change the executor to one that supports custom webpack config.
    "executor": "@nx/angular:webpack-browser",
    // snip
    "options": {
      // NOTE: This file needs to be created.
      "customWebpackConfig": {
        "path": "apps/myapp/webpack.config.js"
      }
      // snip
    }
  },
  "serve": {
    // NOTE: use dev-server that supports custom webpack config.
    "executor": "@nx/angular:webpack-dev-server"
    // snip
  }
}
```

Then, we can use `DefinePlugin` in our custom webpack.

```javascript {% fileName="apps/myapp/webpack.config.js" %}
const webpack = require('webpack');

function getClientEnvironment() {
  // Grab NX_* environment variables and prepare them to be injected
  // into the application via DefinePlugin in webpack configuration.
  const NX_APP = /^NX_/i;

  const raw = Object.keys(process.env)
    .filter((key) => NX_APP.test(key))
    .reduce((env, key) => {
      env[key] = process.env[key];
      return env;
    }, {});

  // Stringify all values so we can feed into webpack DefinePlugin
  return {
    'process.env': Object.keys(raw).reduce((env, key) => {
      env[key] = JSON.stringify(raw[key]);
      return env;
    }, {}),
  };
}

module.exports = (config, options, context) => {
  // Overwrite the mode set by Angular if the NODE_ENV is set
  config.mode = process.env.NODE_ENV || config.mode;
  config.plugins.push(new webpack.DefinePlugin(getClientEnvironment()));
  return config;
};
```

Now, when we define variables in our `.env` file, such as...

```text
# apps/myapp/.env
NX_API_URL=http://localhost:3333
```

Finally, We can use environment variables in our code. For example,

```typescript {% fileName="apps/myapp/src/main.ts" %}
import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';

if (process.env['NODE_ENV'] === 'production') {
  enableProdMode();
}

// This is defined in our .env file.
console.log('>>> NX_API_URL', process.env['NX_API_URL']);

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch((err) => console.error(err));
```

You should also update `tsconfig.apps.json` and `tsconfig.spec.json` files to include node types.

```json lines
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    // snip
    "types": ["node"]
  }
  // snip
}
```

## Using environment variables in `index.html`

While you cannot use variable in `index.html`, one workaround for this is to create different `index.*.html` files, such
as `index.prod.html`, then swap it in different environments.

For example in `project.json` (or `angular.json`),

```json lines {% fileName="project.json or angular.json" %}
{
  "build": {
    "executor": "@angular-devkit/build-angular:browser",
    // snip
    "configurations": {
      "production": {
        // snip
        "fileReplacements": [
          {
            "replace": "apps/myapp/src/environments/environment.ts",
            "with": "apps/myapp/src/environments/environment.prod.ts"
          },
          {
            "replace": "apps/myapp/src/index.html",
            "with": "apps/myapp/src/index.prod.html"
          }
        ]
      }
    }
  }
}
```

{% callout type="note" title="Optimize" %}
You can also customize your webpack configuration, similar to using `DefinePlugin` above. This approach will require post-processing the `index.html` file, and is out of scope for this guide.
{% /callout %}
