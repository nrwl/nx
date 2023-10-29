---
title: Fine-tuning Caching with Inputs
description: 'Learn how to optimize cache results by customizing what should be taken into account when invalidating the cache'
---

# Fine-tuning Caching with Inputs

When Nx [computes the hash for a given operation](/concepts/how-caching-works), it takes into account the `inputs` of the target. The `inputs` are a list of **file sets**, **runtime** inputs and **environment variables** that affect the output of the target. If any of the `inputs` change, the cache is invalidated and the target is re-run.

To understand some of the examples below, let's imagine the following simple workspace.

{% graph height="450px" %}

```json
{
  "projects": [
    {
      "name": "myreactapp",
      "type": "app",
      "data": {
        "tags": []
      }
    },
    {
      "name": "shared-ui",
      "type": "lib",
      "data": {
        "tags": []
      }
    }
  ],
  "dependencies": {
    "myreactapp": [
      { "source": "myreactapp", "target": "shared-ui", "type": "static" }
    ],
    "shared-ui": []
  },
  "workspaceLayout": { "appsDir": "", "libsDir": "" },
  "affectedProjectIds": [],
  "focus": null,
  "groupByFolder": false
}
```

{% /graph %}

## Global vs per-project inputs

Tasks can have `inputs` defined for them [globally in the `nx.json` file](/reference/nx-json#inputs-&-namedinputs) or [on a per-project basis in the project configuration](/reference/project-configuration#inputs-&-namedinputs).

{% tabs %}
{% tab label="Global" %}

```json {% fileName="nx.json" highlightLines=[4] %}
{
  "targetDefaults": {
    "build": {
      "inputs": ["..."]
    }
  }
}
```

{% /tab %}
{% tab label="Project Level (project.json)" %}

```json {% fileName="packages/some-project/project.json" highlightLines=[6] %}
{
  "name": "some-project",
  ...
  "targets": {
    "build": {
      "inputs": ["..."],
      ...
    }
    ...
  }
}
```

{% /tab %}

{% tab label="Project Level (package.json)" %}

```json {% fileName="packages/some-project/package.json" highlightLines=[9] %}
{
  "name": "some-project",
  "dependencies": {},
  "devDependencies": {},
  ...
  "nx": {
    "targets": {
      "build": {
        "inputs": ["..."],
        ...
      }
      ...
    }
  }
}
```

{% /tab %}

## Include all project files and dependencies in cache hash

The following definition includes all files of the project itself as well as all of its dependencies in the cache hash, hence telling Nx to invalidate the cache whenever

- any file of the project itself changes
- any file of any dependency changes

```jsonc {% fileName="nx.json" %}
{
  "namedInputs": {
    "default": ["{projectRoot}/**/*"]
  },
  "targetDefaults": {
    "build": {
      "inputs": ["default", "^default"]
    }
  }
}
```

This definition is the default behavior of Nx, even if you don't specify any `inputs` at all. This is a rather cautious approach. It will always give you correct output, but it might re-run a task in some cases where the cache could have been used instead.

Note, Nx uses the [minimatch](https://github.com/isaacs/minimatch) library to process glob patterns.

{% callout title="Replacements" %}

Note how you can use `{projectRoot}` and `{workspaceRoot}` as placeholders to simplify writing glob definitions.

{% /callout %}

If you're wondering what `namedInputs` are, read the next section.

## Reusing inputs definitions with namedInputs

If you find yourself reusing the same `inputs` definitions, you can instead create a `namedInput`. It is like a variable definition which can then be reused in the `inputs` array.

```jsonc {% fileName="nx.json" highlightLines=[3, 7] %}
{
  "namedInputs": {
    "default": ["{projectRoot}/**/*"]
  },
  "targetDefaults": {
    "build": {
      "inputs": ["default", "^default"]
    }
  }
}
```

The `^` character at the beginning of the `^default` string means this entry applies to the project dependencies of the project, not the project itself. In our example `myreactapp` depends on `shared-ui`, so if we run

```shell
nx build myreactapp
```

...then because we defined

- `"inputs": ["default",...]` - it will invalidate the cache of `myreactapp` whenever some src file of `myreactapp` itself changes
- `"inputs": [..., "^default"]` - it will in addition invalidate the cache of `myreactapp` whenever a file of `shared-ui` (or any of its dependencies) changes

## Exclude files from invalidating cache

Sometimes you might want to exclude specific project files so that they don't invalidate the cache for a given target. For example, we want spec/test files to invalidate the `test` target (by explicitly including `*.spec.ts` files), but we might want to optimize and exclude them from our `build` target. Hence, whenever we just change a test file, our `build` cache would still be working.

Here's how we could define that, starting from our default situation:

```jsonc {% fileName="nx.json" highlightLines=[4, 5, 6, 7, 11] %}
{
  "namedInputs": {
    "default": ["{projectRoot}/**/*"],
    "production": ["default", "!{projectRoot}/**/?(*.)+spec.ts"]
  },
  "targetDefaults": {
    "build": {
      "inputs": ["production", "^production"]
    }
  }
}
```

Note how we define a new `production` named input which uses the `default` named input and then excludes (note the `!`) all spec related files. As a result, if a spec file changes either in `myreactapp` or in `shared-ui`, the `build` target cache will not be invalidated.

## Include environment variables in cache hash

You can also include environment variables in the cache hash key calculation in order to invalidate the cache if the environment variable value changes.

```jsonc {% fileName="nx.json" highlightLines=[12] %}
{
  "namedInputs": {
    "default": ["{projectRoot}/**/*"]
  },
  "targetDefaults": {
    "build": {
      "inputs": [
        "default",
        "^default",

        // this will include the value of API_KEY in the cache hash
        { "env": "API_KEY" }
      ]
    }
  }
}
```

## Include Runtime Information in the Cache Hash

Sometimes you might also want to consider runtime information as part of your hash. Assume you have a deploy target for the `myreactapp` and assume we use [Fly](https://fly.io/) for it. We might want to make sure to just use the cache if the Fly version matches.

You can define it globally in the `nx.json` but these targets are usually defined right where the project is, so here's an example of a `package.json` and `project.json` definition.

{% tabs %}
{% tab label="package.json" %}

```jsonc {% fileName="apps/myreactapp/package.json" highlightLines=[15] %}
{
  "name": "myreactapp",
  "dependencies": {},
  "scripts": {
    "deploy": "fly deploy"
  },
  ...
  "nx": {
    "targets": {
      "deploy": {
        "inputs": [
          ...

          // includes the value of running "fly version" in the cache hash
          { "runtime": "fly version" }
        ],
        "dependsOn": ["build"],
      }
    }
  }
}
```

{% /tab %}
{% tab label="project.json" %}

```jsonc {% fileName="apps/myreactapp/project.json" highlightLines=[13] %}
{
  "name": "reactapp",
  ...
  "sourceRoot": "apps/reactapp/src",
  "projectType": "application",
  "targets": {
    "deploy": {
      "command": "fly deploy",
      "inputs": [
        ...

        // includes the value of running "fly version" in the cache hash
        { "runtime": "fly version" }
      ],
      "cwd": "dist/{projectRoot}",
      "dependsOn": ["build"]
    },
    ...
  }
}
```

{% /tab %}

## Include or Exclude External NPM dependencies from the Cache

You can also get more fine-grained when it comes to external dependencies. In our example of the Fly.io deployment, we don't really rely on any NPM packages for the deployment step, so we could ignore all of them. This can be done by using the `externalDependencies` property.

{% tabs %}
{% tab label="package.json" %}

```jsonc {% fileName="apps/myreactapp/package.json" highlightLines=[14] %}
{
  "name": "myreactapp",
  "dependencies": {},
  "scripts": {
    "deploy": "fly deploy"
  },
  ...
  "nx": {
    "targets": {
      "deploy": {
        "inputs": [
          ...,
          // this explicitly tells the hasher to ignore all external packages when calculating the hash
          { "externalDependencies": [] },

          // includes the value of running "fly version" in the cache hash
          { "runtime": "fly version" }
        ],
        "dependsOn": ["build"],
      }
    }
  }
}
```

{% /tab %}
{% tab label="project.json" %}

```jsonc {% fileName="apps/myreactapp/project.json" highlightLines=[12] %}
{
  "name": "reactapp",
  ...
  "sourceRoot": "apps/reactapp/src",
  "projectType": "application",
  "targets": {
    "deploy": {
      "command": "fly deploy",
      "inputs": [
        ...,
        // this explicitly tells the hasher to ignore all external packages when calculating the hash
        { "externalDependencies": [] },

        // includes the value of running "fly version" in the cache hash
        { "runtime": "fly version" }
      ],
      "cwd": "dist/{projectRoot}",
      "dependsOn": ["build"]
    },
    ...
  }
}
```

{% /tab %}

By explicitly providing an empty array, we ignore all changes to external NPM packages. Similarly we could have another example, where we depend on just one specific NPM package. Like if we use [Lerna](https://lerna.js.org) for publishing, we can define it like this:

```jsonc {% fileName="apps/myreactapp/project.json" highlightLines=[8] %}
{
  "targets": {
    "publish": {
      "command": "lerna publish",
      "inputs": [
        "production",
        // we explicitly say that our run-commands depends on lerna only
        { "externalDependencies": ["lerna"] }
      ],
      "dependsOn": ["build"],
      "cwd": "dist/{projectRoot}"
    }
  }
}
```
