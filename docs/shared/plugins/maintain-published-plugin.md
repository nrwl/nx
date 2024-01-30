# Maintain a Published Plugins

To create a plugin, see the [create a local plugin tutorial](/extending-nx/tutorials/create-plugin).

## Publish your Nx Plugin

In order to use your plugin in other workspaces or share it with the community, you will need to publish it to an npm registry. To publish your plugin follow these steps:

1. `nx publish my-plugin --ver=1.0.0` which automatically builds `my-plugin`
2. Follow the prompts from npm.
3. That's it!

{% callout type="warning" title="Version bump" %}
Currently you will have to modify the `package.json` version by yourself or with a tool.
{% /callout %}

After that, you can then install your plugin like any other npm package -

{% tabs %}
{% tab label="npm" %}

```shell
npm add -D @my-org/my-plugin
```

{% /tab %}
{% tab label="yarn" %}

```shell
yarn add -D @my-org/my-plugin
```

{% /tab %}
{% tab label="pnpm" %}

```shell
pnpm add -D @my-org/my-plugin
```

{% /tab %}
{% /tabs %}

## List your Nx Plugin

Nx provides a utility (`nx list`) that lists both core and community plugins. You can submit your plugin to be added to this list, but it needs to meet a few criteria first:

- Run some kind of automated e2e tests in your repository
- Include `@nx/devkit` as a `dependency` in the plugin's `package.json`
- List a `repository.url` in the plugin's `package.json`

```jsonc {% fileName="package.json" %}
{
  "repository": {
    "type": "git",
    "url": "https://github.com/nrwl/nx.git",
    "directory": "packages/web"
  }
}
```

{% callout type="warning" title="Unmaintained Plugins" %}
We reserve the right to remove unmaintained plugins from the registry. If the plugins become maintained again, they can be resubmitted to the registry.
{% /callout %}

Once those criteria are met, you can submit your plugin by following the steps below:

- Fork the [Nx repo](https://github.com/nrwl/nx/fork) (if you haven't already)
- Update the [`community/approved-plugins.json` file](https://github.com/nrwl/nx/blob/master/community/approved-plugins.json) with a new entry for your plugin that includes name, url and description
- Use the following commit message template: `chore(core): nx plugin submission [PLUGIN_NAME]`
- push your changes, and run `yarn submit-plugin`

> The `yarn submit-plugin` command automatically opens the GitHub pull request process with the correct template.

We will then verify the plugin, offer suggestions or merge the pull request!

## Write Migrations

Once other repos are using your plugin, it would help them if you write migrations to automatically update their configuration files whenever you make breaking changes. Read the [migration generators guide](/extending-nx/recipes/migration-generators) to find out how.
