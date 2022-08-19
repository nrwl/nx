# Using environment variables in Angular applications

By default, Angular only provides the `NODE_ENV` variable when building the application. You may use `process.env.NODE_ENV`
anywhere in your TS/JS source, and the build will inline this value in the output chunks.

Other variables, such as those prefixed by `NX_` will not work in Angular. To add support for other environment variables,
do the following.

First, install `@types/node` so we can use `process.env` in our code.

```bash
npm install --save-dev @types/node

# Or with yarn
yarn add --dev @types/node
```

Next, update the `build` and `serve` targets (in `project.json` or `angular.json` file), to the following.

```json lines
{
  "build": {
    // NOTE: change the executor to one that supports custom webpack config.
    "executor": "@nrwl/angular:webpack-browser",
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
    "executor": "@nrwl/angular:webpack-server"
    // snip
  }
}
```

Then, we can use `DefinePlugin` in our custom webpack.

```javascript
// apps/myapp/webpack.config.js
const webpack = require('webpack');

function getClientEnvironment(configuration) {
  // Grab NODE_ENV and NX_* environment variables and prepare them to be
  // injected into the application via DefinePlugin in webpack configuration.
  const NX_APP = /^NX_/i;

  const raw = Object.keys(process.env)
    .filter((key) => NX_APP.test(key))
    .reduce(
      (env, key) => {
        env[key] = process.env[key];
        return env;
      },
      {
        NODE_ENV: process.env.NODE_ENV || configuration,
      }
    );

  // Stringify all values so we can feed into webpack DefinePlugin
  return {
    'process.env': Object.keys(raw).reduce((env, key) => {
      env[key] = JSON.stringify(raw[key]);
      return env;
    }, {}),
  };
}

module.exports = (config, options, context) => {
  config.plugins.push(
    new webpack.DefinePlugin(getClientEnvironment(context.configuration))
  );
  return config;
};
```

Now, when we define variables in our `.env` file, such as...

```text
# apps/myapp/.env
NX_API_URL=http://localhost:3333
```

Finally, We can use environment variables in our code. For example,

```typescript
// apps/myapp/src/main.ts
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

```json lines
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
