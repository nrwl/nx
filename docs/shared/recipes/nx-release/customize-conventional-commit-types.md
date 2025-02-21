# Customize Conventional Commit Types

[Nx release](/features/manage-releases) allows you to leverage the [conventional commits](/recipes/nx-release/automatically-version-with-conventional-commits) standard to automatically determine the next version increment.

By default, this results in:

- `feat(...)` triggering a minor version bump (`1.?.0`)
- `fix(...)` triggering a patch version bump (`1.?.x`)
- `BREAKING CHANGE` in the footer of the commit message or with an exclamation mark after the commit type (`fix(...)!`) triggers a major version bump (`?.0.0`)

{% callout type="info" title="No changes detected" %}
If Nx Release does not find any relevant commits since the last release, it will skip releasing a new version. This works with [independent releases](/recipes/nx-release/release-projects-independently) as well, allowing for only some projects to be released while others are skipped.
{% /callout %}

However, you can customize how Nx interprets these conventional commits, for both **versioning** and **changelog** generation.

## Disable a Commit Type for Versioning and Changelog Generation

To disable a commit type, set it to `false`.

```json {% fileName="nx.json" %}
{
  "release": {
    "conventionalCommits": {
      "types": {
        // disable the docs type for versioning and in the changelog
        "docs": false,
        ...
      }
    }
  }
}
```

If you just want to disable a commit type for versioning, but still want it to appear in the changelog, set `semverBump` to `none`.

```json {% fileName="nx.json" %}
{
  "release": {
    "conventionalCommits": {
      "types": {
        // disable the docs type for versioning, but still include it in the changelog
        "docs": {
          "semverBump": "none",
          ...
        },
        ...
      }
    }
  }
}
```

## Changing the Type of Semver Version Bump

Assume you'd like `docs(...)` commit types to cause a `patch` version bump. You can define that as follows:

```json {% fileName="nx.json" %}
{
  "release": {
    "conventionalCommits": {
      "types": {
        "docs": {
          "semverBump": "patch",
          ...
        },
      }
    }
  }
}
```

## Renaming the Changelog Section for a Commit Type

To rename the changelog section for a commit type, set the `title` property.

```json {% fileName="nx.json" %}
{
  "release": {
    "conventionalCommits": {
      "types": {
        ...
        "docs": {
          ...
          "changelog": {
            "title": "Documentation Changes"
          }
        },
        ...
      }
    }
  }
}
```

## Hiding a Commit Type from the Changelog

To hide a commit type from the changelog, set `changelog` to `false`.

```json {% fileName="nx.json" %}
{
  "release": {
    "conventionalCommits": {
      "types": {
        ...
        "chore": {
          "changelog": false
        },
        ...
      }
    }
  }
}
```

Alternatively, you can set `hidden` to `true` to achieve the same result.

```json {% fileName="nx.json" %}
{
  "release": {
    "conventionalCommits": {
      "types": {
        ...
        "chore": {
          "changelog": {
            "hidden": true
          }
        },
        ...
      }
    }
  }
}
```

## Defining non-standard Commit Types

If you want to use custom, non-standard conventional commit types, you can define them in the `types` object. If you don't specify a `semverBump`, Nx will default to `patch`.

```json {% fileName="nx.json" %}
{
  "release": {
    "conventionalCommits": {
      "types": {
        "awesome": {}
      }
    }
  }
}
```

## Including Invalid Commits in the Changelog

Nx only includes commits in the changelog that match either the [default conventional commit types](https://github.com/nrwl/nx/blob/master/packages/nx/src/command-line/release/config/conventional-commits.ts) or types you've [added to your configuration](#defining-non-standard-commit-types).

You can configure Nx to include non-matching commits by adding the special `__INVALID__` type.

This can also be useful in cases where you don't use the Conventional Commits standard but still want a changelog to be generated with the contents of each commit message.

```json {% fileName="nx.json" %}
{
  "release": {
    "conventionalCommits": {
      "types": {
        "__INVALID__": {
          "semverBump": "paths", // Note: the default is "none"
          "changelog": {
            "title": "Uncategorized changes"
          }
        }
      }
    }
  }
}
```
