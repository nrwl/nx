---
title: Start with an existing project
description: Add Nx to any existing project with a single command. Start with Nx Core and gradually adopt plugins, CI integrations, and other capabilities.
---

# Add Nx to an existing project

In many situations, you have an existing codebase and want to improve it with Nx using an **incremental adoption approach**.

Thanks to [Nx's modular architecture](/getting-started/intro), you can start with just **Nx Core** and then gradually add [technology-specific plugins](/technologies), [CI integrations](/ci), or other capabilities as your requirements evolve.

Getting started is remarkably simple. You can add Nx to any existing project with a single command:

```shell
nx@latest init
```

> _Note: make sure you have [Nx installed globally](/getting-started/installation) or use `npx` if you're in a JavaScript environment_

Whether a monorepo, single project or something in between, `nx init` walks you through adding and configuring Nx. You can pick a minimal approach or detailed guided setup. At the end you'll have an Nx workspace ready for anything!

## Next Steps

After initializing Nx, you can explore your workspace with the following commands:

- `nx graph` to view an interactive graph
- `nx show projects` to see a list of all projects
- `nx show project <project-name>` to view an interactive project detailed view
- `nx run-many -t <target>` to run tasks with Nx, e.g. `nx run-many -t build`

### Update CI Configurations

Now that Nx is installed, you'll want to update CI configurations to leverage Nx. You can do this by changing previous commands to use `nx` instead.

For example, switching from `pnpm` commands to use `nx`

```diff {% fileName=".github/workflows/ci.yaml" %}
-     - run: pnpm run -r build
-     - run: pnpm run -r test
+     - run: npx nx run-many -t test build
```

You can directly invoke `package.json` scripts with `nx` as well

```diff {% fileName=".github/workflows/ci.yaml" %}
-     - run: npm run build
-     - run: npm run test
+     - run: npx nx build
+     - run: npx nx test
```

[View CI provider specific setups](/ci/recipes/set-up) to learn more.

### Nx Cloud

{% callout type="check" title="How do I know if I enabled Nx Cloud?" %}
Validate Nx Cloud is enabled by checking the `nx.json` file for `nxCloudId` property.
You can add Nx Cloud at any point by running the `nx connect` command.
{%/callout%}

After initializing Nx, you'll need to commit and push the changes to your repository.

Once your changes are pushed, you can finish setting up your workspace by clicking on the list printed to your terminal, or by visiting [Nx Cloud directly](https://cloud.nx.app/get-started?utm_source=nx.dev&utm_campaign=nx_init) and clicking _"Connect an existing Nx repository"_

To leverage Self Healing CI, you'll need to add the following to your CI configuration:

```diff {% fileName=".github/workflows/ci.yaml" %}
      - run: npx nx run-many -t lint test build
+       # Enable Self Healing CI w/ Nx Cloud
+     - run: npx nx fix-ci
+       if: always()
```

### Empower Your Editor

Enhance your developer experience by using the Nx Console editor extension.

{% install-nx-console /%}

## In-depth Guides

Here are some guides that give you more details based on the technology stack you're using:

{% cards cols="2" mdCols="4" smCols="2" moreLink="/recipes/adopting-nx" %}

{% link-card title="Add to Existing Monorepo" appearance="small" url="/recipes/adopting-nx/adding-to-monorepo" icon="pnpm" /%}

{% link-card title="Add to Any Project" appearance="small" url="/recipes/adopting-nx/adding-to-existing-project" icon="nx" /%}

{% link-card title="Migrate from Angular CLI" appearance="small" url="technologies/angular/migration/angular" icon="angular" /%}

{% link-card title="Import Projects into Your Nx Workspace" appearance="small" url="/recipes/adopting-nx/import-project" icon="ArrowDownOnSquareStackIcon" /%}

{% /cards %}
