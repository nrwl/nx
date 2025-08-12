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

## Running Releases

The `nx release` command is used to run the release process from end to end. It is a wrapper around the three main phases of a release to provide maximum convenience and ease of use.

By default, when you run `nx release` it will prompt you for a version keyword (e.g. major, minor, patch) or a custom version number. The release command will then run the three phases of the release process in order: versioning, changelog generation, and publishing.

When trying it out for the first time, you need to pass the `--first-release` flag since there is no previous release to compare against for changelog purposes. It is strongly recommended to use the `--dry-run` flag to see what will be published in the first release without actually pushing anything to the registry.

```shell
nx release --first-release --dry-run
```

{% callout type="info" title="Semantic Versioning" %}
By default, the version follows semantic versioning (semver) rules. To disable this behavior, set `release.releaseTagPatternRequireSemver` to `false` in your `nx.json` file. This allows you to use custom versioning schemes.
{% /callout %}

## Set Up Your Workspace

Follow our guides to set up Nx Release for your workspace.

{% cards cols="3" %}

{% card title="TypeScript/JavaScript to NPM" description="Publish TypeScript and JavaScript packages to NPM or private registries with semantic versioning." type="documentation" url="/recipes/nx-release/release-npm-packages" icon="typescript" /%}

{% card title="Docker Images" description="Version and publish Docker images with calendar-based versioning for continuous deployment." type="documentation" url="/recipes/nx-release/release-docker-images" /%}

{% card title="Rust Crates" description="Publish Rust packages to crates.io with cargo integration." type="documentation" url="/recipes/nx-release/publish-rust-crates" icon="rust" /%}

{% /cards %}

## Basic Configuration

Configure Nx Release in your `nx.json` file:

```jsonc {% fileName="nx.json" %}
{
  "release": {
    "projects": ["packages/*"]
  }
}
```

The nx release command is customizable. You can customize the versioning, changelog, and publishing phases of the release process independently through a mixture of configuration and CLI arguments.

See the [configuration reference](/reference/nx-json#release) for all available options.

## Using the Programmatic API for Nx Release

For maximum control, use the programmatic API to create custom release workflows:

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

## Learn More

### Configuration & Customization

- **[Release Groups](/recipes/nx-release/release-projects-independently)** - Version projects independently or together
- **[Conventional Commits](/recipes/nx-release/automatically-version-with-conventional-commits)** - Automate versioning based on commit messages
- **[Custom Registries](/recipes/nx-release/configure-custom-registries)** - Publish to private or alternative registries
- **[CI/CD Integration](/recipes/nx-release/publish-in-ci-cd)** - Automate releases in your pipeline
- **[Changelog Customization](/recipes/nx-release/configure-changelog-format)** - Control changelog generation and formatting
- **[Custom Commit Types](/recipes/nx-release/customize-conventional-commit-types)** - Define custom conventional commit types
- **[Version Prefixes](/recipes/nx-release/configuration-version-prefix)** - Configure version prefix patterns

### Workflows

- **[Automate with GitHub Actions](/recipes/nx-release/automate-github-releases)** - Set up automated releases in GitHub workflows
- **[Release Projects Independently](/recipes/nx-release/release-projects-independently)** - Manage independent versioning for projects
- **[Use Conventional Commits](/recipes/nx-release/automatically-version-with-conventional-commits)** - Enable automatic versioning from commits
- **[Build Before Versioning](/recipes/nx-release/build-before-versioning)** - Run builds before version updates

### References

- **[Configuration in `nx.json`](/reference/nx-json#release)** - All available options for configuring `nx release`
