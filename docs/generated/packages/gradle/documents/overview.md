---
title: Overview of the Nx Gradle Plugin
description: The Nx Gradle plugin contains generators and plugins that are useful for Gradle projects in an Nx workspace.
---

The Nx Gradle plugin contains generators and plugins that are useful for Gradle projects in an Nx workspace.

## Setting Up @nx/gradle

### Installation

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/gradle` version that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

In any Nx workspace, you can install `@nx/gradle` by running the following command:

```shell {% skipRescope=true %}
nx init
nx add @nx/gradle
```

### How @nx/gradle Infers Tasks

The `@nx/gradle` plugin will create a task for any project that has an app configuration file present. Any of the following files will be recognized as an app configuration file:

- `gradle.build`
- `gradle.build.kts`

### View Inferred Tasks

To view inferred tasks for a project, open the [project details view](/concepts/inferred-tasks) in Nx Console or run `nx show project my-project --web` in the command line.

### @nx/gradle Configuration

The `@nx/gradle` is configured in the `plugins` array in `nx.json`.

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/gradle",
      "options": {
        "testTargetName": "test",
        "classesTargetName": "classes",
        "buildTargetName": "build"
      }
    }
  ]
}
```

Once a Gradle configuration file has been identified, the targets are created with the name you specify under `testTargetName`, `classesTargetName` or `buildTargetName` in the `nx.json` `plugins` array. The default names for the inferred targets are `test`, `classes` and `build`.
