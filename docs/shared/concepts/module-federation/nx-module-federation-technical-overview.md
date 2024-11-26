# Nx Module Federation Technical Overview

Nx's Module Federation support is provided through a mixture of `executors` and the `withModuleFederation()` util that is used in you `webpack.config` file. Understanding what is happening under the hood can help when developing applications that use Module Federation as well as debugging any potential issues you run into.

## What happens when you serve your host?

When you serve your host application via `nx serve host`, the Nx `module-federation-dev-server` executor is invoked. This executor does a few things that aim to provide a more holistic local development while ensuring a great DX (development experience).

{% callout type="note" title="Using Module Federation with SSR?" %}
The same technique outlined below also applies to the `module-federation-ssr-dev-server`.  
This is important to know when it comes to deploying your SSR Module Federation application as it indicates that you can place the build artifacts from the `remotes` onto something like an Amazon S3 Bucket and your `host` will be able to find these files correctly.
{% /callout %}

The executor does the following:

1. Finds all the `remotes` that the `host` depends on.
2. Determines which `remotes` need to be served statically and which need to be served via `webpack-dev-server`.
3. For the `static remotes`, it will invoke `nx run-many -t build --projects={listOfStaticRemotes}`.
4. If required, it will move the built artifacts of each `remote` to a common directory.
5. It will run `http-server` at the common directory such that those files are available on the network from a single port.
6. It will create proxy servers via `express` listening on the ports where each `remote` _should_ be located (as configured in the host's `module-federation.config.ts` or `module-federation.manifest.json` file).
   - These proxy servers will proxy requests from the server to the `http-server` to fetch the correct files as requested by Module Federation.
7. If the `--devRemotes` option has been passed, it will serve each `dev remote` via `webpack-dev-server` allowing for HMR and live reloading when working on those remotes.
8. It will serve the `host` via `webpack-dev-server`.

If you prefer diagrams, the one below outlines the above steps.

![Nx Module Federation Host Serve Flow](/shared/concepts/module-federation/module-federation-host-serve-light.png)

## The `NxRuntimeLibraryControlPlugin`

Previously, when using shared workspace libraries as part of your Module Federation application, there was a chance that the workspace library would be provided by one of the `static remotes`. This would cause issues where changes to those shared libraries would not be reflected in the locally served application.

To combat this issue, we developed the `NxRuntimeLibraryControlPlugin`. This is a _Runtime Plugin_ that will ensure that workspace libraries are only shared via any active `dev remote`. This means that any changes to the shared library will be picked up by `webpack-dev-server` and, as such, reflected in the locally served application.

This plugin is enabled by default, however, you can turn it off in your `module-federation.config` file:

```ts
export const config: ModuleFederationConfig = {
  ...,
  disableNxRuntimeLibraryControlPlugin: true
}
```
