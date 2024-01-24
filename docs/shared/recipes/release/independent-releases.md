# Releasing Projects Independently

Nx Release supports releasing projects independently. This is useful when you have a monorepo with projects that are not released on the same schedule.

## Configuring Independent Releases

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

When configured for independent releases, Nx Release will prompt for a version bump for each project that is being released. This allows the version of each package differ over time.

### Create a Git Tag for Each Project

Since each project can have a different version, Nx Release will create a git tag for each project that is being released. By default, the tag for each package will follow the pattern `{projectName}@{version}`. For example, if the `pkg-1` project is being released with version `1.1.0`, its git tag will be `pkg-1@1.1.0`.

This can still be changed with the `release.releaseTagPattern` property in `nx.json`, but be sure to include `{projectName}` in the pattern.

```json nx.json
{
  "release": {
    "releaseTagPattern": "{projectName}@{version}"
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
      "projectChangelogs": {}
    }
  }
}
```

Just like before, you can still preview changes to the changelog files by running Nx Release with the `--dry-run` option.

## Using the Projects Filter

One of the key benefits of independent releases is the ability to release only a subset of projects. Nx Release supports this with the `--projects` option. This option accepts a comma separated list of project names. For example, to release only the `pkg-1` and `pkg-2` projects, you would run:

```shell
nx release --projects=pkg-1,pkg-2
```

All other projects in the workspace will be ignored and only `pkg-1` and `pkg-2` will be versioned, have their changelogs updated, and published.
