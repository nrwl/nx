---
title: 'list - CLI command'
description: 'Lists installed plugins, capabilities of installed plugins and other available plugins.'
---

# list

Lists installed plugins, capabilities of installed plugins and other available plugins.

## Usage

```bash
nx list [plugin]
```

[Install `nx` globally](/getting-started/nx-setup#install-nx) to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpx nx`.

### Examples

List the plugins installed in the current workspace:

```bash
nx list
```

List the generators and executors available in the `@nrwl/web` plugin if it is installed (If the plugin is not installed `nx` will show advice on how to add it to your workspace):

```bash
nx list @nrwl/web
```

## Options

### help

Type: boolean

Show help

### plugin

Type: string

The name of an installed plugin to query

### version

Type: boolean

Show version number

## Listing plugins from third party or internal artifactory

You can list custom plugins with `nx list`, by passing a upstream link in `nx-plugin.conf` of the root directory of project.
This is similar to community plugins, but useful while working with plugins hosted in internal artifactory. `nx-plugin.conf` can point to HTTPS URL that returns JSON array of plugin name, description and url.

### Example of config file

```
https://example.com/internal-artifactory/typescript-plugins.json
https://example.com/internal-artifactory/microservice-plugins.json
```

### Sample response from URL in config

```
[
  {
    "name": "@thirdParty-artifactory/npm-policy-validator",
    "description": "A plugin that is responsible to list or remove unlicensed library from package.json",
    "url": "https://example.com/plugins/npm-policy-validator"
  },
  {
    "name": "@thirdParty-artifactory/nest-kafka-integration",
    "description": "An Nx plugin that helps integrating kafka broker and subscriber in the app module",
    "url": "https://example.com/plugins/nest-kafka-integration"
  }
]
```
