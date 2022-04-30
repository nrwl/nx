# Environment Variables

Environment variables are global system variables accessible by all the processes running under the Operating System (OS).
Environment variables are useful to store system-wide values such as the directories to search for executable programs
(PATH), OS version, Network Information, and custom variables. These env variables are passed at build time and used at
the runtime of an app.

This guide is divided into two sections:

1. [Setting environment variables](#setting-environment-variables)
2. Using environment variables in [React](#using-environment-variables-in-react-applications) and
   [Angular](#using-environment-variables-in-angular-applications)

## Setting environment variables

By default, Nx will load any environment variables you place in the following files:

1. `apps/my-app/.local.env`
2. `apps/my-app/.env.local`
3. `apps/my-app/.env`
4. `.local.env`
5. `.env.local`
6. `.env`

**Note:** Order is important. Nx will move through the above list, ignoring files it can't find, and loading environment variables
into the current process for the ones it can find. If it finds a variable that has already been loaded into the process,
it will ignore it. It does this for two reasons:

1. Developers can't accidentally overwrite important system level variables (like `NODE_ENV`)
2. Allows developers to create `.env.local` or `.local.env` files for their local environment and override any project
   defaults set in `.env`

For example:

1. `apps/my-app/.env.local` contains `NX_API_URL=http://localhost:3333`
2. `apps/my-app/.env` contains `NX_API_URL=https://api.example.com`
3. Nx will first load the variables from `apps/my-app/.env.local` into the process. When it tries to load the variables
   from `apps/my-app/.env`, it will notice that `NX_API_URL` already exists, so it will ignore it.

We recommend nesting your **app** specific `env` files in `apps/your-app`, and creating workspace/root level `env` files
for workspace-specific settings (like the [Nx Cloud token](/using-nx/caching#distributed-computation-caching)).

### Pointing to custom env files

If you want to load variables from `env` files other than the ones listed above:

1. Use the [env-cmd](https://www.npmjs.com/package/env-cmd) package: `env-cmd -f .qa.env nx serve`
2. Use the `envFile` option of the [run-commands](/workspace/run-commands-executor#envfile) builder and execute your command inside of the builder

### Ad-hoc variables

You can also define environment variables in an ad-hoc manner using support from your OS and shell.

**Unix systems**

In Unix systems, we need to set the environment variables before calling a command.

Let's say that we want to define an API URL for the application to use:

```bash
NX_API_URL=http://localhost:3333 nx build myapp
```

**Windows (cmd.exe)**

```bash
set "NX_API_URL=http://localhost:3333" && nx build myapp
```

**Windows (Powershell)**

```bash
($env:NX_API_URL = "http://localhost:3333") -and (nx build myapp)
```

## Using environment variables

Handling of environment variables can differ between Nx plugins. For [React applications](#environment-variables-in-react-applications),
usage of variables in TS/JS files and `index.html` is automatically included in the build process; whereas in
[Angular applications](#environment-variables-in-angular-applications), environment variables require extra setup to use,
and by default Angular encourages using `environment.*.ts` files in combination with `fileReplacement` option during build.

### Using environment variables in React applications

In React applications (e.g. those using `@nrwl/web:webpack` or `@nrwl/next:build` executors for `build` target), Nx
includes the following variables in the build process:

- `NODE_ENV`
- Variables prefixed with `NX_`, such as `NX_CUSTOM_VAR`

Defining environment variables can vary between OSes. It's also important to know that this is temporary for the life of
the shell session.

#### Using environment variables in `index.html`

Nx supports interpolating environment variables into your `index.html` file for React and Web applications.

To interpolate an environment variable named `NX_DOMAIN_NAME` into your `index.html`, surround it with `%` symbols like so:

```html
<html>
  <body>
    <p>The domain name is %NX_DOMAIN_NAME%.</p>
  </body>
</html>
```

### Using environment variables in Angular applications

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

#### Using environment variables in `index.html`

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

> You can also customize your webpack configuration, similar to using `DefinePlugin` above. This approach will require
> post-processing the `index.html` file, and is out of scope for this guide.

## Summary

Nx supports setting environment variables from env files in your projects and workspace root. If there are multiple env
files, then the values from the application (e.g. `<root>/apps/myapp/.env`) takes precedence over the values from workspace
(e.g. `<root>/.env`). You can also set local overrides in `.env.local` or `.local.env` files.

Usage of environment variables different between React and Angular applications, so make sure your usage matches the
support from each Framework.
