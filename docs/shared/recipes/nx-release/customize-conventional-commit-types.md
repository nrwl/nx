# Customize Conventional Commit Types

Nx Release can defer to the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) standard to automatically determine the next version to release. To enable this behavior for versioning, see [Automatically Version with Conventional Commits](/recipes/nx-release/automatically-version-with-conventional-commits).

This recipe will cover how to customize the types of commits that trigger version bumps, how to customize the version bump for each type, and how to customize the changelog entry for each commit type.

## Conventional Commits Usage within Nx Release

The conventional commits configuration is used in two different places within Nx Release - once in the version step for determining the version bump, and once when generating changelogs.

### Determine the Version Bump

When `release.version.conventionalCommits` is `true` in `nx.json`, Nx Release will use the commit messages since the last release to determine the version bump. It will look at the type of each commit and determine the highest version bump from the following list:

- 'feat' -> minor
- 'fix' -> patch

For example, if the git history looks like this:

```
  - fix(pkg-1): fix something
  - feat(pkg-2): add a new feature
  - chore(pkg-3): update docs
  - chore(release): 1.0.0
```

then Nx Release will select the `minor` version bump and elect to release version 1.1.0. This is because there is a `feat` commit since the last release of 1.0.0. To customize the version bump for different types of commits, or to trigger a version bump with custom commit types, see the [Configure Commit Types](#configure-commit-types) section below.

{% callout type="info" title="No changes detected" %}
If Nx Release does not find any relevant commits since the last release, it will skip releasing a new version. This works with [independent releases](/recipes/nx-release/release-projects-independently) as well, allowing for only some projects to be released and some to be skipped.
{% /callout %}

### Generate Changelog Sections

Nx Release sorts changes within changelogs into sections based on the type of commit. By default, `fix`, `feat`, and `perf` commits will be included in the changelog. To customize the headers of changelog sections, include other commit types, or exclude the default commit types, see the [Configure Commit Types](#configure-commit-types) section below.

See the [Nx repo](https://github.com/nrwl/nx/releases) for examples of a changelogs generated with Nx Release.

## Configure Commit Types

Commit types are configured in the `release.conventionalCommits.types` property in `nx.json`:

```json nx.json
{
  "release": {
    "conventionalCommits": {
      "types": {
        // disable the fix type for versioning and in the changelog
        "fix": false,
        "docs": {
          "semverBump": "patch",
          "changelog": {
            "hidden": false,
            "title": "Documentation Changes"
          }
        },
        "perf": {
          "semverBump": "none",
          // omitting "hidden" will default it to false
          "changelog": {
            "title": "Performance Improvements"
          }
        },
        "deps": {
          "semverBump": "minor",
          // omitting "hidden" will default it to false
          "changelog": {
            "title": "Dependency Updates"
          }
        },
        // unspecified semverBump will default to "patch"
        "chore": {
          // "changelog.hidden" defaults to true, but setting changelog: false
          // is a shortcut for setting "changelog.hidden" to false.
          "changelog": false
        },
        // unspecified semverBump will default to "patch"
        "styles": {}
      }
    }
  }
}
```

In this example, the following types are configured:

- The `fix` type has been fully disabled, so `fix` commits will not trigger a version bump and will not be included in the changelog.
- The `docs` type will now trigger a `patch` version bump and will have the "Documentation Changes" title in the changelog.
- The `perf` type will NOT trigger a version bump and will have the "Performance Improvements" title in the changelog.
- The `deps` type will trigger a `minor` version bump and will have the "Dependency Updates" title in the changelog.
- The `chore` type will trigger a `patch` version bump, which is the default for if `versionBump` is not specified, and will not be included in the changelog.
- The `styles` type will trigger a `patch` version bump, which is the default for if `versionBump` is not specified, and will be included in the changelog with the corresponding default title.
