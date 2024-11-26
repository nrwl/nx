# Manage Releases - `nx release`

Once you have leveraged Nx's powerful code generation and task running capabilities to build your libraries and applications, you will want to share them with your users.

{% youtube
src="https://youtu.be/KjZKFGu3_9I"
title="Releasing Nx Release"
width="100%" /%}

Nx provides a set of tools to help you manage your releases called `nx release`.

> We recommend always starting with --dry-run, because publishing is difficult to undo

```shell
nx release --dry-run
```

## What makes up a release?

A release can be thought about in three main phases:

1. **Versioning** - The process of determining the next version of your projects, and updating any projects that depend on them to use the new version.
2. **Changelog** - The process of deriving a changelog from your commit messages, which can be used to communicate the changes to your users.
3. **Publishing** - The process of publishing your projects to a registry, such as npm for TypeScript/JavaScript libraries.

## Running releases

The `nx release` command is used to run the release process from end to end. It is a wrapper around the three main phases of a release to provide maximum convenience and ease of use.

By default if you just run `nx release` it will prompt you for a semver-compatible version number, or semver keyword (such as major, minor, patch, etc.) and then run the three phases of the release process, including publishing.

As with most Nx commands, when trying it out for the first time, it is strongly recommended to use the `--dry-run` flag to see what changes will be made before actually making them.

```shell
nx release --dry-run
```

{% callout type="note" title="Establishing the previous release" %}
If you are working with a brand new workspace, or one that has never been released before, you will need to establish the previous release before running `nx release`. This is because Nx needs to know what the previous version of your projects was in order to know what to use as the start of the new release's changelog commit range. To do this, run `git tag` with an appropriate initial version. For example, if you have a brand new workspace, you might run `git tag 0.0.0` to establish the initial version.
{% /callout %}

## Customizing releases

The `nx release` command is highly customizable. You can customize the versioning, changelog, and publishing phases of the release process independently through a mixture of configuration and CLI arguments.

The configuration lives in your `nx.json` file under the `"release"` section.

```jsonc {% fileName="nx.json" %}
{
  // ... more nx.json config
  "release": {
    // For example, configures nx release to target all projects
    // except the one called "ignore-me"
    "projects": ["*", "!ignore-me"]
    // ... nx release config
  }
}
```

### Customize changelog output

Changelog render options can be passed as [an object](https://github.com/nrwl/nx/blob/master/packages/nx/release/changelog-renderer/index.ts) under `release.changelog.projectChangelogs.renderOptions` and `release.changelog.workspaceChangelog.renderOptions` in your `nx.json` file. Below are all options with their default values for the built-in changelog renderer.

```jsonc {% fileName="nx.json" %}
{
  // ... more nx.json config
  "release": {
    "changelog": {
      "projectChangelogs": {
        "renderOptions": {
          // Whether or not the commit authors should be added to the bottom of the changelog in a "Thank You" section.
          "authors": true,
          // Whether or not the commit references (such as commit and/or PR links) should be included in the changelog.
          "commitReferences": true,
          // Whether or not to include the date in the version title. It can be set to false to disable it, or true to enable with the default of (YYYY-MM-DD).
          "versionTitleDate": true
        }
      },
      "workspaceChangelog": {
        "renderOptions": {
          // Whether or not the commit authors should be added to the bottom of the changelog in a "Thank You" section.
          "authors": true,
          // Whether or not the commit references (such as commit and/or PR links) should be included in the changelog.
          "commitReferences": true,
          // Whether or not to include the date in the version title. It can be set to false to disable it, or true to enable with the default of (YYYY-MM-DD).
          "versionTitleDate": true
        }
      }
    }
  }
}
```

## Using nx release subcommands independently

As explained above, `nx release` is a wrapper around the three main phases of a release.

If you need more advanced or granular control over your release process you can also run these phases independently using the `nx release version`, `nx release changelog`, and `nx release publish` subcommands.

Each of these subcommands has their own CLI arguments which you can explore using the `--help` flag.

```shell
nx release version --help
nx release changelog --help
nx release publish --help
```

## Using the programmatic API for nx release

For the maximum control and power over your release process, it is recommended to use the programmatic API for `nx release` in your own custom scripts.

Here is a full working example of creating a custom script which processes its own CLI arguments (with `--dry-run` true by default) and then calls the `nx release` programmatic API.

```ts {% fileName="tools/scripts/release.ts" %}
import { releaseChangelog, releasePublish, releaseVersion } from 'nx/release';
import * as yargs from 'yargs';

(async () => {
  const options = await yargs
    .version(false) // don't use the default meaning of version in yargs
    .option('version', {
      description:
        'Explicit version specifier to use, if overriding conventional commits',
      type: 'string',
    })
    .option('dryRun', {
      alias: 'd',
      description:
        'Whether or not to perform a dry-run of the release process, defaults to true',
      type: 'boolean',
      default: true,
    })
    .option('verbose', {
      description:
        'Whether or not to enable verbose logging, defaults to false',
      type: 'boolean',
      default: false,
    })
    .parseAsync();

  const { workspaceVersion, projectsVersionData } = await releaseVersion({
    specifier: options.version,
    dryRun: options.dryRun,
    verbose: options.verbose,
  });

  await releaseChangelog({
    versionData: projectsVersionData,
    version: workspaceVersion,
    dryRun: options.dryRun,
    verbose: options.verbose,
  });

  // The returned number value from releasePublish will be zero if all projects are published successfully, non-zero if not
  const publishStatus = await releasePublish({
    dryRun: options.dryRun,
    verbose: options.verbose,
  });
  process.exit(publishStatus);
})();
```
