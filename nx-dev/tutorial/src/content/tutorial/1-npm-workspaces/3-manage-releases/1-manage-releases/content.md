---
type: lesson
title: Manage Releases
---

## Manage Releases

:::info
Make sure you have completed the previous sections of this tutorial before starting this one. If you want a clean starting point, you can fork the [sample repository with Nx already added](https://github.com/nrwl/nx-recipes/tree/main/npm-workspaces).
:::

If you decide to publish the `animals` or `names` packages on NPM, Nx can also help you [manage the release process](/features/manage-releases). Release management involves updating the version of your package, populating a changelog, and publishing the new version to the NPM registry.

First you'll need to define which projects Nx should manage releases for by setting the `release.projects` property in `nx.json`:

```json {% fileName="nx.json" %}
{
  "release": {
    "projects": ["packages/*"]
  }
}
```

Now you're ready to use the `nx release` command to publish the `animals` and `names` packages. The first time you run `nx release`, you need to add the `--first-release` flag so that Nx doesn't try to find the previous version to compare against. It's also recommended to use the `--dry-run` flag until you're sure about the results of the `nx release` command, then you can run it a final time without the `--dry-run` flag.

To preview your first release, run:

```shell
npx nx release --first-release --dry-run
```

The command will ask you a series of questions and then show you what the results would be. Once you are happy with the results, run it again without the `--dry-run` flag:

```shell
npx nx release --first-release
```

After this first release, you can remove the `--first-release` flag and just run `nx release --dry-run`. There is also a [dedicated feature page](/features/manage-releases) that goes into more detail about how to use the `nx release` command.
