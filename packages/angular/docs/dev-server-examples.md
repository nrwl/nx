This executor is a drop-in replacement for the `@angular-devkit/build-angular:dev-server` builder provided by the Angular CLI. In addition to the features provided by the Angular CLI builder, the `@nx/angular:dev-server` executor also supports the following:

- Serving applications with Vite when using the `@nx/angular:application` or `@nx/angular:browser-esbuild` executors to build them
- Serving applications with webpack when using the `@nx/angular:webpack-browser` executor
- Providing HTTP request middleware functions when the build target is using an esbuild-based executor
- Incremental builds

## Examples

{% tabs %}
{% tab label="Using a custom webpack configuration" %}

This executor should be used along with `@nx/angular:webpack-browser` to serve an application using a custom webpack configuration.

Add the `serve` target using the `@nx/angular:dev-server` executor, set the `build` target executor as `@nx/angular:webpack-browser` and set the `customWebpackConfig` option as shown below:

```json {% fileName="apps/my-app/project.json" highlightLines=[2,"5-7","10-20"] %}
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
  "executor": "@nx/angular:dev-server",
  "configurations": {
    "production": {
      "buildTarget": "my-app:build:production"
    },
    "development": {
      "buildTarget": "my-app:build:development"
    }
  },
  "defaultConfiguration": "development",
}
```

```js {% fileName="apps/my-app/webpack.config.js" %}
module.exports = (config) => {
  // update the config with your custom configuration

  return config;
};
```

{% /tab %}

{% tab label="Providing HTTP request middleware function" %}

{% callout type="warning" title="Overrides" }

Available for workspaces using Angular version 17.0.0 or greater and with `build` targets using an esbuild-based executor.

{% /callout %}

The executor accepts an `esbuildMidleware` option that allows you to provide HTTP require middleware functions that will be used by the Vite development server.

```json {% fileName="apps/my-app/project.json" highlightLines=[8] %}
{
  ...
  "targets": {
    "serve": {
      "executor": "@nx/angular:dev-server",
      "options": {
        ...
        "esbuildMidleware": ["apps/my-app/hello-world.middleware.ts"]
      }
    }
    ...
  }
}
```

```ts {% fileName="apps/my-app/hello-world.middleware.ts" %}
import type { IncomingMessage, ServerResponse } from 'node:http';

const helloWorldMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void
) => {
  if (req.url === '/hello-world') {
    res.end('<h1>Hello World!</h1>');
  } else {
    next();
  }
};

export default helloWorldMiddleware;
```

{% /tab %}
