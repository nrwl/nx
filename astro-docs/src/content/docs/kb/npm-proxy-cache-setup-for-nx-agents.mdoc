---
title: Configure the npm proxy cache for Nx Agents
description: Configure npm, pnpm, or Yarn to install public packages through the Nx Cloud proxy cache.
filter: 'type:Guides'
topics:
  - 'Continuous integration'
  - 'Nx Cloud'
---

{% aside type="caution" title="Nx Enterprise" %}
The npm proxy cache is available for hosted [Nx Cloud single-tenant deployments](/docs/enterprise/single-tenant/overview).
[Contact the Nx team](https://nx.dev/enterprise) to add it to your deployment.
{% /aside %}

The npm proxy cache reduces package download time by keeping public packages close to your
Nx Agents.
Configure your package manager to use the in-cluster registry before it installs dependencies.

{% aside type="caution" title="Public packages only" %}
The proxy cache supports public npm packages only.
Send private or scoped packages that require authentication directly to your private registry.
Do not publish packages to the proxy cache.
{% /aside %}

## Configure the default registry

Add the proxy registry to the `.npmrc` file at the workspace root or in your home directory:

```ini
registry=http://cache.npm.svc.cluster.local:4873/
```

If an existing project-level file sets `registry`, update that file.
A user-level setting does not override a project-level setting.

## Configure your package manager

{% tabs syncKey="package-manager" %}
{% tabitem label="npm and pnpm" %}

npm and pnpm read the registry from `.npmrc` and need no other proxy cache configuration.

```ini
# .npmrc
registry=http://cache.npm.svc.cluster.local:4873/
```

{% /tabitem %}
{% tabitem label="Yarn Classic" %}

Yarn Classic reads the registry from `.npmrc` or `.yarnrc`.
Use the same registry setting:

```ini
# .npmrc
registry=http://cache.npm.svc.cluster.local:4873/
```

{% /tabitem %}
{% tabitem label="Yarn Modern" %}

Yarn Modern reads the registry from `npmRegistryServer` in `.yarnrc.yml`:

```yaml
# .yarnrc.yml
npmRegistryServer: 'http://cache.npm.svc.cluster.local:4873/'
```

{% /tabitem %}
{% /tabs %}

## Route private packages

Map each private package scope to the registry that hosts it.
The scoped setting takes precedence over the default proxy registry:

```ini
# .npmrc
registry=http://cache.npm.svc.cluster.local:4873/
@<package-scope>:registry=https://<private-registry-host>/npm/
```

You can also write the scoped setting with the npm CLI:

```shell
npm config set @<package-scope>:registry https://<private-registry-host>/npm/
```

## Configure package publishing

Set a publishing registry for each package that your workspace publishes.
The `publishConfig` field in `package.json` keeps publish requests away from the proxy cache:

```json
{
  "publishConfig": {
    "registry": "https://<publishing-registry-host>/npm/"
  }
}
```

A scoped registry in `.npmrc` also applies when you publish a package from that scope.

## Configure an agent setup step

Add the registry settings before the dependency installation step in your
[launch template](/docs/kb/launch-templates):

```yaml
# .nx/workflows/agents.yaml
launch-templates:
  linux-medium:
    init-steps:
      - name: Configure the npm proxy cache
        script: |
          npm config set --location=user registry http://cache.npm.svc.cluster.local:4873/
          npm config set --location=user @<package-scope>:registry https://<private-registry-host>/npm/
```

Use a committed project-level configuration instead when the workspace already defines its
registry in `.npmrc` or an equivalent file.

## Understand cache behavior

The cache uses multiple replicas for reliability and local network access.
A cold replica can still fetch a package from the upstream registry.
The first request in an availability zone can therefore take longer than later requests.

For package manager details, see the [npm `.npmrc` reference](https://docs.npmjs.com/cli/configuring-npm/npmrc),
[pnpm settings](https://pnpm.io/npmrc), [Yarn Classic configuration](https://classic.yarnpkg.com/lang/en/docs/cli/config/),
and [Yarn Modern configuration](https://yarnpkg.com/configuration/yarnrc).
