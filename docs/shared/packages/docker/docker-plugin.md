---
title: Overview of the Nx Docker Plugin
description: The Nx Plugin for Docker contains executors and utilities for building and publishing docker images within an Nx workspace.
keywords: [docker]
---

# @nx/docker

The Nx Plugin for Docker contains executors and utilities for building and publishing docker images within an Nx workspace.
Using the `@nx/docker` [Inference Plugin](/concepts/inferred-tasks), Nx will automatically detect `Dockerfile`'s in your workspace and provide a `docker:build` and `docker:run` target for each.  
It will also provide a `nx-release-publish` target for publishing docker images to a registry.

## Installation

In any Nx workspace, you can install `@nx/docker` by running the following command:

```shell {% skipRescope=true %}
nx add @nx/docker
```

This will install the correct version of `@nx/docker` to match the version of Nx you are using.

{% callout type="warning" %}
The `@nx/docker` plugin only became available in Nx 21.4.0-beta.9. Your Nx Workspace will need to be on this version or higher to use it.
{% /callout %}

### How @nx/docker Infers Tasks

The `@nx/docker` plugin will create a task for any project that has a Dockerfile present. It will infer the following tasks:

- `docker:build`
- `docker:run`
- `nx-release-publish`

### View Inferred Tasks

To view inferred tasks for a project, open the [project details view](/concepts/inferred-tasks) in Nx Console or run `nx show project my-project` in the command line.

### @nx/docker Configuration

The `@nx/docker` plugin is configured in the `plugins` array in `nx.json`.

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/docker",
      "options": {
        "buildTarget": "docker:build",
        "runTarget": "docker:run"
      }
    }
  ]
}
```

The `buildTarget` and `runTarget` options control the names of the inferred Docker tasks. The default names are `docker:build` and `docker:run`.

## Using Nx Release to Publish Docker Images

The `@nx/docker` plugin provides a `nx-release-publish` target for publishing docker images to a registry.  
[Nx Release](/features/manage-releases) was also updated to support versioning docker images, generating changelogs, and publishing docker images to a registry through a single command.

You can learn more about how to manage releases for Docker Images in the [Release Docker Images](/recipes/nx-release/release-docker-images) guide.
