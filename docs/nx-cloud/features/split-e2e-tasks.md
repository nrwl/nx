# Automatically Split E2E Tasks by File (Atomizer)

{% youtube
src="https://youtu.be/0YxcxIR7QU0"
title="10x Faster e2e Tests!"
width="100%" /%}

In almost every codebase, e2e tests are the largest portion of the CI pipeline. Typically, e2e tests are grouped by application so that whenever an application's code changes, all the e2e tests for that application are run. These large groupings of e2e tests make caching and distribution less effective. Also, because e2e tests deal with a lot of integration code, they are at a much higher risk to be flaky.

You could manually address these problems by splitting your e2e tests into smaller tasks, but this requires developer time to maintain and adds additional configuration overhead to your codebase. Or, you could allow Nx to automatically split your Cypress or Playwright e2e tests by file.

## Set up

To enable automatically split e2e tasks, you need to turn on [inferred tasks](/concepts/inferred-tasks#existing-nx-workspaces) for the [@nx/cypress](/nx-api/cypress), [@nx/playwright](/nx-api/playwright), or [@nx/jest](/nx-api/jest) plugins. Run this command to set up inferred tasks:

{% tabs %}
{% tab label="Cypress" %}

```shell {% skipRescope=true %}
nx add @nx/cypress
```

{% /tab %}
{% tab label="Playwright" %}

```shell {% skipRescope=true %}
nx add @nx/playwright
```

{% /tab %}
{% tab label="Jest" %}

```shell {% skipRescope=true %}
nx add @nx/jest
```

{% /tab %}
{% /tabs %}

This command will register the appropriate plugin in the `plugins` array of `nx.json`.

## Manual Configuration

If you are already using the `@nx/cypress`, `@nx/playwright`, or `@nx/jest` plugin, you need to manually add the appropriate configuration to the `plugins` array of `nx.json`. Follow the instructions for the plugin you are using:

- [Configure Cypress Task Splitting](/nx-api/cypress#nxcypress-configuration)
- [Configure Playwright Task Splitting](/nx-api/playwright#nxplaywright-configuration)
- [Configure Jest Task Splitting](/nx-api/jest#splitting-e2e-tests)

## Usage

You can view the available tasks for your project in the project detail view:

```shell
nx show project myproject-e2e --web
```

{% project-details title="Project Details View" height="100px" %}

```json
{
  "project": {
    "name": "admin-e2e",
    "data": {
      "metadata": {
        "targetGroups": {
          "E2E (CI)": [
            "e2e-ci--src/e2e/app.cy.ts",
            "e2e-ci--src/e2e/login.cy.ts",
            "e2e-ci"
          ]
        }
      },
      "root": "apps/admin-e2e",
      "projectType": "application",
      "targets": {
        "e2e": {
          "cache": true,
          "inputs": ["default", "^production"],
          "outputs": [
            "{workspaceRoot}/dist/cypress/apps/admin-e2e/videos",
            "{workspaceRoot}/dist/cypress/apps/admin-e2e/screenshots"
          ],
          "executor": "nx:run-commands",
          "dependsOn": ["^build"],
          "options": {
            "cwd": "apps/admin-e2e",
            "command": "cypress run"
          },
          "configurations": {
            "production": {
              "command": "cypress run --env webServerCommand=\"nx run admin:preview\""
            }
          },
          "metadata": {
            "technologies": ["cypress"]
          }
        },
        "e2e-ci--src/e2e/app.cy.ts": {
          "outputs": [
            "{workspaceRoot}/dist/cypress/apps/admin-e2e/videos",
            "{workspaceRoot}/dist/cypress/apps/admin-e2e/screenshots"
          ],
          "inputs": [
            "default",
            "^production",
            {
              "externalDependencies": ["cypress"]
            }
          ],
          "cache": true,
          "options": {
            "cwd": "apps/admin-e2e",
            "command": "cypress run --env webServerCommand=\"nx run admin:serve-static\" --spec src/e2e/app.cy.ts"
          },
          "executor": "nx:run-commands",
          "configurations": {},
          "metadata": {
            "technologies": ["cypress"]
          }
        },
        "e2e-ci--src/e2e/login.cy.ts": {
          "outputs": [
            "{workspaceRoot}/dist/cypress/apps/admin-e2e/videos",
            "{workspaceRoot}/dist/cypress/apps/admin-e2e/screenshots"
          ],
          "inputs": [
            "default",
            "^production",
            {
              "externalDependencies": ["cypress"]
            }
          ],
          "cache": true,
          "options": {
            "cwd": "apps/admin-e2e",
            "command": "cypress run --env webServerCommand=\"nx run admin:serve-static\" --spec src/e2e/login.cy.ts"
          },
          "executor": "nx:run-commands",
          "configurations": {},
          "metadata": {
            "technologies": ["cypress"]
          }
        },
        "e2e-ci": {
          "executor": "nx:noop",
          "cache": true,
          "inputs": [
            "default",
            "^production",
            {
              "externalDependencies": ["cypress"]
            }
          ],
          "outputs": [
            "{workspaceRoot}/dist/cypress/apps/admin-e2e/videos",
            "{workspaceRoot}/dist/cypress/apps/admin-e2e/screenshots"
          ],
          "dependsOn": [
            {
              "target": "e2e-ci--src/e2e/app.cy.ts",
              "projects": "self",
              "params": "forward"
            },
            {
              "target": "e2e-ci--src/e2e/login.cy.ts",
              "projects": "self",
              "params": "forward"
            }
          ],
          "options": {},
          "configurations": {},
          "metadata": {
            "technologies": ["cypress"]
          }
        },
        "lint": {
          "executor": "@nx/eslint:lint",
          "inputs": ["default", "{workspaceRoot}/.eslintrc.json"],
          "cache": true,
          "outputs": ["{options.outputFile}"],
          "options": {},
          "configurations": {},
          "metadata": {
            "technologies": ["eslint"]
          }
        }
      },
      "name": "admin-e2e",
      "$schema": "../../node_modules/nx/schemas/project-schema.json",
      "sourceRoot": "apps/admin-e2e/src",
      "tags": [],
      "implicitDependencies": ["admin"]
    }
  },
  "sourceMap": {
    "root": ["apps/admin-e2e/project.json", "nx/core/project-json"],
    "projectType": ["apps/admin-e2e/project.json", "nx/core/project-json"],
    "targets": ["apps/admin-e2e/project.json", "nx/core/project-json"],
    "targets.e2e": ["apps/admin-e2e/project.json", "nx/core/target-defaults"],
    "targets.e2e.options": [
      "apps/admin-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e.cache": [
      "apps/admin-e2e/project.json",
      "nx/core/target-defaults"
    ],
    "targets.e2e.inputs": [
      "apps/admin-e2e/project.json",
      "nx/core/target-defaults"
    ],
    "targets.e2e.outputs": [
      "apps/admin-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e.configurations": [
      "apps/admin-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e.executor": [
      "apps/admin-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e.options.cwd": [
      "apps/admin-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e.options.command": [
      "apps/admin-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e.configurations.production": [
      "apps/admin-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e.configurations.production.command": [
      "apps/admin-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci--src/e2e/app.cy.ts": [
      "apps/admin-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci--src/e2e/app.cy.ts.outputs": [
      "apps/admin-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci--src/e2e/app.cy.ts.inputs": [
      "apps/admin-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci--src/e2e/app.cy.ts.cache": [
      "apps/admin-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci--src/e2e/app.cy.ts.options": [
      "apps/admin-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci--src/e2e/app.cy.ts.executor": [
      "apps/admin-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci--src/e2e/app.cy.ts.options.cwd": [
      "apps/admin-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci--src/e2e/app.cy.ts.options.command": [
      "apps/admin-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci--src/e2e/login.cy.ts": [
      "apps/admin-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci--src/e2e/login.cy.ts.outputs": [
      "apps/admin-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci--src/e2e/login.cy.ts.inputs": [
      "apps/admin-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci--src/e2e/login.cy.ts.cache": [
      "apps/admin-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci--src/e2e/login.cy.ts.options": [
      "apps/admin-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci--src/e2e/login.cy.ts.executor": [
      "apps/admin-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci--src/e2e/login.cy.ts.options.cwd": [
      "apps/admin-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci--src/e2e/login.cy.ts.options.command": [
      "apps/admin-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci": [
      "apps/admin-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci.executor": [
      "apps/admin-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci.cache": [
      "apps/admin-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci.inputs": [
      "apps/admin-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci.outputs": [
      "apps/admin-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci.dependsOn": [
      "apps/admin-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e.dependsOn": [
      "apps/admin-e2e/project.json",
      "nx/core/target-defaults"
    ],
    "targets.lint": ["apps/admin-e2e/project.json", "nx/core/project-json"],
    "targets.lint.executor": [
      "apps/admin-e2e/project.json",
      "nx/core/project-json"
    ],
    "targets.lint.inputs": [
      "apps/admin-e2e/project.json",
      "nx/core/target-defaults"
    ],
    "targets.lint.cache": [
      "apps/admin-e2e/project.json",
      "nx/core/target-defaults"
    ],
    "name": ["apps/admin-e2e/project.json", "nx/core/project-json"],
    "$schema": ["apps/admin-e2e/project.json", "nx/core/project-json"],
    "sourceRoot": ["apps/admin-e2e/project.json", "nx/core/project-json"],
    "tags": ["apps/admin-e2e/project.json", "nx/core/project-json"],
    "implicitDependencies": [
      "apps/admin-e2e/project.json",
      "nx/core/project-json"
    ],
    "implicitDependencies.admin": [
      "apps/admin-e2e/project.json",
      "nx/core/project-json"
    ],
    "targets.lint.outputs": [
      "apps/admin-e2e/project.json",
      "nx/core/project-json"
    ]
  }
}
```

{% /project-details %}

You'll see that there are tasks named `e2e`, `e2e-ci` and a task for each e2e test file.

Developers can run all e2e tests locally with the `e2e` target:

```shell
nx e2e my-project-e2e
```

You can update your CI pipeline to run `e2e-ci`, which will automatically run all the inferred tasks for the individual e2e test files. Run it like this:

```shell
nx e2e-ci my-project-e2e
```

## Benefits

With more granular e2e tasks, all the other features of Nx become more powerful. Let's imagine a scenario where there are 10 spec files in a single e2e project and each spec file takes 3 minutes to run.

### Improved Caching

[Nx's cache](/ci/features/remote-cache) can be used for all the individual e2e tasks that succeeded and only the failed tasks need to be re-run. Without e2e task splitting, a single spec file failing would force you to re-run all the e2e tests for the project, which would take 30 minutes. With e2e task splitting, a single spec file that fails can be re-run in 3 minutes and the other successful spec file results can be retrieved from the cache.

### Better Distribution

[Distributed task execution](/ci/features/distribute-task-execution) allows your e2e tests to be run on multiple machines simultaneously, which reduces the total time of the CI pipeline. Without e2e task splitting, the CI pipeline has to take at least 30 minutes to complete because the one e2e task needs that long to finish. With e2e task splitting, a fully distributed pipeline with 10 agents could finish in 3 minutes.

### More Precise Flaky Task Identification

Nx Agents [automatically re-run failed flaky e2e tests](/ci/features/flaky-tasks) on a separate agent without a developer needing to manually re-run the CI pipeline. Leveraging e2e task splitting, Nx identifies the specific flaky test file - this way you can quickly fix the offending test file. Without e2e splitting, Nx identifies that at least one of the e2e tests are flaky - requiring you to find the flaky test on your own.
