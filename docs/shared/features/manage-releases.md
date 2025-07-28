---
title: 'Manage Releases'
description: 'Learn how to use Nx release tools to version, generate changelogs, and publish your projects with confidence using conventional commits.'
---

# Manage Releases - `nx release`

Once you have leveraged Nx's powerful code generation and task running capabilities to build your libraries and applications, you will want to share them with your users.

{% link-card title="Free Course: Versioning and Releasing NPM packages with Nx" type="external" url="https://www.epicweb.dev/tutorials/versioning-and-releasing-npm-packages-with-nx" icon="/documentation/shared/images/nx-release-course-logo.webp" /%}

Nx provides a set of tools to help you manage your releases called `nx release`.

> We recommend always starting with --dry-run, because publishing is difficult to undo

```shell
nx release --dry-run
```

## What makes up a release?

A release can be thought about in three main phases:

1. **Versioning** - The process of determining the next version of your projects, and updating any projects that depend on them to use the new version.
2. **Changelog** - The process of deriving a changelog from your commit messages or [version plan](/recipes/nx-release/file-based-versioning-version-plans) files, which can be used to communicate the changes to your users.
3. **Publishing** - The process of publishing your projects to a registry, such as npm for TypeScript/JavaScript libraries, crates.io for Rust, or Docker registries for container images.

## Running releases

The `nx release` command is used to run the release process from end to end. It is a wrapper around the three main phases of a release to provide maximum convenience and ease of use.

By default, when you run `nx release` it will prompt you for a version keyword (e.g. major, minor, patch) or a custom version number. The release command will then run the three phases of the release process in order: versioning, changelog generation, and publishing.

When trying it out for the first time, need to pass the `--first-release` flag since there is no previous release to compare against for changelog purposes. It is strongly recommended to use the `--dry-run` flag to see what will be published in the first release without actually pushing anything to the registry.

```shell
nx release --first-release --dry-run
```

{% callout type="info" title="Semantic Versioning" %}
By default, the version follows semantic versioning (semver) rules. To disable this behavior, set `release.releaseTagPatternRequireSemver` to `false` in your `nx.json` file. This allows you to use custom versioning schemes.
{% /callout %}

## Customizing releases

The `nx release` command is highly customizable. You can customize the versioning, changelog, and publishing phases of the release process independently through a mixture of configuration and CLI arguments.

The configuration lives in your `nx.json` file under the `release` section.

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
          "versionTitleDate": true,
          // Whether to apply usernames to authors in the Thank You section. Note, this option was called mapAuthorsToGitHubUsernames prior to Nx v21.
          "applyUsernameToAuthors": true
        }
      },
      "workspaceChangelog": {
        "renderOptions": {
          // Whether or not the commit authors should be added to the bottom of the changelog in a "Thank You" section.
          "authors": true,
          // Whether or not the commit references (such as commit and/or PR links) should be included in the changelog.
          "commitReferences": true,
          // Whether or not to include the date in the version title. It can be set to false to disable it, or true to enable with the default of (YYYY-MM-DD).
          "versionTitleDate": true,
          // Whether to apply usernames to authors in the Thank You section. Note, this option was called mapAuthorsToGitHubUsernames prior to Nx v21.
          "applyUsernameToAuthors": true
        }
      }
    }
  }
}
```

## Docker and Other Ecosystems

{% callout type="warning" title="Docker is Experimental" %}
Docker support in Nx Release is currently experimental and may undergo breaking changes without following semantic versioning.
{% /callout %}

### Docker Releases

Nx Release supports Docker image versioning and publishing with calendar-based version schemes. This is ideal for continuous deployment workflows where every build is potentially releasable.

```jsonc {% fileName="nx.json" %}
{
  "release": {
    "releaseTagPattern": {
      "pattern": "release/{projectName}/{version}"
    },
    "groups": {
      "apps": {
        "projects": ["java-backend", "node-backend"],
        "projectsRelationship": "independent",
        "docker": {
          "skipVersionActions": true
        },
        "changelog": {
          "projectChangelogs": true
        }
      },
      "packages": {
        "projects": ["node-backend", "shared-utils", "shared-logger"]
      }
    }
  }
}
```

Use the `--dockerVersionScheme` flag to release Docker images:

```shell
# Build and tag Docker images
nx release version --dockerVersionScheme=production

# Push to registry
nx release publish
```

This creates version tags like `2501.24.a1b2c3d` based on the current date and commit SHA.

### Key Differences for Docker

- **Calendar Versioning**: Uses date-based versions instead of semantic versioning
- **skipVersionActions**: Use this to exclude projects that shouldn't have Docker images
- **Pre-version Commands**: Run `docker:build` targets before versioning

Learn more in the [Docker deployment guide](/recipes/deployment/deploy-node-docker).

### Rust Crate Publishing

Nx Release also supports publishing Rust crates to crates.io. Configure Rust projects similarly to JavaScript projects, and Nx will use `cargo publish` during the publish phase.

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

  // publishResults contains a map of project names and their exit codes
  const publishResults = await releasePublish({
    dryRun: options.dryRun,
    verbose: options.verbose,
  });

  process.exit(
    Object.values(publishResults).every((result) => result.code === 0) ? 0 : 1
  );
})();
```
