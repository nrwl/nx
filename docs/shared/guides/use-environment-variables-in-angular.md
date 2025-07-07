---
title: Using Environment Variables in Angular Applications
description: Learn how to configure and use environment variables in Angular applications with Nx, including setup for ESBuild and TypeScript type definitions.
---

# Using environment variables in Angular applications

## For Angular applications using ESBuild

### Setting the `define` option of the `application` executor

{% callout type="note" title="Required Angular version" %}
Support for the `define` option requires Angular **17.2.0** or later.
{% /callout %}

In Angular applications using the `@nx/angular:application` or `@angular-devkit/build-angular:application` executors, you can set the `define` option in the `build` target to define variables that will be available in your application code at build time:

```json {% fileName="apps/my-app/project.json" highlightLines=[5,"8-10"] %}
{
  ...
  "targets": {
    "build": {
      "executor": "@nx/angular:application",
      "options": {
        ...
        "define": {
          "MY_API_URL": "http://localhost:3333"
        }
      }
    },
    ...
  }
}
```

{% callout type="note" title="Nx executors for Angular" %}
When you use one of the `@nx/angular` executors for building your applications, make sure to also change the `serve` executor to `@nx/angular:dev-server` to ensure the extra features provided by Nx are also available when serving the application.
{% /callout %}

Next, make sure to inform TypeScript of the defined variables to prevent type-checking errors during the build. We can achieve this in a number of ways. For example you could create or update a type definition file included in the TypeScript build process (e.g. `src/types.d.ts`) with `declare` statements for the defined variables:

```ts {% fileName="apps/my-app/src/types.d.ts" %}
declare const MY_API_URL: string;
```

The above would allow you to use the `MY_API_URL` variable in your application code as in the following example:

```ts {% fileName="apps/my-app/src/app/api-http-client.ts" highlightLines=[6] %}
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ApiHttpClient {
  constructor() {
    console.log('API URL:', MY_API_URL);
  }
}
```

You can also define the variables in a way that allows you to consume them as you would do in Node.js applications:

```json {% fileName="apps/my-app/project.json" highlightLines=[5,"8-10"] %}
{
  ...
  "targets": {
    "build": {
      "executor": "@nx/angular:application",
      "options": {
        ...
        "define": {
          "process.env.MY_API_URL": "http://localhost:3333"
        }
      }
    },
    ...
  }
}
```

Like the previous example, you must configure TypeScript to recognize the `process.env` object. You can do this by defining the `process.env` object in a type definition file:

```ts {% fileName="apps/my-app/src/types.d.ts" %}
declare const process: {
  env: {
    API_URL: string;
  };
};
```

{% callout type="warning" title="Beware" %}
You could also add the Node.js types to your `tsconfig.json` file, but this would add many types that you don't need in a browser environment. This can be misleading since you'll see some types are available, but the runtime functionality won't be. It's better to define only the types you need in a type definition file.
{% /callout %}

And then use the variable in your application code:

```ts {% fileName="apps/my-app/src/app/api-http-client.ts" highlightLines=[6] %}
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ApiHttpClient {
  constructor() {
    console.log('API URL:', process.env.MY_API_URL);
  }
}
```

### Using a custom ESBuild plugin

{% callout type="note" title="Required Angular version" %}
Support for custom ESBuild plugins requires Angular **17.0.0** or later.
{% /callout %}

The previous method is useful to statically define variables in the project configuration that will be available at build time. However, if you need to dynamically collect and define the environment variables available at build time, you can create a custom ESBuild plugin.

You can provide a custom ESBuild plugin to the `@nx/angular:application` or `@nx/angular:browser-esbuild` executors:

```json {% fileName="apps/my-app/project.json" highlightLines=[5,8] %}
{
  ...
  "targets": {
    "build": {
      "executor": "@nx/angular:application",
      "options": {
        ...
        "plugins": ["apps/my-app/plugins/env-var-plugin.js"]
      }
    },
    ...
  }
}
```

Next, create the custom ESBuild plugin:

```js {% fileName="apps/my-app/plugins/env-var-plugin.js" %}
const myOrgEnvRegex = /^MY_ORG_/i;

const envVarPlugin = {
  name: 'env-var-plugin',
  setup(build) {
    const options = build.initialOptions;

    const envVars = {};
    for (const key in process.env) {
      if (myOrgEnvRegex.test(key)) {
        envVars[key] = process.env[key];
      }
    }

    options.define['process.env'] = JSON.stringify(envVars);
  },
};

module.exports = envVarPlugin;
```

The plugin collects all environment variables that start with `MY_ORG_` and defines them in the `process.env` object. You can adjust the plugin to your needs (e.g., use a different regular expression, use a whitelist, add all environment variables, etc.).

As shown in the previous section, add the defined variables to a type definition file to ensure TypeScript recognizes them.

Now, you can define variables in an `.env` file, such as:

```text {% fileName="apps/my-app/.env" %}
MY_ORG_API_URL=http://localhost:3333
```

{% callout type="note" title="Set environment variables from the terminal" %}
Alternatively, you can also [set environment variables when running a terminal command](/recipes/tips-n-tricks/define-environment-variables#adhoc-variables).
{% /callout %}

Finally, you can use the environment variables in your application code:

```ts {% fileName="apps/my-app/src/app/api-http-client.ts" highlightLines=[6] %}
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ApiHttpClient {
  constructor() {
    console.log('API URL:', process.env.MY_ORG_API_URL);
  }
}
```

## For Angular applications using Webpack

Angular executors for Webpack (e.g. `@nx/angular:webpack-browser` and `@angular-devkit/build-angular:browser`) don't have built-in support for using environment variables when building applications.

To add support for environment variables we need to use the webpack `DefinePlugin` in our own custom webpack configuration. We'll see how to do so in the following sections.

### A note on `NODE_ENV`

The webpack-based Angular executors (e.g. `@nx/angular:webpack-browser` and `@angular-devkit/build-angular:browser`) set the webpack's `mode` configuration option based on the values for the following in the builder options:

- `optimization`
- `optimization.scripts`
- `optimization.styles`
- `optimization.styles.minify`

If any of the above is set to `true`, webpack's `mode` is set to `production`. Otherwise, it's set to `development`.

By default, webpack automatically sets the `NODE_ENV` variable to the value of the `mode` configuration option. Therefore, Angular applications code have access to that environment variable at build time, but we can't change the `NODE_ENV` variable value directly as we would do with other environment variables because Angular always set the `mode` configuration option based on the above.

To change the `NODE_ENV` variable we can do one of the following:

- Turn on the builder optimizations to set it to `production`
- Turn off the builder optimizations to set it to `development`
- Use a custom webpack configuration to override the webpack `mode` set by Angular executors

The first two options is a matter of changing your build target configuration or passing the specific flag in the command line. We'll see how to do the last in the following section.

### Use a custom webpack configuration to support environment variables

Update the `build` and `serve` targets to use the `@nx/angular` relevant executors and provide a custom Webpack configuration:

```json {% fileName="apps/my-app/project.json" highlightLines=[5,"8-10",14] %}
{
  ...
  "targets": {
    "build": {
      "executor": "@nx/angular:webpack-browser",
      "options": {
        ...
        "customWebpackConfig": {
          "path": "apps/my-app/webpack.config.js"
        }
      }
    },
    "serve": {
      "executor": "@nx/angular:dev-server"
      ...
    },
    ...
  }
}
```

Then, we can use `DefinePlugin` in our custom Webpack configuration:

```js {% fileName="apps/my-app/webpack.config.js" %}
const webpack = require('webpack');

const myOrgEnvRegex = /^MY_ORG_/i;

function getClientEnvironment() {
  const envVars = {};
  for (const key in process.env) {
    if (myOrgEnvRegex.test(key)) {
      envVars[key] = process.env[key];
    }
  }

  return {
    'process.env': JSON.stringify(envVars),
  };
}

module.exports = (config, options, context) => {
  // Overwrite the mode set by Angular if the NODE_ENV is set
  config.mode = process.env.NODE_ENV || config.mode;
  config.plugins.push(new webpack.DefinePlugin(getClientEnvironment()));
  return config;
};
```

In our custom Webpack configuration we collect all environment variables that start with `MY_ORG_`, define the `process.env` object with them, and provide it to the `DefinePlugin`. You can adjust the configuration to your needs (e.g., use a different regular expression, use a whitelist, add all environment variables, etc.).

Next, make sure to inform TypeScript of the defined variables to prevent type-checking errors during the build. We can achieve this in a number of ways. For example you could create or update a type definition file included in the TypeScript build process (e.g. `src/types.d.ts`) with `declare` statements for the defined variables:

```ts {% fileName="apps/my-app/src/types.d.ts" %}
declare const process: {
  env: {
    MY_ORG_API_URL: string;
  };
};
```

Now, we can define variables in our `.env` file, such as:

```text {% fileName="apps/my-app/.env" %}
MY_ORG_API_URL=http://localhost:3333
```

{% callout type="note" title="Set environment variables from the terminal" %}
Alternatively, you can also [set environment variables when running a terminal command](/recipes/tips-n-tricks/define-environment-variables#adhoc-variables).
{% /callout %}

Finally, we can use environment variables in our code:

```ts {% fileName="apps/my-app/src/app/api-http-client.ts" highlightLines=[6] %}
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ApiHttpClient {
  constructor() {
    console.log('API URL:', process.env.MY_ORG_API_URL);
  }
}
```

### Using environment variables in `index.html`

While you cannot use environment variables in `index.html`, one workaround is to create different `index.*.html` files, such
as `index.prod.html`, then swap them in different environments.

For example, you can configure your `build` target in `project.json` as follows:

```json {% fileName="project.json" highlightLines=["10-15"] %}
{
  ...
  "targets": {
    "build": {
      "executor": "@angular-devkit/build-angular:browser",
      ...
      "configurations": {
        "production": {
          ...
          "fileReplacements": [
            {
              "replace": "apps/my-app/src/index.html",
              "with": "apps/my-app/src/index.prod.html"
            }
          ]
        }
      }
    }
  }
}
```

{% callout type="note" title="Optimize" %}
You can also customize your webpack configuration, similar to using `DefinePlugin` above. This approach will require post-processing the `index.html` file, and is out of scope for this guide.
{% /callout %}
