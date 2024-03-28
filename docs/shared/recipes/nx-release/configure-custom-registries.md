# Configure Custom Registries

For publishing javaScript packages, Nx Release uses `npm` under the hood, which defaults to publishing to the `npm` registry (`https://registry.npmjs.org/`). If you need to publish to a different registry, you can configure the registry in the `.npmrc` file in the root of your workspace, or at the project level in either the `package.json` file or the project configuration.

# Set the Registry in the Root .npmrc File

The easiest way to configure a custom registry is to set it in the `npm` configuration via the root `.npmrc` file. This file is located in the root of your workspace, and Nx Release will use it for publishing all projects. To set the registry, add the 'registry' property to your root `.npmrc` file:

```bash .npmrc
registry=https://my-custom-registry.com/
```

## Authenticate to the Registry in CI

To authenticate with a custom registry in CI, you can add authentication tokens to the `.npmrc` file:

```bash .npmrc
registry=https://my-custom-registry.com/
//my-custom-registry.com/:_authToken=<TOKEN>
```

See the [npm documentation](https://docs.npmjs.com/cli/v10/configuring-npm/npmrc#auth-related-configuration) for more information.

# Configure Multiple Registries

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

# Specify an Alternate Registry for a Single Package

In some cases, you may want to configure the registry on a per-package basis instead of by scopes. This can be done either by setting the registry in the `package.json` file or by setting options in the project's configuration.

{% callout type="info" title="Authentication" %}
All registries set for specific packages must still have authentication tokens set in the root `.npmrc` file for publishing in CI. See [Authenticate to the Registry in CI](#authenticate-to-the-registry-in-ci) for an example.
{% /callout %}

## Set the Registry in the Project's package.json File

If you need to publish a single package to a different registry than the rest of your packages, you can specify the registry in the `package.json` file for that package. Add the `publishConfig` property to the `package.json` file for the package you want to publish to a different registry:

```json package.json
{
  "name": "pkg-4",
  "version": "0.0.1",
  "publishConfig": {
    "registry": "https://my-unique-registry.com/"
  }
}
```

With the above `package.json`, `pkg-4` will be published to `https://my-unique-registry.com/`.

{% callout type="info" title="Configuration Hierarchy" %}
If a registry is configured in `.npmrc` and in the `package.json` file, the `package.json` configuration will take precedence. This allows you to override the registry for individual packages while still using a default registry for the rest of your packages.
{% /callout %}

{% callout type="warning" title="Scoped Packages Configuration Hierarchy" %}
If a registry is configured for a scope in `.npmrc`, then that registry will take precedence over both the default registry set in `.npmrc` and the registry set in the `package.json` file. This means that all packages with that scope will be published to the specified registry, regardless of the `publishConfig` property in the `package.json` file. This is consistent with the behavior of `npm publish`. If you need to publish a scoped package to a different registry, you will need to set the registry [in the project configuration](#set-the-registry-in-the-project-configuration) instead.
{% /callout %}

## Set the Registry in the Project Configuration

The project configuration for Nx Release is in two parts - one for the version step and one for the publish step.

### Update the Version Step

The version step of Nx Release is responsible for determining the new version of the package. If you have set the `version.generatorOptions.currentVersionResolver` to 'registry', then Nx Release will check the remote registry for the current version of the package. Note: If you do not use the 'registry' current version resolver, then this step is not needed.

To set a custom registry for the current version lookup, add the registry to the `currentVersionResolverMetadata` in the project configuration:

```json project.json
{
  "name": "pkg-5",
  "sourceRoot": "...",
  "targets": {
    ...
  },
  "release": {
    "version": {
      "generatorOptions": {
        "currentVersionResolverMetadata": {
          "registry": "https://my-unique-registry.com/"
        }
      }
    }
  }
}
```

### Update the Publish Step

The publish step of Nx Release is responsible for publishing the package to the registry. To set a custom registry for publishing, add the `registry` option for the `nx-release-publish` target in the project configuration:

```json project.json
{
  "name": "pkg-5",
  "sourceRoot": "...",
  "targets": {
    ...,
    "nx-release-publish": {
      "options": {
        "registry": "https://my-unique-registry.com/"
      }
    }
  }
}
```
