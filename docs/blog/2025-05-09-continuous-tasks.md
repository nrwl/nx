---
title: 'Continuous tasks are a huge DX improvement'
slug: nx-21-continuous-tasks
authors: ['Philip Fulcher']
tags: ['nx']
cover_image: /blog/images/2025-05-09/continuous-tasks.avif
description: 'Learn how to use continuous tasks in Nx 21 to improve your developer experience.'
youtubeUrl: https://youtu.be/AD51BKJtDBk
---

{% callout type="deepdive" title="Nx 21 Launch Week" expanded=true %}

This article is part of the Nx 21 Launch Week series:

- [Nx 21 Release: Continuous tasks and Terminal UI lead the way](/blog/nx-21-release)
- [Introducing Migrate UI in Nx Console](/blog/migrate-ui)
- [New and Improved Module Federation Experience](/blog/improved-module-federation)
- **Continuous tasks are a huge DX improvement**
- [A New UI For The Humble Terminal](/blog/nx-21-terminal-ui)

{% /callout %}

Continuous tasks are one of the most exciting features we've launched that radically improve the developer experience (DX) of your monorepo.

{% toc /%}

## What are continuous tasks?

Many of the tasks in your workspace are finite: they run, produce an output, and shut down on their own. **Continuous tasks** are long-lived tasks: they run until interrupted by an outside input. These are tasks like serving your application or running tests in watch mode. While Nx has always supported running these tasks, you couldn't configure other tasks to depend on them.

For example, you could serve your backend and frontend separately, but you couldn't easily configure your backend to be served whenever your frontend is served. There are always options like opening two separate terminals to run the tasks or setting up a specific script or task for running these in parallel. But the DX has always been lacking.

Now, tasks can be marked as continuous, and other tasks can depend on them. Nx will no longer wait for these tasks to shut down before invoking the tasks that depend on them. These continuous tasks can be configured as part of a task pipeline like any other task. Let's walk through some examples of how to use these in your task pipelines.

## What is a task pipeline?

A [task pipeline](/docs/concepts/task-pipeline-configuration) is a series of definitions determining how tasks depend on one another. In a monorepo, you're rarely running a single task. That task may rely on the output of another task. For example, if your application depends on a buildable design system library, the design system must be built before the application. The application's `build` task depends on the design system's `build` task.

This is such a common pipeline that we include it by default when Nx workspaces are created. It's defined in your `nx.json` in `targetDefaults`:

```json {% fileName="nx.json" %}
{
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"]
    }
  }
}
```

This task pipeline says that all `build` tasks depend on the `build` task of any project it depends on, also known as "descendants." The `^` indicates descendants.

`targetDefaults` is where you can define task pipelines for all tasks with that name, but you can also define them at the task level. This same task pipeline could be defined on an individual project:

```json {% fileName="apps/frontend/package.json" %}
{
  "nx": {
    "targets": {
      "build": {
        "dependsOn": ["^build"]
      }
    }
  }
}
```

This is a brief overview of task pipelines. Be sure to [check the docs](/docs/guides/tasks--caching/defining-task-pipeline) for more details.

But these examples configure finite tasks: tasks that start up, produce an artifact, and then shut down. How do things change when we configure continuous tasks?

{% callout type="note" title="See these examples in action" %}
To see these examples working in an actual workspace, be sure to [checkout the video](https://youtu.be/y1Q1QSBEsuA).
{% /callout %}

## Frontend serve depends on backend serve

Assuming we run a `dev` target from our `frontend` project, and a `serve` target from our `api` project, we configure this on the frontend project like this:

```json {% fileName="apps/frontend/package.json" %}
{
  "nx": {
    "name": "frontend",
    "targets": {
      "dev": {
        "dependsOn": [{ "projects": ["api"], "target": "serve" }]
      }
    }
  }
}
```

The `frontend:dev` task now depends on `api:serve`. We must also ensure the `api:serve` target is flagged as continuous. Tasks are already flagged as continuous if you're using [inferred tasks](/docs/concepts/inferred-tasks). If your target uses an executor, you must flag those targets as continuous yourself. This is as easy as adding `continuous: true` to the target configuration like so:

```json {% fileName="apps/api/package.json" %}
{
  "name": "api",
  ...
  "nx": {
    "targets": {
      "serve": {
        "continuous": true
      }
    }
  }
}
```

Now running `frontend:dev` will also result in the `api:serve` starting in parallel. If we look at the task graph using Nx Console or `nx graph`, we'll see the new task pipeline:

![Graph showing connections between frontend and backend serve tasks](/blog/images/2025-05-09/frontend-to-backend.avif)

In addition to making for a great local development experience, e2e test suites that also run `frontend:dev` will have the same experience. The frontend and backend will be served at the same time, making e2e tests easier to run locally.

## Configuring custom commands as continuous

So far, we've talked about tasks from Nx plugins, but what about the custom targets you've added to your project? Continuous tasks work the same way. Let's say our project has a `codegen` target that uses graphql-codegen. The configuration for this target looks like this:

```json {% fileName="packages/models-graphql/package.json" %}
{
  "nx": {
    "targets": {
      "codegen": {
        "command": "npx graphql-codegen --config {projectRoot}/codegen.ts"
      }
    }
  }
}
```

This only allows for a static output, though: it runs once, produces the artifact, and shuts down. That works well for our `build` task pipeline, where we would define a task pipeline like this:

```json {% fileName="apps/frontend/package.json" %}
{
  "nx": {
    "targets": {
      "build": {
        "dependsOn": ["^build", "codegen", "^codegen"]
      }
    }
  }
}
```

Any time `build` is run on a project, it also runs the `build` task for any descendants, the `codegen` task on the project itself, and `codegen` on any descendants. This ensures we have the latest version of our generated models whenever we run `build` on an application. We want that same experience for our local dev experience when serving the frontend application.

First, we create a continuous version of our `codegen` target so that now our configuration looks like this:

```json {% fileName="packages/models-graphql/package.json" %}
{
  "nx": {
    "name": "models-graphql",
    "targets": {
      "codegen": {
        "command": "npx graphql-codegen --config {projectRoot}/codegen.ts"
      },
      "watch-codegen": {
        "continuous": true,
        "command": "npx graphql-codegen --config {projectRoot}/codegen.ts --watch"
      }
    }
  }
}
```

We have a new target called `watch-codegen` that is marked as continuous. We added the `--watch` flag to the command. Now, when we run `watch-codegen` on a project, it will watch for changes to the GraphQL schema and re-generate models. We can apply this to any project that needs it.

Now we can add dependencies from our `serve` targets to depend on `watch-codegen`:

```json {% fileName="apps/frontend/package.json" %}
{
  "nx": {
    "name": "frontend",
    "targets": {
      "dev": {
        "dependsOn": [
          { "projects": ["api"], "target": "serve" },
          "^watch-codegen"
        ]
      },
      "serve": {
        "dependsOn": [{ "projects": ["api"], "target": "serve" }]
      }
    }
  }
}
```

Our frontend app may not have its own `codegen` target, so the `serve` can depend on the `^watch-codegen` descendants.

And for the backend:

```json {% fileName="apps/api/package.json" %}
{
  "nx": {
    "name": "api",
    "targets": {
      "serve": {
        "continuous": true,
        "dependsOn": ["watch-codegen", "^watch-codegen"]
      },
      "codegen": {
        "command": "npx graphql-codegen --config {projectRoot}/codegen.ts"
      },
      "watch-codegen": {
        "continuous": true,
        "command": "npx graphql-codegen --config {projectRoot}/codegen.ts --watch"
      }
    }
  }
}
```

Since our backend project has its own codegen target, it needs to depend on both its own `watch-codegen` and `^watch-codegen` for its descendants.

## What can continuous tasks do for you?

We've covered a few different scenarios here, and the [video shows them all working inside an actual workspace](https://youtu.be/y1Q1QSBEsuA). We can visualize the task graph that we've just created to see how much we've accomplished:

![Graph showing connections between frontend and backend serve tasks as well as watch-codegen tasks](/blog/images/2025-05-09/watch-codegen.avif)

Now, developers can run `npx nx dev frontend` and have the `api:serve` and `watch-codegen` tasks run. One command, one terminal, and they are ready to work immediately. No more fumbling through multiple terminals or creating your own solution to the problem. Nx provides the tools to improve your developer experience.

What processes could you improve using continuous tasks?

Learn more:

- 🧠 [Nx AI Docs](/docs/features/enhance-ai)
- 🌩️ [Nx Cloud](/nx-cloud)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 👩‍💻 [Nx Console GitHub](https://github.com/nrwl/nx-console)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
