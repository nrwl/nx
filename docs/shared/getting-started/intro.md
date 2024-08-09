# Intro to Nx

Nx is a powerful open-source build system that provides tools and techniques for enhancing developer productivity, optimizing CI performance, and maintaining code quality. [Check out our video](/getting-started/why-nx) to learn more about what Nx is about.

## Core Features

- **Run Tasks Efficiently**: Nx [runs tasks in parallel](/features/run-tasks) and orders the tasks based on the dependencies between them.
- **Distribute Tasks in CI**: Nx scales your CI by [distributing tasks](/ci/features/distribute-task-execution) across many VMs. Your CI is fast no matter how big your repository is.
- **Cache Locally & Remotely**: With [local](/features/cache-task-results) and [remote caching](/ci/features/remote-cache), Nx prevents unnecessary re-runs of tasks, saving you valuable dev time.
- **Split E2E Tests and Rerun Flaky Tests**: Nx [automatically splits](/ci/features/split-e2e-tasks) large e2e tests to distribute them across VMs. Nx can also automatically [identify and rerun flaky e2e tests](/ci/features/flaky-tasks).
- **Automate Dependency Updates**: if you leverage [Nx plugins](/concepts/nx-plugins) you gain additional features such as [code generation](/features/generate-code) and tools to [automatically upgrade](features/automate-updating-dependencies) your codebase and dependencies.
- **Make it Your Own**: Nx is highly customizable and extensible. Fine-tune it by [creating a plugin for your organization](/extending-nx/tutorials/organization-specific-plugin) or [creating a tooling plugin](/extending-nx/tutorials/tooling-plugin).

<!-- - **Monorepo and Single Projects**: Nx supports both, monorepos as well as single-project (standalone) workspaces. -->

Find out more about [why you should use Nx](/getting-started/why-nx) or browse our [features](/features).

## Try Nx Yourself!

{% side-by-side %}

```shell {% title="Create a new workspace" %}
npx create-nx-workspace
```

```shell {% title="Add Nx to an existing workspace" %}
npx nx init
```

{% /side-by-side %}

Also, here are some recipes that give you more details based on the technology stack you're using:

{% cards cols="2" mdCols="4" smCols="2" moreLink="/recipes/adopting-nx" %}

{% link-card title="Add to Existing Monorepo" appearance="small" url="/recipes/adopting-nx/adding-to-monorepo" icon="pnpm" /%}

{% link-card title="Add to Any Project" appearance="small" url="/recipes/adopting-nx/adding-to-existing-project" icon="nx" /%}

{% link-card title="Migrate from Angular CLI" appearance="small" url="/recipes/angular/migration/angular" icon="angular" /%}

{% /cards %}

## Learn Nx

{% cards cols="2" lgCols="4" mdCols="4" smCols="2" %}

{% link-card title="Nx in 10 minutes!" type="video" url="https://youtu.be/-_4WMl-Fn0w" icon="nx" /%}

{% link-card title="What is Nx Cloud?" type="video" url="https://youtu.be/4VI-q943J3o" icon="nxcloud" /%}

{% link-card title="PNPM Monorepos with Nx" type="video" url="https://youtu.be/ngdoUQBvAjo" icon="pnpm" /%}

{% link-card title="More On Youtube" type="video" url="https://www.youtube.com/@nxdevtools" icon="youtube" /%}

{% /cards %}

{% cards cols="2" lgCols="3" mdCols="3" smCols="2" %}

{% link-card title="NPM Workspaces" type="tutorial" url="/getting-started/tutorials/npm-workspaces-tutorial" icon="jsMono" /%}

{% link-card title="Single React App" type="tutorial" url="/getting-started/tutorials/react-standalone-tutorial" icon="react" /%}

{% link-card title="React Monorepo" type="tutorial" url="/getting-started/tutorials/react-monorepo-tutorial" icon="reactMono" /%}

{% /cards %}

{% cards cols="2" lgCols="4" mdCols="4" smCols="2" %}

{% link-card title="Single Vue App" type="tutorial" url="/getting-started/tutorials/vue-standalone-tutorial" icon="vue" /%}

{% link-card title="Single Angular App" type="tutorial" url="/getting-started/tutorials/angular-standalone-tutorial" icon="angular" /%}

{% link-card title="Angular Monorepo" type="tutorial" url="/getting-started/tutorials/angular-monorepo-tutorial" icon="angularMono" /%}

{% link-card title="Gradle Monorepo" type="tutorial" url="/getting-started/tutorials/gradle-tutorial" icon="gradle" /%}

{% /cards %}

## Pick Your Stack!

{% cards cols="3" lgCols="8" mdCols="6" smCols="5" moreLink="/showcase/example-repos" %}

{% link-card title="Express" appearance="small" url="/nx-api/express" icon="express" /%}
{% link-card title="Vue" appearance="small" url="/nx-api/vue" icon="vue" /%}
{% link-card title="Next" appearance="small" url="/nx-api/next" icon="nextjs" /%}
{% link-card title="Nuxt" appearance="small" url="/nx-api/nuxt" icon="nuxt" /%}
{% link-card title="Nest" appearance="small" url="/nx-api/nest" icon="nestjs" /%}
{% link-card title="Remix" appearance="small" url="/nx-api/remix" icon="remix" /%}
{% link-card title="Expo" appearance="small" url="/nx-api/expo" icon="expo" /%}
{% link-card title="React Native" appearance="small" url="/nx-api/react-native" icon="react" /%}
{% link-card title="Fastify" appearance="small" url="/showcase/example-repos/mongo-fastify" icon="fastify" /%}
{% link-card title="Svelte" appearance="small" url="/showcase/example-repos/add-svelte" icon="svelte" /%}
{% link-card title="Solid" appearance="small" url="/showcase/example-repos/add-solid" icon="solid" /%}
{% link-card title="Lit" appearance="small" url="/showcase/example-repos/add-lit" icon="lit" /%}
{% link-card title="Astro" appearance="small" url="/showcase/example-repos/add-astro" icon="astro" /%}
{% link-card title="Qwik" appearance="small" url="/showcase/example-repos/add-qwik" icon="qwik" /%}

{% link-card title="Rust" appearance="small" url="/showcase/example-repos/add-rust" icon="rust" /%}
{% link-card title="Go" appearance="small" url="https://github.com/nrwl/nx-recipes/blob/main/go/README.md" icon="go" /%}
{% link-card title=".NET" appearance="small" url="https://github.com/nrwl/nx-recipes/tree/main/dot-net-standalone" icon="dotnet" /%}
{% link-card title="Cypress" appearance="small" url="/nx-api/cypress" icon="cypress" /%}
{% link-card title="Playwright" appearance="small" url="/nx-api/playwright" icon="playwright" /%}
{% link-card title="Vite" appearance="small" url="/nx-api/vite" icon="vite" /%}
{% link-card title="Storybook" appearance="small" url="/nx-api/storybook" icon="storybook" /%}
{% link-card title="Jest" appearance="small" url="/nx-api/jest" icon="jest" /%}
{% link-card title="Rspack" appearance="small" url="/nx-api/rspack" icon="rspack" /%}

{% /cards %}

## Connect With Us

Connect on our channels and with the Nx Community to ask questions, get help and keep up to date with the latest news.

- Join our [Discord Community](https://go.nx.dev/community)
- Subscribe to our [Youtube Channel](https://www.youtube.com/@nxdevtools)
- Follow us on [Twitter](https://twitter.com/nxdevtools)
- Subscribe [to our tech newsletter](https://go.nrwl.io/nx-newsletter)
