---
title: Start a new project with Nx
description: Create a new Nx workspace manually with your favorite CLI or use the guided setup with presets for various technology stacks and configurations.
---

# Start a new project with Nx

When you start a new project with Nx, you have the following options.

## Option 1: Add Nx to your existing setup

You can add Nx to any existing setup - whether you're creating a new project from scratch (for example using npm/pnpm/yarn workspaces), bootstrapping with a framework or metaframework CLI, or working with an existing project you've been developing for a while.

Let's take the example of an NPM workspace. Create a new root-level `package.json` like:

```json
{
  "name": "my-workspace",
  "version": "1.0.0",
  "private": true,
  "workspaces": ["packages/*", "apps/*"]
}
```

Then you can add Nx to it by using:

```shell
nx init
```

_(Note, make sure you have [Nx installed globally](/getting-started/installation) or use `npx` if you're in a JavaScript environment)_

Nx will detect the underlying workspace configuration, ask you a couple of questions and install itself into the workspace. As you keep going, you can incrementally add functionality, like:

- [configure caching](/features/cache-task-results)
- [adding Nx plugins to help refine your workflows](/plugin-registry)
- [optimizing your CI](/ci/intro/ci-with-nx)

## Option 2: Create a new workspace with presets

Alternatively, you can choose a more guided approach by leveraging some of the presets Nx comes with.

Run the following command to get started:

```shell
npx create-nx-workspace@latest
```

This interactive command will guide you through the setup process, allowing you to:

- **Choose your workspace name** - This will be the name of your root directory
- **Select your preferred package manager** - npm, yarn, or pnpm
- **Pick a preset** - Choose from various technology stacks and configurations
- **Configure additional options** - Such as styling solutions, testing frameworks, and more

Choose a preset that matches your technology stack. This gives you a fully configured workspace.

You can also choose **an empty workspace preset** which sets up the bare minimum configuration including Nx itself. This allows you to add technologies and features incrementally over time as you need them.

## Option 3: Get the complete Nx platform experience

[![Nx Cloud onboarding](/shared/images/getting-started/nx-cloud-starting-screen.avif)](https://cloud.nx.app/get-started)

For the complete experience, you can also get [started directly from the Nx Cloud application](https://cloud.nx.app/get-started).

This approach gives you a fully end-to-end development workflow right from the start, making it easy to get up and running when your project is in its initial phase. You'll get a fully working CI configuration that includes Nx Cloud's AI-powered features like **AI-powered self-healing CI** that automatically fixes common CI failures. This means you benefit from intelligent automation right from day one, without having to configure complex CI pipelines manually.

As your project grows and scales, you'll have access to additional features like **remote caching** to speed up builds across your team, **distributed task execution with Nx Agents** to parallelize work across multiple machines, and **automatic test splitting** to optimize your CI pipeline performance.

[Get started with the complete Nx platform experience →](https://cloud.nx.app/get-started)

<!-- ## Pick Your Stack!

{% cards cols="3" lgCols="8" mdCols="6" smCols="5" moreLink="/showcase/example-repos" %}

{% link-card title="Express" appearance="small" url="/technologies/node/express" icon="express" /%}
{% link-card title="Vue" appearance="small" url="/technologies/vue/introduction" icon="vue" /%}
{% link-card title="Next" appearance="small" url="/technologies/react/next" icon="nextjs" /%}
{% link-card title="Nuxt" appearance="small" url="/technologies/vue/nuxt/introduction" icon="nuxt" /%}
{% link-card title="Nest" appearance="small" url="/technologies/node/nest" icon="nestjs" /%}
{% link-card title="Remix" appearance="small" url="/technologies/react/remix" icon="remix" /%}
{% link-card title="Expo" appearance="small" url="/technologies/react/expo" icon="expo" /%}
{% link-card title="React Native" appearance="small" url="/technologies/react/react-native" icon="react" /%}
{% link-card title="Fastify" appearance="small" url="/showcase/example-repos/mongo-fastify" icon="fastify" /%}
{% link-card title="Svelte" appearance="small" url="/showcase/example-repos/add-svelte" icon="svelte" /%}
{% link-card title="Solid" appearance="small" url="/showcase/example-repos/add-solid" icon="solid" /%}
{% link-card title="Lit" appearance="small" url="/showcase/example-repos/add-lit" icon="lit" /%}
{% link-card title="Astro" appearance="small" url="/showcase/example-repos/add-astro" icon="astro" /%}
{% link-card title="Qwik" appearance="small" url="/showcase/example-repos/add-qwik" icon="qwik" /%}

{% link-card title="Rust" appearance="small" url="/showcase/example-repos/add-rust" icon="rust" /%}
{% link-card title="Go" appearance="small" url="https://github.com/nrwl/nx-recipes/blob/main/go/README.md" icon="go" /%}
{% link-card title=".NET" appearance="small" url="https://github.com/nrwl/nx-recipes/tree/main/dot-net-standalone" icon="dotnet" /%}
{% link-card title="Cypress" appearance="small" url="/technologies/test-tools/cypress/introduction" icon="cypress" /%}
{% link-card title="Playwright" appearance="small" url="/technologies/test-tools/playwright/introduction" icon="playwright" /%}
{% link-card title="Vite" appearance="small" url="/technologies/build-tools/vite" icon="vite" /%}
{% link-card title="Storybook" appearance="small" url="/technologies/test-tools/storybook" icon="storybook" /%}
{% link-card title="Jest" appearance="small" url="/technologies/test-tools/jest/introduction" icon="jest" /%}
{% link-card title="Rspack" appearance="small" url="/technologies/build-tools/rspack/introduction" icon="rspack" /%}

{% /cards %} -->
