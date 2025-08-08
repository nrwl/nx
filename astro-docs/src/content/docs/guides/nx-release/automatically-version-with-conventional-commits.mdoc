---
title: Automatically Version with Conventional Commits
description: Learn how to configure Nx Release to automatically determine version bumps based on conventional commit messages, enabling automated versioning in CI/CD pipelines.
---

# Automatically Version with Conventional Commits

If you wish to bypass the versioning prompt, you can configure Nx Release to defer to the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) standard to determine the version bump automatically. This is useful for automating the versioning process in a CI/CD pipeline.

## Enable Automatic Versioning

To enable automatic versioning via conventional commits, set the `release.version.conventionalCommits` property to `true` in `nx.json`:

```json nx.json
{
  "release": {
    "version": {
      "conventionalCommits": true
    }
  }
}
```

## Determine the Version Bump

Nx Release will use the commit messages since the last release to determine the version bump. It will look at the type of each commit and determine the highest version bump from the following list:

- 'feat' -> minor
- 'fix' -> patch

For example, if the git history looks like this:

```
  - fix(pkg-1): fix something
  - feat(pkg-2): add a new feature
  - chore(pkg-3): update docs
  - chore(release): 1.0.0
```

then Nx Release will select the `minor` version bump and elect to release version 1.1.0. This is because there is a `feat` commit since the last release of 1.0.0. To customize the version bump for different types of commits, or to trigger a version bump with custom commit types, see the [Customize Conventional Commit Types](/recipes/nx-release/customize-conventional-commit-types) recipe.

{% callout type="info" title="No changes detected" %}
If Nx Release does not find any relevant commits since the last release, it will skip releasing a new version. This works with [independent releases](/recipes/nx-release/release-projects-independently) as well, allowing for only some projects to be released and some to be skipped.
{% /callout %}

## Usage with Independent Releases

If you are using [independent releases](/recipes/nx-release/release-projects-independently), Nx Release will determine the version bump for each project independently. For example, if the git history looks like this:

```
  - fix(pkg-1): fix something
  - feat(pkg-2): add a new feature
  - chore(pkg-3): update docs
  - chore(release): publish
```

Nx Release will select the `patch` version bump for `pkg-1` and `minor` for `pkg-2`. `pkg-3` will be skipped entirely, since it has no `feat` or `fix` commits.

{% callout type="info" title="Determining if a commit affects a project" %}
Note that this determination is made based on files changed by each commit, _not_ by the scope of the commit message itself. This means that `feat(pkg-2): add a new feature` could trigger a version bump for a project other than `pkg-2` if it updated files in another project.
{% /callout %}

An example partial output of running Nx Release with independent releases and conventional commits enabled:

```{% command="nx release" %}

 NX   Running release version for project: pkg-1

pkg-1 🏷️ Resolved the current version as 0.4.0 from git tag "pkg-1@0.4.0", based on releaseTagPattern "{projectName}@{version}"
pkg-1 📄 Resolved the specifier as "patch" using git history and the conventional commits standard
pkg-1 ❓ Applied semver relative bump "patch", derived from conventional commits data, to get new version 0.4.1
pkg-1 ✍️ New version 0.4.1 written to manifest: packages/pkg-1/package.json

 NX   Running release version for project: pkg-2

pkg-2 🏷️ Resolved the current version as 0.4.0 from git tag "pkg-2@0.4.0", based on releaseTagPattern "{projectName}@{version}"
pkg-2 📄 Resolved the specifier as "minor" using git history and the conventional commits standard
pkg-2 ❓ Applied semver relative bump "minor", derived from conventional commits data, to get new version 0.5.0
pkg-2 ✍️ New version 0.5.0 written to manifest: packages/pkg-2/package.json

 NX   Running release version for project: pkg-3

pkg-3 🏷️ Resolved the current version as 0.4.0 from git tag "pkg-3@0.4.0", based on releaseTagPattern "{projectName}@{version}"
pkg-3 🚫 No changes were detected using git history and the conventional commits standard

```
