# Automatically Split E2E Tasks by File (Atomizer)

{% youtube
src="https://youtu.be/0YxcxIR7QU0"
title="10x Faster e2e Tests!"
width="100%" /%}

End-to-end (e2e) tests are often large, monolithic tasks that can take a considerable amount of time to execute. As a result, teams often push them to a nightly or even weekly build rather than running them for each PR. This approach is suboptimal as it increases the risk of merging problematic PRs.

Manually splitting large e2e test projects can be complex and require ongoing maintenance. Nx's Atomizer solves this by **automatically generating runnable targets for e2e tests for each spec file**. Instead of one large e2e task, you get multiple smaller e2e tasks that can be run individually. This allows for:

- parallelization across multiple machines with [Nx Agents](/ci/features/distribute-task-execution)
- faster [flakiness detection & retries](/ci/features/flaky-tasks) by isolating and re-running only the failed tests

## Enable Automated e2e Task Splitting

### Step 1: Connect to Nx Cloud

To use **automated e2e task splitting**, you need to connect your workspace to Nx Cloud (if you haven't already).

```shell
npx nx connect
```

See the [connect to Nx Cloud recipe](/ci/intro/connect-to-nx-cloud) for all the details.

### Step 2: Add the Appropriate Plugin

Run this command to set up inferred tasks and enable task splitting for each plugin:

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

If you upgraded Nx from an older version, ensure that [inferred tasks](/concepts/inferred-tasks#existing-nx-workspaces) are enabled in `nx.json`:

```json {% fileName="nx.json" %}
{
  ...
  // turned on by default; just make sure it is not set to false
  useInferencePlugins: true
}
```

## Update an Existing e2e Project to use Automated Task Splitting

If you are already using the `@nx/cypress`, `@nx/playwright`, or `@nx/jest` plugin, you need to manually add the appropriate configuration to the `plugins` array of `nx.json`. Follow the instructions for the plugin you are using:

- [Configure Cypress Task Splitting](/nx-api/cypress#nxcypress-configuration)
- [Configure Playwright Task Splitting](/nx-api/playwright#nxplaywright-configuration)
- [Configure Jest Task Splitting](/nx-api/jest#splitting-e2e-tests)

## Verify Automated Task Splitting Works

Run the following command to open the project detail view for the e2e project:

{% tabs %}
{% tab label="CLI" %}

```shell
nx show project my-project-e2e
```

{% /tab %}
{% tab label="Project Detail View" %}

{% project-details title="Project Details View" %}

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

{% /tab %}
{% /tabs %}

If you configured Nx Atomizer properly, you'll see that there are tasks named `e2e`, `e2e-ci` and a task for each e2e test file.

During local development, you’ll want to continue using `e2e` as it is more efficient on a single machine.

```shell
nx e2e my-project-e2e
```

The `e2e-ci` task truly shines when configured and run on CI.

## Configure Automated Task Splitting on CI

Update your CI pipeline to run `e2e-ci`, which will automatically run all the inferred tasks for the individual e2e test files. Here's an example of a GitHub Actions workflow:

```yaml {% fileName=".github/workflows/ci.yml" highlightLines=[15,25] %}
name: CI
# ...
jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - run: pnpm dlx nx-cloud start-ci-run --distribute-on="3 linux-medium-js" --stop-agents-after="e2e-ci"

      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - uses: nrwl/nx-set-shas@v4

      - run: pnpm exec nx affected -t lint test build e2e-ci
```

Learn more about configuring your [CI provider by following these detailed recipes](/ci/recipes/set-up).
