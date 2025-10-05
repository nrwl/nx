---
title: NxModuleFederationPlugin
description: Details about the NxModuleFederationPlugin
---

# NxModuleFederationPlugin

The `NxModuleFederationPlugin` is a [Rspack](https://rspack.dev) plugin that handles module federation in Nx Workspaces. It aims to provide the same Developer Experience(DX) that you would normally receive from using Nx's `withModuleFederation` function.

## Usage

To use the plugin, you need to add it to your `rspack.config.ts` file. You can do this by adding the following to your config.

### Client Side Rendering

{% tabs %}
{% tab label="rspack.config.ts" %}

```ts
import {
  NxModuleFederationPlugin,
  NxModuleFederationDevServerPlugin,
} from '@nx/module-federation/rspack';
import config from './module-federation.config';

export default {
  ...otherRspackConfigOptions,
  plugins: [
    new NxModuleFederationPlugin({
      config,
    }),
    new NxModuleFederationDevServerPlugin({
      config,
    }),
  ],
};
```

{% /tab %}
{% /tabs %}

### Server Side Rendering

{% tabs %}
{% tab label="rspack.config.ts" %}

```ts
import {
  NxModuleFederationPlugin,
  NxModuleFederationSSRDevServerPlugin,
} from '@nx/module-federation/rspack';
import config from './module-federation.config';

export default {
  ...otherRspackConfigOptions,
  plugins: [
    new NxModuleFederationPlugin({
      config,
      isServer: true,
    }),
    new NxModuleFederationSSRDevServerPlugin({
      config,
    }),
  ],
};
```

{% /tab %}
{% /tabs %}

## How it works

The NxModuleFederationPlugin wraps and configures the Module Federation plugin from `@module-federation/enhanced` to provide a streamlined experience in Nx workspaces. Here's what the plugin does:

1. **Base Configuration**: It sets up essential Rspack configurations:

   - Disables runtime chunking (`runtimeChunk: false`)
   - Sets a unique name for the output
   - Configures specific settings for server-side rendering when needed

2. **Module Federation Setup**: The plugin automatically:

   - Configures the remote entry filename (`remoteEntry.js`)
   - Sets up exposed modules based on your configuration
   - Manages remote module connections
   - Handles shared dependencies and libraries

3. **Runtime Plugins**: It supports additional runtime plugins, including special handling for Node.js environments when running in server mode.

4. **Shared Libraries**: The plugin includes a dedicated system for managing shared libraries across federated modules, helping to avoid duplicate code and ensure consistent versions.

You can learn more about how Nx handles Module Federation in the [Module Federation and Nx Guide](/technologies/module-federation/concepts/module-federation-and-nx#nx-support-for-module-federation).

## Deployment

How applications are deployed depends on the teams and organizational requirements. There are two approaches:

1. À la carte deployments - Each application is deployed according to a release schedule, and can have different cadences.
2. Affected deployments - When changes are merged, use Nx to test and deploy the affected applications automatically.

Often times, teams mix both approaches so deployments to staging (or other shared environments) are automatic. Then,
promotion from staging to production occurs on a set cadence (e.g. weekly releases). It is also recommended to agree on
a process to handle changes to core libraries (i.e. ones that are shared between applications). Since the core changes
affect all applications, it also blocks all other releases, thus should not occur too frequently.

You may also choose to fully automate deployments, even to production. This type of pipeline requires good end-to-end
testing to provide higher confidence that the applications behave correctly. You will also need good rollback mechanisms
in case of a bad deployment.

When figuring out the best deployment strategy, or even how to achieve it with Module Federation and Nx, it is worth understanding what is happening under-the-hood.
Each host and remote in your Module Federation system is treated like a separate application. However, when a remote is loaded into a host via Module Federation, Module Federation itself does not make any kind of distinguishment.
It only cares that the JS file it is trying to load is available at the pre-specified URL, such that it can make a network request to fetch the JS file.

When working locally, Nx parses the config in `module-federation.config.ts` to determine what projects in the workspace are federated. It then reads the project graph for these projects to determine what port they will be served on and uses this information to form a URL to tell Module Federation where it will find the remote JS files.
You'll commonly see the following configuration in your `module-federation.config.ts`:

```javascript
export default {
  remotes: ['shop', 'cart'],
};
```

These names match the names of the projects in the workspace. Therefore, Nx can find them in the project graph and determine the information it needs.
This usually amounts to Nx creating the following URLs:

```shell
shop@localhost:4201
cart@localhost:4202
```

When it comes deployment to a real server, you'll need to configure the URLs to point to their real location. For example, if you deploy the host and the remotes to three servers, each with their own domain, you'd need to configure that:

```shell
shop@https://shop.example.com
cart@https://cart.example.com
```

The `remotes` option in the `module-federation.config.ts` file allows you to do this:

```javascript
export default {
  remotes: [
    ['shop', 'https://shop.example.com'],
    ['cart', 'https://cart.example.com'],
  ],
};
```

However, once you make this change, it will no longer work locally.
You need some mechanism to change the URLs when you're building for a production environment.

A simple way to achieve this could be to use an environment variable:

```javascript
const remotes = process.env.PRODUCTION_DEPLOY
  ? [
      ['shop', 'https://shop.example.com'],
      ['cart', 'https://cart.example.com'],
    ]
  : ['shop', 'cart'];

export default {
  remotes,
};
```

In your CI/CD pipeline, you can set the `PRODUCTION_DEPLOY` environment variable to `true` and then build for production, and the remotes will be configured to point to their real location.

## API Reference

### NxModuleFederationPlugin

```ts
export class NxModuleFederationPlugin {
  constructor(
    private _options: {
      config: ModuleFederationConfig;
      isServer?: boolean;
    },
    private configOverride?: NxModuleFederationConfigOverride
  ) {}
}
```

### ModuleFederationConfig

```ts
export interface ModuleFederationConfig {
  /**
   * The name of the module federation application.
   */
  name: string;
  /**
   * The remotes that the module federation application uses.
   */
  remotes?: Remotes;
  /**
   * The library type and name the ModuleFederationPlugin uses to expose and load the federated modules.
   */
  library?: ModuleFederationLibrary;
  /**
   * The federated modules to expose for consumption by host/consumer applications.
   */
  exposes?: Record<string, string>;
  /**
   * A function that allows you to configure shared libraries.
   * This function is called for each shared library that is used by the module federation application.
   * The function is passed the library name and the shared library configuration.
   * If the function returns `undefined` the default shared library configuration is used.
   * If the function returns `false` the shared library is not shared.
   * If the function returns a shared library configuration object, that configuration is used.
   */
  shared?: SharedFunction;
  /**
   * Additional shared libraries that are shared by the module federation application.
   * This is useful when you want to share a library that is not found as part of the direct dependencies of the application found in the Nx Graph.
   */
  additionalShared?: AdditionalSharedConfig;
  /**
   * `nxRuntimeLibraryControlPlugin` is a runtime module federation plugin to ensure
   * that shared libraries are resolved from a remote with live reload capabilities.
   * If you run into any issues with loading shared libraries, try disabling this option.
   */
  disableNxRuntimeLibraryControlPlugin?: boolean;
}

export type Remotes = Array<string | [remoteName: string, remoteUrl: string]>;
export type ModuleFederationLibrary = { type: string; name: string };
export type SharedFunction = (
  libraryName: string,
  sharedConfig: SharedLibraryConfig
) => undefined | false | SharedLibraryConfig;
export interface SharedLibraryConfig {
  singleton?: boolean;
  strictVersion?: boolean;
  requiredVersion?: false | string;
  eager?: boolean;
}
export type AdditionalSharedConfig = Array<
  | string
  | [libraryName: string, sharedConfig: SharedLibraryConfig]
  | { libraryName: string; sharedConfig: SharedLibraryConfig }
>;
```

### NxModuleFederationConfigOverride

```ts
/**
 * Used to override the options passed to the ModuleFederationPlugin.
 */
export type NxModuleFederationConfigOverride = Omit<
  moduleFederationPlugin.ModuleFederationPluginOptions,
  'exposes' | 'remotes' | 'name' | 'shared' | 'filename'
>;
```
