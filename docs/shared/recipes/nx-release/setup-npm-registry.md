---
title: 'Setup NPM Registry Publishing'
description: 'Learn how to configure Nx Release for publishing TypeScript/JavaScript packages to NPM registries.'
---

# Setup NPM Registry Publishing

This guide covers how to configure Nx Release for publishing TypeScript/JavaScript packages to NPM registries, including custom registries and authentication.

## Basic NPM Publishing

By default, Nx Release publishes packages to the public NPM registry. When you run `nx release publish`, it will use `npm publish` under the hood for each package.

```shell
nx release publish
```

## Configure Custom Registries

You can configure custom registries for publishing your packages. This is useful for private registries or when using services like Verdaccio for local testing.

```jsonc {% fileName="nx.json" %}
{
  "release": {
    "publish": {
      "registry": "https://my-custom-registry.com"
    }
  }
}
```

### Per-Project Registry Configuration

You can also configure different registries for different projects:

```jsonc {% fileName="nx.json" %}
{
  "release": {
    "groups": {
      "public": {
        "projects": ["public-*"],
        "publish": {
          "registry": "https://registry.npmjs.org"
        }
      },
      "private": {
        "projects": ["private-*"],
        "publish": {
          "registry": "https://my-private-registry.com"
        }
      }
    }
  }
}
```

## Authentication

### NPM Registry Authentication

For the default NPM registry, ensure you're logged in:

```shell
npm login
```

### Custom Registry Authentication

For custom registries, you can set authentication tokens in your `.npmrc` file:

```text {% fileName=".npmrc" %}
//my-custom-registry.com/:_authToken=${NPM_TOKEN}
```

Then set the environment variable:

```shell
export NPM_TOKEN=your-auth-token
nx release publish
```

## Publishing in CI/CD

When publishing in CI environments, you'll need to configure authentication without interactive login. See our guide on [publishing in CI/CD](/recipes/nx-release/publish-in-ci-cd) for detailed instructions.

## Dry Run Testing

Always test your publishing configuration with `--dry-run` first:

```shell
nx release publish --dry-run
```

This will show you exactly what would be published without actually pushing to the registry.

## Troubleshooting

### Common Issues

1. **Authentication errors**: Ensure your NPM token is correctly set and has publish permissions
2. **Registry URL issues**: Verify the registry URL is correct and accessible
3. **Package naming conflicts**: Check that your package names are available on the target registry

### Debugging

Enable verbose logging to see detailed publish information:

```shell
nx release publish --verbose
```

## Next Steps

- Learn about [automating releases with GitHub Actions](/recipes/nx-release/automate-github-releases)
- Configure [custom registries](/recipes/nx-release/configure-custom-registries) for more advanced scenarios
- Set up [local registry testing](/recipes/nx-release/update-local-registry-setup) with Verdaccio
