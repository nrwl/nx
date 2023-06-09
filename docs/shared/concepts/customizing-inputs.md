# Customizing Inputs and Named Inputs

The `inputs` property of a task allows you to define under what conditions the cache for that task should be invalidated and the task should be run again. Tasks can have `inputs` defined for them [globally in the `nx.json` file](/reference/nx-json#inputs-&-namedinputs) or [on a per-project basis in the project configuration](/reference/project-configuration#inputs-&-namedinputs). Those `inputs` can be `fileset`s, `runtime` inputs or `env` variables.

If you find yourself reusing the same `inputs` definitions, you can instead create a `namedInput` in the project configuration or `nx.json` and use that `namedInput` in your `inputs` array.

The `inputs` and `namedInputs` are parsed with the following rules:

1. `{projectRoot}` and `{workspaceRoot}` are replaced with the appropriate path
2. A `^` character at the beginning of the string means this entry applies to the project dependencies of the project, not the project itself.
3. Everything else is processed with the [minimatch](https://github.com/isaacs/minimatch) library

Knowing the syntax doesn't always explain how you would use the feature, so here are two scenarios explaining how to customize `inputs` to match your particular set up.

## Defaults

If you don't specify any `inputs`, Nx uses as inputs every file in the task's project and every file in that project's dependencies. It's the same as writing this:

```jsonc
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

This default behavior works and will always give you correct output, but it might re-run a task in some cases where the cache could have been used instead. Modifying `inputs` and `namedInputs` is all about getting the most you can out of the caching mechanism.

## Scenario 1: React App

Let's say we have a repo with two projects. There's a React app (`react-app`) that depends on a React UI library (`ui-library`).

### Global Settings

In the root `nx.json` file, we can set the following `namedInputs`:

```jsonc {% fileName="nx.json" %}
{
  "namedInputs": {
    "sharedGlobals": ["{workspaceRoot}/babel.config.json"],
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "production": [
      "default",
      "!{projectRoot}/**/*.spec.ts",
      "!{projectRoot}/**/*.md",
      "!{projectRoot}/tsconfig.spec.json",
      "!{projectRoot}/jest.config.ts",
      "!{projectRoot}/.eslintrc.json"
    ]
  }
}
```

This configuration defines three `namedInputs`.

- `sharedGlobals` contains root level files that should invalidate the cache for all projects. Note that `tsconfig.base.json` and the `package.json` lock files are handled behind the scenes by Nx so that when you modify the specific properties that affect your project, the cache is invalidated.
- `default` contains every file in the project and everything defined in `sharedGlobals`
- `production` starts with every file in `default`, but removes `.spec.ts` files, markdown files and some project-specific config files.

These names are not hard-coded. You can add your own `namedInputs` or rename these as you see fit.

With these `namedInputs` in place, we can set default `inputs` for project targets in `nx.json`:

```jsonc {% fileName="nx.json" %}
{
  "namedInputs": {
    "sharedGlobals": [
      /* ... */
    ],
    "default": [
      /* ... */
    ],
    "production": [
      /* ... */
    ]
  },
  "targetDefaults": {
    "build": {
      "inputs": ["production", "^production"],
      "dependsOn": ["^build"]
    },
    "test": {
      "inputs": ["default", "^production", "{workspaceRoot}/jest.preset.js"]
    }
  }
}
```

In this configuration, `build` needs to be re-run if the project's `production` files are changed or the dependencies' `production` files are changed. The `"dependsOn": ["^build"]` setting ensures that the output files of the dependencies are correct, but it does not tell Nx to re-run this project's build target when those outputs change. That's why `"^production"` is needed in the `inputs` array.

Note that we are using `^production` instead of `^default` because changing test files of a dependency should not invalidate the build cache for this project.

The `test` target cache is invalidated if test or production code is changed in this project (`default`) or if production code is changed in a dependency `^production`. The tests also need to be run again if the root level `jest.preset.js` file is modified.

### Project Settings

In the `ui-library` library, we have some `*.spec.tsx` files that we don't want to count as production files. We can modify the project configuration to account for this:

```jsonc {% command="ui-library/project.json" %}
{
  "namedInputs": {
    "production": [
      // copied this definition from nx.json
      "default",
      "!{projectRoot}/**/*.spec.ts",
      "!{projectRoot}/**/*.spec.tsx", // added this line
      "!{projectRoot}/**/*.md",
      "!{projectRoot}/tsconfig.spec.json",
      "!{projectRoot}/jest.config.ts",
      "!{projectRoot}/.eslintrc.json"
    ]
  }
}
```

Note that I need to copy the entire definition of `production` from `nx.json`. This entry overwrites the existing `production` entry defined in `nx.json`, but `default` and `sharedGlobals` are inherited. Now when I modify a `spec.tsx` file in `ui-library`, the build for `ui-library` is unaffected and the build for `react-app` is unaffected.

{% callout type="note" title="Modifying production in nx.json" %}

You could also handle this scenario by modifying the `production` definition in the `nx.json` so that it applies to all projects in the repo. In fact, the defaults created by Nx do exactly that: `"!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)"`. This is a complex glob expression though and is not particularly helpful for explaining the concepts of `inputs` and `namedInputs`.

{% /callout %}

The `build` and `test` `inputs` do not need to be modified at the project level, since the defaults defined at the root are still correct.

## Scenario 2: Generated Documentation Site

Let's say you have a repo with two projects, a `docs-site` app that contains all the code for rendering a documentation site and a `content` library that contains markdown files that are used as the content of the site.

The `content` library has a node script `.ts` file that is used to check through the markdown files for internal broken links. The `test` target looks like this:

```jsonc
{
  "targets": {
    "test": {
      "inputs": ["default", "^production"],
      "executor": "nx:run-commands",
      "command": "ts-node ./check-for-broken-links.ts"
    }
  }
}
```

Note that we are overwriting the default `inputs` for `test` because changes to the root `jest.preset.js` file shouldn't affect this project's tests.

This library's `production` definition should look like this:

```jsonc
{
  "namedInputs": {
    "production": ["default", "!{projectRoot}/**/*.ts"]
  }
}
```

This ensures that the `.md` files are included in the `production` file set, but the `check-for-broken-links.ts` script is not. Now changes to a markdown file in `content` will force a re-build of `docs-site`, even though changes to markdown files in `docs-site` will not force a re-build.

## Scenario 3: Deploying applications and publishing libraries

We can use `nx:run-commands` and a custom `deploy` target for deploying our applications. Normally, we want to deploy only the applications that have been affected by recent changes. The hash for checking whether a certain project was affected consists of several parts:

- The full command we are running (e.g. `nx run my-app:deploy`)
- The hash of the project's files and files of the dependencies
- The hash of the target executor's dependencies
  Since `nx:run-commands` is a special executor we can't automatically say what packages this executor depends on, so any change in the installed packages will cause a cache miss. This is of course not ideal.

We can therefore specify what external packages our executor should depend on (in this case none, we only depend on `fly` version)

```jsonc
{
  "targets": {
    "deploy": {
      "inputs": [
        "production",
        { "externalDependencies": [] }, // this explicitly tells hasher to ignore all external packages for executor
        { "runtime": "fly version" }
      ],
      "dependsOn": ["build"],
      "executor": "nx:run-commands",
      "cwd": "dist/{projectRoot}",
      "command": "fly deploy"
    }
  }
}
```

Similarly, we can specify dependencies for publishing libraries:

```jsonc
{
  "targets": {
    "publish": {
      "inputs": [
        "production",
        { "externalDependencies": ["lerna"] } // we explicitly say that our run-commands depends on lerna only
      ],
      "dependsOn": ["build"],
      "executor": "nx:run-commands",
      "cwd": "dist/{projectRoot}",
      "command": "lerna publish"
    }
  }
}
```
