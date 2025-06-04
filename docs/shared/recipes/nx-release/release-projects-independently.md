---
title: Release Projects Independently
description: Learn how to configure Nx Release to version and publish projects independently in your monorepo, allowing different release schedules for different projects.
---

# Release Projects Independently

Nx Release supports releasing projects independently. This is useful when you have a monorepo with projects that are not released on the same schedule.

## Configure Independent Releases

To configure independent releases, add the following property to your `nx.json` file:

```nx.json
{
  "release": {
    "projectsRelationship": "independent"
  }
}
```

## Differences from Fixed Releases

Nx release will behave differently when configured for independent releases.

### Prompt for Multiple Version Bumps

When configured for independent releases, Nx Release will prompt for a version bump for each project that is being released. This allows the version of each project to differ over time.

### Create a Git Tag for Each Project

Since each project can have a different version, Nx Release will create a git tag for each project that is being released. By default, the tag for each project will follow the pattern `{projectName}@{version}`. For example, if the `pkg-1` project is being released with version `1.1.0`, its git tag will be `pkg-1@1.1.0`.

This can still be changed with the `release.releaseTagPattern` property in `nx.json`, but be sure to include `{projectName}` in the pattern so that each generated tag is unique.

For example, to generate the tags `release/pkg-1/1.1.0` and `release/pkg-2/1.2.1` for the `pkg-1` and `pkg-2` projects respectively, you would use the following configuration in nx.json:

```json nx.json
{
  "release": {
    "releaseTagPattern": "release/{projectName}/{version}"
  }
}
```

### Different Commit Message Structure

Even though Nx Release creates a git tag for each project, it will still create a single commit for the entire release. The commit message will still include all of the projects being released with their corresponding version. For example:

```
chore(release): publish

  - project: pkg-1 1.1.0

  - project: pkg-2 1.2.1

  - project: pkg-3 2.5.7
```

### Changelogs

Nx Release will no longer generate and update a workspace level `CHANGELOG.md` file when configured for independent releases. If you still want changelog generation, you will need to enable project level changelogs. These are similar to the workspace level changelog, but they are generated for each project individually and only contain changes for that specific project. They can be configured with the `release.changelog.projectChangelogs` property in `nx.json`.

```json nx.json
{
  "release": {
    "changelog": {
      "projectChangelogs": true
    }
  }
}
```

Just like with [fixed releases](/recipes/nx-release/get-started-with-nx-release), you can preview changes to the changelog files by running Nx Release with the `--dry-run` option.

## Use the Projects Filter

One of the key benefits of independent releases is the ability to release only a subset of projects. Nx Release supports this with the `--projects` option. The value is an array of strings, and you can use any of the same specifiers that are supported by `nx run-many`'s [projects filtering](/reference/core-api/nx/documents/run-many), such as explicit project names, Nx tags, directories and glob patterns, including negation using the `!` character. A few examples:

Release only the `pkg-1` and `pkg-2` projects:

```shell
nx release --projects=pkg-1,pkg-2
```

Release all projects in the `server` directory:

```shell
nx release --projects=server/*
```

Release all projects except those in the `ui` directory:

```shell
nx release --projects='!ui/*'
```

All other projects in the workspace will be ignored and only those that match the filter will be versioned, have their changelogs updated, and published.
