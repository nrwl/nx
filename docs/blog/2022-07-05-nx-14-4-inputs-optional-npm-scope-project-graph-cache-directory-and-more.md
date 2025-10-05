---
title: 'Nx 14.4 — Inputs, optional npm scope, project graph cache directory and more!'
slug: 'nx-14-4-inputs-optional-npm-scope-project-graph-cache-directory-and-more'
authors: ['Juri Strumpflohner']
cover_image: '/blog/images/2022-07-05/lpmHhIiE9v5yJI6nLi2dlw.avif'
tags: [nx, release]
description: 'Nx 14.4 enhances build caching with configurable inputs, simplifies workspace setup with optional npm scope, and optimizes CI performance with project graph improvements.'
---

Our [last release blog post](/blog/nx-14-2-angular-v14-storybook-update-lightweight-nx-and-more) has been published not even a month ago and we already released 2 more minors. You missed the releases? No worries, we've got you covered. Here's all you need to know.

## targetDependencies -> targetDefaults

To get things started, `targetDependencies` got renamed to `targetDefaults`. We originally named them `targetDependencies` because you were able to define dependencies among project targets (e.g. to run the `build` target of dependent projects). See the next section for some more info about that.

You could always do more though. However, with our current mission to reduce configuration duplication, the now-called `targetDefaults` will get more powerful by allowing you to define sensible defaults for your project configs in a central place.

> _Don't worry, if you're using `nx migrate` it'll handle the rewriting for you._

## Syntactic sugar for "dependsOn"

One of the key features of the Nx task scheduling system is that it is able to automatically build/test/lint/{name your operation} dependencies of your project. If you have `proj-a` which has a dependency on `proj-b` and we run `nx build proj-a` then Nx automatically builds `proj-b` before building `proj-a`. Why? Because `proj-a` depends on the output of `proj-b`.

These target defaults can be defined

- globally at the `nx.json` level for all the projects in the workspace
- per project level in the `project.json`/`package.json` depending whether you use the [project.json config option](/reference/project-configuration) or [package.json](/reference/project-configuration)

You can still use the same notation as you did until now:

```json {% fileName="nx.json" %}
{
  ...
  "targetDefaults": {
    "build": {
        "dependsOn": [
            {
                "target": "build",
                "projects": "dependencies"
              }
        ]
    }
  },
  ...
}
```

With this release we introduce another, much more concise and elegant way of expressing the same:

```json {% fileName="nx.json" %}
{
  ...
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"]
    }
  },
  ...
}
```

Similarly, if you don't specify the `^` it would be the same as writing the following:

```json {% fileName="nx.json" %}
{
  ...
  "targetDefaults": {
    "build": {
        "dependsOn": [
            {
                "target": "prebuild",
                "projects": "self"
              }
        ]
    }
  },
  ...
}
```

In that case target `prebuild` on the project itself is invoked before running its `build` target.

## Inputs, Named Inputs, ENV and runtime variables

In order to improve cache hits we added the possibility to define `inputs`. For example on the `build` target, you could define the following input glob pattern to avoid cache invalidation when only spec files got changed.

```json {% fileName="nx.json" %}
{
    ...
    "targetDefaults": {
        "build": {
            "inputs": ["!{projectRoot}/**/*.spec.ts"]
        }
    }
}
```

You can have as many inputs as you like. Also, in order to avoid ambiguity when specifying the path, you need to use either `{projectRoot}` or `{workspaceRoot}` in the glob pattern.

Since you might want to **reuse certain patterns across multiple targets**, we also introduced `namedInputs`, which allows you to define a set of patterns that can then be referenced in the various `targetDefaults`:

```json {% fileName="nx.json" %}
{
    ...
    "namedInputs": {
        "prodFiles": ["!{projectRoot}/**/*.spec.ts"]
    },
    "targetDefaults": {
        "build": {
            "inputs": ["prodFiles", "^prodFiles"]
        },
        "publish": {
            "inputs": ["prodFiles", "^prodFiles"]
        }
    }
}
```

Note, by also adding `^` in front of the named input pattern, it also gets applied to all dependent projects, just like with the `dependsOn` definition.

**Inputs can not only just be file globs, but also runtime or environment variables**. This makes the `inputs` even more powerful and helps improve cache hits. In the following example, the environment variable "SELECTED_CLI", as well as the runtime output of running `node -v` would be included in the computation of the hash used for storing the cached result.

```json {% fileName="nx.json" %}
{
    ...
    "targetDefaults": {
        "e2e": {
            "inputs": [
                {
                    "env": "SELECTED_CLI"
                },
                {
                    "runtime": "node -v"
                }
            ]
        }
    }
}
```

> _Note that `targetDefaults` is just a way to specify project-specific settings in a central place within the `nx.json`. All of these can directly also be added to the `package.json` or `project.json` (depending on which approach you use for configuring your projects)._

Check out the following video which goes into some of the details on the example of a [Lerna](https://lerna.js.org/) monorepo that uses the new Nx inputs configuration.

{% youtube src="https://youtu.be/u91YHPwddEM" /%}

## Optional npmScope

When you create a new Nx workspace it sets up a "npm scope" which you can find in the `nx.json`.

```json {% fileName="nx.json" %}
{
    "npmScope": "myorg",
    ...
}
```

Although most of the time you might want to use one, it is not mandatory any more. This contributes to our mission of simplifying Nx and making it more flexible.

## Speeding up workspace config computation

Project configuration calculations can take up quite some time in large workspaces. Starting with v14.4 we offloaded that part to the [Nx Daemon](/concepts/nx-daemon), optimizing the overall command execution time in particular for large workspaces.

## New NX_PROJECT_GRAPH_CACHE_DIRECTORY

When using shared volumes on CI, different consumers of the cache can write a different project graph to the cache, thus overwriting one that may be in use by other consumers. Up until now, there was no way to specify a different cache directory just for the project graph.

With this release, we introduce a new `NX_PROJECT_GRAPH_CACHE_DIRECTORY` environment variable to dictate where Nx (and the Nx Daemon) should store the project graph cache.

## Angular updates

In Nx v14.2 we [also shipped the Angular v14 migrations](/blog/nx-14-2-angular-v14-storybook-update-lightweight-nx-and-more) which went smoothly. We keep improving our support. In this release in particular we

- added support to generate Storybook stories also for Angular standalone components
- upgraded `@angular-eslint/*` to version 14
- added support for `ngrx` version 14

## How to Update Nx

Updating Nx is done with the following command, and will update your Nx workspace dependencies and code to the latest version:

```shell
npx nx migrate latest
```

After updating your dependencies, run any necessary migrations.

```shell
npx nx migrate --run-migrations
```

## Exciting?

We're already deep into following our v15 [roadmap](https://github.com/nrwl/nx/discussions/9716) with a lot of cool stuff coming up on the horizon.

Makes sure you don't miss anything by

- Following us [on Twitter](https://twitter.com/NxDevTools), and
- Subscribe to the [YouTube Channel](https://youtube.com/nrwl_io?sub_confirmation=1) for more information on [Angular](https://angular.io/), [React](https://reactjs.org/), Nx, and more!
- Subscribing to [our newsletter](https://go.nx.dev/nx-newsletter)!
