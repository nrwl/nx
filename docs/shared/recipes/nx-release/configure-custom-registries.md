---
title: Configure Custom Registries
description: Learn how to configure Nx Release to publish packages to custom npm registries, including setting up multiple registries for different package scopes and per-package registry configuration.
---

# Configure Custom Registries

To publish JavaScript packages, Nx Release uses the `npm` CLI under the hood, which defaults to publishing to the `npm` registry (`https://registry.npmjs.org/`). If you need to publish to a different registry, you can configure the registry in the `.npmrc` file in the root of your workspace or at the project level in the project configuration.

## Set the Registry in the Root .npmrc File

The easiest way to configure a custom registry is to set it in the `npm` configuration via the root `.npmrc` file. This file is located in the root of your workspace, and Nx Release will use it for publishing all projects. To set the registry, add the 'registry' property to your root `.npmrc` file:

```bash .npmrc
registry=https://my-custom-registry.com/
```

### Authenticate to the Registry in CI

To authenticate with a custom registry in CI, you can add authentication tokens to the `.npmrc` file:

```bash .npmrc
registry=https://my-custom-registry.com/
//my-custom-registry.com/:_authToken=<TOKEN>
```

See the [npm documentation](https://docs.npmjs.com/cli/v10/configuring-npm/npmrc#auth-related-configuration) for more information.

## Configure Multiple Registries

The recommended way to determine which registry packages are published to is by using [npm scopes](https://docs.npmjs.com/cli/v10/using-npm/scope). All packages with a name that starts with your scope will be published to the registry specified in the `.npmrc` file for that scope. Consider the following example:

```bash .npmrc
@my-scope:registry=https://my-custom-registry.com/
//my-custom-registry.com/:_authToken=<TOKEN>

@other-scope:registry=https://my-other-registry.com/
//my-other-registry.com/:_authToken=<OTHER_TOKEN>

registry=https://my-default-registry.com/
//my-default-registry.com/:_authToken=<DEFAULT_TOKEN>
```

With the above `.npmrc`, the following packages would be published to the specified registries:

- `@my-scope/pkg-1` -> `https://my-custom-registry.com/`
- `@other-scope/pkg-2` -> `https://my-other-registry.com/`
- `pkg-3` -> `https://my-default-registry.com/`

## Specify an Alternate Registry for a Single Package

In some cases, you may want to configure the registry on a per-package basis instead of by scope. This can be done by setting options in the project's configuration.

{% callout type="info" title="Authentication" %}
All registries set for specific packages must still have authentication tokens set in the root `.npmrc` file for publishing in CI. See [Authenticate to the Registry in CI](#authenticate-to-the-registry-in-ci) for an example.
{% /callout %}

### Set the Registry in the Project Configuration

The project configuration for Nx Release is in two parts - one for the version step and one for the publish step.

#### Update the Version Step

The version step of Nx Release is responsible for determining the new version of the package. If you have set the `version.currentVersionResolver` to 'registry', then Nx Release will check the remote registry for the current version of the package.

**Note:** If you do not use the 'registry' current version resolver, then this step is not needed.

To set custom registry options for the current version lookup, add the registry and/or tag to the `currentVersionResolverMetadata` in the project configuration:

```json project.json
{
  "name": "pkg-5",
  "sourceRoot": "...",
  "targets": {
    ...
  },
  "release": {
    "version": {
      "currentVersionResolverMetadata": {
        "registry": "https://my-unique-registry.com/",
        "tag": "next"
      }
    }
  }
}
```

#### Update the Publish Step

The publish step of Nx Release is responsible for publishing the package to the registry. To set custom registry options for publishing, you can add the `registry` and/or `tag` options for the `nx-release-publish` target in the project configuration:

```json project.json
{
  "name": "pkg-5",
  "sourceRoot": "...",
  "targets": {
    ...,
    "nx-release-publish": {
      "options": {
        "registry": "https://my-unique-registry.com/",
        "tag": "next"
      }
    }
  }
}
```

### Set the Registry in the Package Manifest

{% callout type="caution" title="Caution" %}
It is not recommended to set the registry for a package in the 'publishConfig' property of its 'package.json' file. 'npm publish' will always prefer the registry from the 'publishConfig' over the '--registry' argument. Because of this, the '--registry' CLI and programmatic API options of Nx Release will no longer be able to override the registry for purposes such as publishing locally for end to end testing.
{% /callout %}
