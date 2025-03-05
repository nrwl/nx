---
title: 'withConfigurations - @ng-rsbuild/plugin-angular'
description: 'API Reference for withConfigurations from @ng-rsbuild/plugin-angular'
---

# withConfigurations

```bash
import { withConfigurations } from '@ng-rsbuild/plugin-angular';
```

The `withConfigurations` function is used to create a Rsbuild configuration object setup for Angular applications that use multiple configurations.

The first argument is the default options, and the second is an object of configurations. The configurations object is keyed by the name of the configuration, and the value is an object with the options and `rsbuildConfigOverrides` to be used for that configuration.

{% callout type="info" title="PluginAngularOptions" %}
To learn more about the options available when configuring the plugin, see the [createConfig](/recipes/angular/rspack/api-reference/ng-rsbuild-plugin-angular/create-config) API reference.
{% /callout %}

The final argument is the environment variable to use to determine which configuration to use. The default is `NGRS_CONFIG`.

```ts
function withConfigurations(
  defaultOptions: {
    options: Partial<PluginAngularOptions>;
    additionalConfig?: Partial<RsbuildConfig>;
  },
  configurations: Record<
    string,
    {
      options: Partial<PluginAngularOptions>;
      additionalConfig?: Partial<RsbuildConfig>;
    }
  >,
  configEnvVar?: string
);
```

---

## Examples

{% tabs %}
{% tab label="With Production Configuration" %}

The following example shows how to create a default configuration with a production configuration:

```ts {% fileName="myapp/rsbuild.config.ts" %}
import { withConfigurations } from '@ng-rsbuild/plugin-angular';

export default withConfigurations(
  {
    options: {
      browser: './src/main.ts',
      server: './src/main.server.ts',
      ssrEntry: './src/server.ts',
    },
    rsbuildConfigOverrides: {
      plugins: [pluginSass()],
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

{% /tab %}
{% /tabs %}
