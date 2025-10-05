---
title: 'Handling Configurations'
description: 'Guide on how to handle configurations with Angular Rspack'
---

# Handling Configurations

Configurations are handled slightly differently compared to the Angular CLI. Rsbuild and Rspack use `mode` instead of configurations to handle different environments by default. This means that a different solution is needed to handle different build configurations you may have to match the behavior of Angular's configuration handling.

The [`createConfig`](/technologies/angular/angular-rspack/api/create-config) function helps you to handle this. It uses the `NGRS_CONFIG` environment variable to determine which configuration to use. The default configuration is `production`.

{% callout type="info" title="Roll your own" %}
You can handle configurations by yourself if you prefer, all you need is some manner of detecting the environment and then merging the options passed to `createConfig`.
{% /callout %}

## Using `createConfig` for configurations

The `createConfig` function takes two arguments, the first is the default options, and the second is an object of configurations. The configurations object is keyed by the name of the configuration, and the value is an object with the options and `rspackConfigOverrides | rsbuildConfigOverrides` to be used for that configuration.

```ts {% fileName="myapp/rspack.config.ts" %}
import { createConfig } from '@nx/angular-rspack';
export default createConfig(
  {
    options: {
      browser: './src/main.ts',
      server: './src/main.server.ts',
      ssrEntry: './src/server.ts',
    },
    rspackConfigOverrides: {
      mode: 'development',
    },
  },
  {
    production: {
      options: {
        fileReplacements: [
          {
            replace: './src/environments/environment.ts',
            with: './src/environments/environment.prod.ts',
          },
        ],
      },
    },
  }
);
```

The above example shows how to handle the `production` configuration. The `options` are the same as the default options but with the `fileReplacements` property added, and the `rspackConfigOverrides` are the same as the default `rspackConfigOverrides`.

The `NGRS_CONFIG` environment variable is used to determine which configuration to use. If the environment variable is not set, the `production` configuration is used by default.
If a production configuration is not provided, the default configuration is used.

To run the build with the `production` configuration:

```bash
NGRS_CONFIG=production npx myapp build
```
