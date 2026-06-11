---
title: Publish Your Nx Plugin
description: Learn how to publish your Nx plugin to npm and get it listed in the official Nx plugin registry so others can discover and use it.
filter: 'type:Guides'
---

In order to use your plugin in other workspaces or share it with the community, you will need to publish it to an npm registry. To publish your plugin follow these steps:

1. `nx nx-release-publish nx-cfonts`
2. Follow the prompts from npm.
3. That's it!

After that, you can then install your plugin like any other Nx plugin -

```shell
nx add nx-cfonts
```

## List your Nx plugin

Nx provides a utility (`nx list`) that lists both core and community plugins. You can submit your plugin to be added to this list, but it needs to meet a few criteria first:

- Run some kind of automated e2e tests in your repository
- Include `@nx/devkit` as a `dependency` (not a `peerDependency`), so your plugin pins the version it was tested against. `@nx/devkit` itself declares a peer dependency on `nx` spanning its own major plus one before and one after — for example, depending on `@nx/devkit@23` means your plugin works on `nx@22`, `nx@23`, and the upcoming `nx@24`.
- Do **not** list `nx` itself as a direct `dependency` or `peerDependency` — the user's workspace already provides it, and `@nx/devkit` handles the version range for you.
- List a `repository.url` in the plugin's `package.json`

```jsonc
// package.json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/nrwl/nx.git",
    "directory": "packages/web",
  },
}
```

{% aside type="caution" title="Unmaintained Plugins" %}
We reserve the right to remove unmaintained plugins from the registry. If the plugins become maintained again, they can be resubmitted to the registry.
{% /aside %}

Once those criteria are met, you can submit your plugin by following the steps below:

- Fork the [Nx repo](https://github.com/nrwl/nx/fork) (if you haven't already)
- Update the [`astro-docs/src/content/approved-community-plugins.json` file](https://github.com/nrwl/nx/blob/master/astro-docs/src/content/approved-community-plugins.json) with a new entry for your plugin that includes name, url and description
- Use the following commit message template: `chore(core): nx plugin submission [PLUGIN_NAME]`
- push your changes, and run `pnpm submit-plugin`

> The `pnpm submit-plugin` command automatically opens the GitHub pull request process with the correct template.

We will then verify the plugin, offer suggestions or merge the pull request!
