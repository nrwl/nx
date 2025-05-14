---
title: Automate GitLab Releases
description: Learn how to configure Nx Release to automatically create GitLab releases with changelogs generated from your conventional commits, for both workspace and project-level releases.
---

# Automate GitLab Releases

Nx Release can automate the creation of [GitLab releases](https://docs.gitlab.com/user/project/releases/) for you. GitLab releases are a great way to communicate the changes in your projects to your users.

<!-- Prettier will mess up the end tag of the callout causing it to capture all content that follows it -->
<!-- prettier-ignore-start -->

{% callout type="note" title="Authenticating with GitLab" %}
In order to be able to create the release on GitLab, you need to provide a valid token which can be used for authenticating with the GitLab API.

Nx release supports two main ways of doing this:

1. In all environments it will preferentially check for an environment variable (the environment variable can either be called `GITLAB_TOKEN` or `GL_TOKEN`).
2. In GitLab CI it will check for and use the automatically created GitLab token in the `CI_JOB_TOKEN` environment variable.
{% /callout %}
<!-- prettier-ignore-end -->

## GitLab Release Contents

When a GitLab release is created, it will include the changelog that Nx Release generates with entries based on the changes since the last release. Nx Release will parse the `feat` and `fix` type commits according to the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification and sort them into appropriate sections of the changelog.

## Enable Release Creation

To enable GitLab release creation for your workspace, set `release.changelog.workspaceChangelog.createRelease` to `'gitlab'` in `nx.json`:

```json
{
  "release": {
    "changelog": {
      "workspaceChangelog": {
        "createRelease": "gitlab"
      }
    }
  }
}
```

## Preview the Release

Use `nx release --dry-run` to preview the GitLab release instead of creating it. This allows you to see what the release will look like without pushing anything to GitLab.

## Disable File Creation

Since GitLab releases contain the changelog, you may wish to disable the generation and management of the local `CHANGELOG.md` file. To do this, set `release.changelog.workspaceChangelog.file` to `false` in `nx.json`:

```json
{
  "release": {
    "changelog": {
      "workspaceChangelog": {
        "file": false,
        "createRelease": "gitlab"
      }
    }
  }
}
```

Note: When configured this way, Nx Release will not delete existing changelog files, just ignore them.

## Project Level Changelogs

Nx Release supports creating GitLab releases for project level changelogs as well. This is particularly useful when [releasing projects independently](/recipes/nx-release/release-projects-independently). To enable this, set `release.changelog.projectChangelogs.createRelease` to `'gitlab'` in `nx.json`:

```json
{
  "release": {
    "changelog": {
      "projectChangelogs": {
        "createRelease": "gitlab"
      }
    }
  }
}
```

{% callout type="warning" title="Project and Workspace GitLab Releases" %}
Nx Release does not support creating GitLab releases for both project level changelogs and the workspace changelog. You will need to choose one or the other.
{% /callout %}

## Customizing the GitLab instance

If you are not using gitlab.com, and are instead using a self-hosted GitLab instance, you can use a configuration object instead of the string for "createRelease" to provide the relevant hostname, and optionally override the API base URL, although this is not typically needed as it will default to `https://${hostname}/api/v4`.

```json
{
  "release": {
    "changelog": {
      "workspaceChangelog": {
        "createRelease": {
          "provider": "gitlab",
          "hostname": "gitlab.example.com"
        }
      }
    }
  }
}
```
