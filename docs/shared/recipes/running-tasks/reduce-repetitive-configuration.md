---
title: Reduce Repetitive Configuration
description: Learn how to use Nx's targetDefaults, namedInputs, and other features to minimize duplicate configuration across projects in your workspace.
---

# Reduce Repetitive Configuration

Nx can help you dramatically reduce the lines of configuration code that you need to maintain.

Lets say you have three libraries in your repository - `lib1`, `lib2` and `lib3`. The folder structure looks like this:

```treeview
repo/
├── libs/
│   └── lib1/
│   │   ├── tsconfig.lib.json
│   │   └── project.json
│   └── lib2/
│   │   ├── tsconfig.lib.json
│   │   └── project.json
│   └── lib3/
│       ├── tsconfig.lib.json
│       └── project.json
└── nx.json
```

## Initial Configuration Settings

All three libraries have a similar project configuration. Here is what their `project.json` files look like:

{% tabs %}
{% tab label="lib1" %}

```json {% fileName="libs/lib1/project.json" %}
{
  "name": "lib1",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/lib1/src",
  "projectType": "library",
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/libs/lib1",
        "main": "libs/lib1/src/index.ts",
        "tsConfig": "libs/lib1/tsconfig.lib.json",
        "assets": ["libs/lib1/*.md", "libs/lib1/src/images/*"]
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint",
      "outputs": ["{options.outputFile}"],
      "options": {
        "lintFilePatterns": ["libs/lib1/**/*.ts"]
      }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/{projectRoot}"],
      "options": {
        "jestConfig": "libs/lib1/jest.config.ts",
        "passWithNoTests": true
      },
      "configurations": {
        "ci": {
          "ci": true,
          "codeCoverage": true
        }
      }
    }
  },
  "tags": []
}
```

{% /tab %}
{% tab label="lib2" %}

```json {% fileName="libs/lib2/project.json" %}
{
  "name": "lib2",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/lib2/src",
  "projectType": "library",
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/libs/lib2",
        "main": "libs/lib2/src/index.ts",
        "tsConfig": "libs/lib2/tsconfig.lib.json",
        "assets": ["libs/lib2/*.md"]
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint",
      "outputs": ["{options.outputFile}"],
      "options": {
        "lintFilePatterns": ["libs/lib2/**/*.ts"]
      }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/{projectRoot}"],
      "options": {
        "jestConfig": "libs/lib2/jest.config.ts",
        "passWithNoTests": true,
        "testTimeout": 10000
      },
      "configurations": {
        "ci": {
          "ci": true,
          "codeCoverage": true
        }
      }
    }
  },
  "tags": []
}
```

{% /tab %}
{% tab label="lib3" %}

```json {% fileName="libs/lib3/project.json" %}
{
  "name": "lib3",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/lib3/src",
  "projectType": "library",
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/libs/lib3",
        "main": "libs/lib3/src/index.ts",
        "tsConfig": "libs/lib3/tsconfig.lib.json",
        "assets": ["libs/lib3/*.md"]
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint",
      "outputs": ["{options.outputFile}"],
      "options": {
        "lintFilePatterns": ["libs/lib3/**/*.ts"]
      }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/{projectRoot}"],
      "options": {
        "jestConfig": "libs/lib3/jest.config.ts",
        "passWithNoTests": true
      },
      "configurations": {
        "ci": {
          "ci": true,
          "codeCoverage": true
        }
      }
    }
  },
  "tags": []
}
```

{% /tab %}
{% /tabs %}

If you scan through these three files, they look very similar. The only differences aside from the project paths are that `lib1` has different assets defined for the `build` target and `lib2` has a `testTimeout` set for the `test` target.

## Reduce Configuration with targetDefaults

Let's use [the `targetDefaults` property](/reference/nx-json#target-defaults) in `nx.json` to reduce some of this duplicate configuration code.

```json {% fileName="nx.json" %}
{
  "targetDefaults": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/{projectRoot}",
        "main": "{projectRoot}/src/index.ts",
        "tsConfig": "{projectRoot}/tsconfig.lib.json",
        "assets": ["{projectRoot}/*.md"]
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint",
      "outputs": ["{options.outputFile}"],
      "options": {
        "lintFilePatterns": ["{projectRoot}/**/*.ts"]
      }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/{projectRoot}"],
      "options": {
        "jestConfig": "{projectRoot}/jest.config.ts",
        "passWithNoTests": true
      },
      "configurations": {
        "ci": {
          "ci": true,
          "codeCoverage": true
        }
      }
    }
  }
}
```

Now the `project.json` files can be reduced to this:

{% tabs %}
{% tab label="lib1" %}

```json {% fileName="libs/lib1/project.json" %}
{
  "name": "lib1",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/lib1/src",
  "projectType": "library",
  "targets": {
    "build": {
      "options": {
        "assets": ["libs/lib1/*.md", "libs/lib1/src/images/*"]
      }
    },
    "lint": {},
    "test": {}
  },
  "tags": []
}
```

{% /tab %}
{% tab label="lib2" %}

```json {% fileName="libs/lib2/project.json" %}
{
  "name": "lib2",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/lib2/src",
  "projectType": "library",
  "targets": {
    "build": {},
    "lint": {},
    "test": {
      "options": {
        "testTimeout": 10000
      }
    }
  },
  "tags": []
}
```

{% /tab %}
{% tab label="lib3" %}

```json {% fileName="libs/lib3/project.json" %}
{
  "name": "lib3",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/lib3/src",
  "projectType": "library",
  "targets": {
    "build": {},
    "lint": {},
    "test": {}
  },
  "tags": []
}
```

{% /tab %}
{% /tabs %}

{% callout type="warning" title="Target defaults" %}
This recipe assumes every target with the same name uses the same executor. If you have targets with the same name using different executors and you're providing target defaults for executor options, don't place the executor options under a default target using the target name as the key. Instead, separate target default configurations can be added using the executors as the keys, each with their specific configuration.
{% /callout %}

## Ramifications

This change adds 33 lines of code to `nx.json` and removes 84 lines of code from the `project.json` files. That's a net reduction of 51 lines of code. And you'll get more benefits from this strategy the more projects you have in your repo.

Reducing lines of code is nice, but just like using the DRY principle in code, there are other benefits:

- You can easily change the default settings for the whole repository in one location.
- When looking at a single project, it is clear how it differs from the defaults.

{% callout type="warning" title="Don't Over Do It" %}
You need to be careful to only put configuration settings in the `targetDefaults` that are actually defaults for the whole repository. If you have to make exceptions for most of the projects in your repository, then that setting probably should not be a default.
{% /callout %}
