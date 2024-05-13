# Manage Library Versions with Module Federation

Federated modules are bundled and packaged independently with all the dependencies they need to run smoothly in federated applications called _remotes_. This means that if you have a federated module that depends on a library, the library will be bundled with the federated module within a remote. This independence provides much flexibility, allowing individual federated modules to function without relying on external resources.

A challenge arises when these federated modules are integrated into a _host_ or other _remotes_. Given that each federated module carries its own dependencies, the host application may have inadvertently downloaded multiple copies of the same dependency. This redundancy does two things:

1. Multiple copies of the same dependency can create bottlenecks and conflicts, resulting in unexpected behaviour.
2. With redundant dependencies, the host application can become bloated, increasing the bandwidth and consuming more memory and resources on the user's device.

To mitigate these issues, Module Federation has a shared API. Its primary function is to act as a gatekeeper, ensuring that only one copy of a dependency is downloaded, regardless of how many federated modules request it.

### How it works

The Shared API maintains a registry of all the downloaded dependencies. When a federated module requests a dependency, the Shared API checks the registry. If the dependency already exists, the module is directed to use the existing copy. If not, the dependency is downloaded and added to the registry.

![How Shared API works](/shared/concepts/module-federation/shared-api.png)

{% callout type="info" title="Lost?" %}
If you are not familiar with the concepts of federated modules, remotes, and hosts, please read the [Faster builds with module federation](/concepts/module-federation/faster-builds-with-module-federation) for an introduction.
{% /callout %}

## Our Approach

Although the Shared API is a powerful tool, it can be challenging to manage. The Shared API is configured in the Module Federation Config File, which is a JavaScript or TypeScript file. This file is not part of the build process, so should you want to use a different version of a workspace dependency, you would have to manually record the change outside of the build process which can be tedious and error-prone.

**Nx** recommends the Single Version Policy (SVP) for managing library versions. The SVP is a simple concept: a library should have only one version in a given application. This means that if you have a workspace library used by multiple remotes and hosts, it should only have one version across all of them. The SVP becomes essential in this context for a variety of reasons:

### 1. Consistency

Ensuring that all federated modules rely on the same version of a shared dependency provides consistent behaviour across the entire application. Different library versions can have varying behaviour or bugs, leading to unexpected or inconsistent results.

### 2. Conflicts

Mixing multiple versions of a library or module in the same runtime can lead to conflicts. This is especially problematic with libraries that maintain internal state or have side effects.

### 3. API Compatibility

As a library evolves, functions and methods get added, removed or changed. By ensuring a single version, you eliminate the risk of using incompatible APIs in one version but not another.

### 4. Singleton Libraries

Some libraries are designed to be singletons (React, Angular, Redux, etc.). These libraries are intended to be instantiated once and shared across the entire application. Multiple versions of such libraries can break the intended behaviour or even cause runtime errors.

For these reasons, we **recommend** using the SVP to manage shared workspace libraries when using Module Federation. However, we understand that there are cases where you may want to use different versions of a library. For example, you may use a different library version in a remote than in a host. In these cases, you can opt out as described below.

## How are library versions managed?

With **Nx** there are two ways to manage how library versions are shared / managed with Module Federation:

### 1. Opt in to sharing library versions

This is the default behaviour for **Nx**. All dependencies are **singletons** and will be shared between remotes and hosts.

### 2. Opt out from sharing library versions

This means that the library will not be shared between remotes and hosts. Each remote and host will load its own version of the library.
A common use-case for this is if you want to enable tree-shaking for a library like _lodash_. If you share this library, it will be bundled with the remote and host, and tree-shaking will not be possible.

## How are library versions determined?

**Nx** determines the version of a library by looking at a `package.json`. If the library is an npm package, the version is determined by the version declared in the workspace `package.json`. If the library is a workspace library, the version is determined by the version in the `package.json` of the project that consumes the shared library. RemoteA consumes Counter, which is a workspace library exposed and shared by RemoteB. The version of Counter is determined by the version in RemoteB's `package.json`. If the `package.json` does not exist or the library is not declared, Nx will use the version in the `package.json` of the workspace library.

![How Nx determines library versions](/shared/concepts/module-federation/nx-library-version.png)

There are twos ways to manage library versions with **Nx**:

{% tabs %}
{% tab label="Opt out from sharing library" %}

```ts {% fileName="remote/module-federation.config.ts" %}
import { ModuleFederationConfig } from '@nx/webpack';

const config: ModuleFederationConfig = {
  name: 'remote',
  exposes: {
    './Module': './src/remote-entry.ts',
  },
  // Determine which libraries to share
  shared: (packageName: string) {
    // I do not want to share this package and I will load my own version
    if(packageName === '@acme/utils') return false;
  }
};
export default config;
```

This would result in the following webpack config:

```js {% fileName="webpack.config.js" %}
module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      // additional config
      name: 'remote',
      shared: {
        react: { singleton: true, eager: true },
        // acme/utils will not be shared
      },
    }),
  ],
};
```

{% /tab %}
{% tab label="Opt in to sharing library versions" %}

```ts {% fileName="remote/module-federation.config.ts" %}
import { ModuleFederationConfig } from '@nx/webpack';

const config: ModuleFederationConfig = {
  name: 'remote',
  exposes: {
    './Module': './src/remote-entry.ts',
  },
  // By not declaring a shared function, all dependencies will be shared
};
export default config;
```

This would result in the following webpack config:

```js {% fileName="webpack.config.js" %}
module.exports = {
  // Additional config ignored for brevity
  plugins: [
    new ModuleFederationPlugin({
      // ...
      name: 'remote',
      shared: {
        react: { singleton: true, eager: true, version: '18.2.0' },
        'acme/utils': { singleton: true, eager: true, version: '1.0.0' }, // <--- This version is determined by the logic discussed earlier
      },
    }),
  ],
};
```

{% /tab %}
{% /tabs %}

### Github Repository Example

Here is a working example of how to opt in and out of sharing library versions:

{% github-repository url="https://github.com/jaysoo/module-federation-example" /%}

## Benefits

By taking advantage of **Nx**'s approach to managing library versions, you can:

- Streamline the process of updating a library version behind a versoning scheme like SemVer.
- Opt-in or out of sharing library versions with Module Federation based on your needs.
- Reduce the download size of your application by sharing workspace libraries between remotes and hosts.
