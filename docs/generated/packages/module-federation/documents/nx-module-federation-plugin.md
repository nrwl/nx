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
