---
title: NxModuleFederationDevServerPlugin
description: Details about the NxModuleFederationDevServerPlugin and NxModuleFederationSSRDevServerPlugin
---

# NxModuleFederationDevServerPlugin and NxModuleFederationSSRDevServerPlugin

The `NxModuleFederationDevServerPlugin` and `NxModuleFederationSSRDevServerPlugin` are [Rspack](https://rspack.dev) plugins that handle the development server for module federation in Nx Workspaces. They aim to provide the same Developer Experience(DX) that you would normally receive from using Nx's `module-federation-dev-server` executors in a non-executor ([Inferred Tasks](/concepts/inferred-tasks)) project.

## Usage

To use the plugin, you need to add it to your `rspack.config.ts` file. You can do this by adding the following to your config.

### Client Side Rendering

{% tabs %}
{% tab label="rspack.config.ts" %}

```ts
import { NxModuleFederationDevServerPlugin } from '@nx/module-federation/rspack';
import config from './module-federation.config';

export default {
  ...otherRspackConfigOptions,
  plugins: [
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
import { NxModuleFederationSSRDevServerPlugin } from '@nx/module-federation/rspack';
import config from './module-federation.config';

export default {
  ...otherRspackConfigOptions,
  plugins: [
    new NxModuleFederationSSRDevServerPlugin({
      config,
    }),
  ],
};
```

{% /tab %}
{% /tabs %}

## How it works

The `NxModuleFederationDevServerPlugin` and `NxModuleFederationSSRDevServerPlugin` will serve the remote applications in via a single file server (using `http-server`) and proxy requests to the remote applications to the correct port. This allows for a more streamlined development experience when working with module federation.
You can learn more about this experience in the [Module Federation Technical Overview](/technologies/module-federation/concepts/nx-module-federation-technical-overview).

The key difference between `NxModuleFederationDevServerPlugin` and `NxModuleFederationSSRDevServerPlugin` is that the latter will handle both `browser` and `server` bundles to support Server Side Rendering (SSR). It will also serve the host/consumer application by forking ([child_process.fork](https://nodejs.org/api/child_process.html#child_processforkmodulepath-args-options)) the `server.js` output from the `server` bundle of the host application.

## API Reference

### NxModuleFederationDevServerPlugin

```ts
export class NxModuleFederationDevServerPlugin {
  constructor(
    private _options: {
      config: ModuleFederationConfig;
      devServerConfig?: NxModuleFederationDevServerConfig;
    }
  ) {
    this._options.devServerConfig ??= {
      host: 'localhost',
    };
  }
}
```

### NxModuleFederationSSRDevServerPlugin

```ts
export class NxModuleFederationSSRDevServerPlugin {
  constructor(
    private _options: {
      config: ModuleFederationConfig;
      devServerConfig?: NxModuleFederationDevServerConfig;
    }
  ) {
    this._options.devServerConfig ??= {
      host: 'localhost',
    };
  }
}
```

### NxModuleFederationDevServerConfig

```ts
export interface NxModuleFederationDevServerConfig {
  /**
   * The URL hostname to use for the dev server.
   */
  host?: string;
  /**
   * The port to use for the static remotes.
   */
  staticRemotesPort?: number;
  /**
   * The path to the module federation manifest file when using Dynamic Module Federation.
   */
  pathToManifestFile?: string;
  /**
   * Whether to use SSL for the remote applications.
   */
  ssl?: boolean;
  /**
   * The path to the SSL certificate file.
   */
  sslCert?: string;
  /**
   * The path to the SSL key file.
   */
  sslKey?: string;
  /**
   * The number of parallel processes to use when building the static remotes.
   */
  parallel?: number;
  /**
   * Options to proivde fine-grained control over how the dev server finds the remote applications.
   */
  devRemoteFindOptions?: DevRemoteFindOptions;
}

export interface DevRemoteFindOptions {
  retries?: number;
  retryDelay?: number;
}
```
