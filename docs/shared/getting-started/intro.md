# Intro to Nx

Nx is a powerful open-source build system that provides tools and techniques for enhancing developer productivity, optimizing CI performance, and maintaining code quality. [Check out our video](/getting-started/why-nx) to learn more about what Nx is about.

## Core Features

- **Run Tasks Efficiently**: Nx [runs tasks in parallel](/features/run-tasks) and orders the tasks based on the dependencies between them.
- **Cache Locally & Remotely**: With [local](/features/cache-task-results) and [remote caching](/ci/features/remote-cache), Nx prevents unnecessary re-runs of tasks, saving you valuable dev time.
- **Automate Dependency Updates**: if you leverage Nx plugins you gain additional features such as [code generation](/features/generate-code) and tools to [automatically upgrade](features/automate-updating-dependencies) your codebase and dependencies.
- **Make it Your Own**: Nx is highly customizable and extensible. Fine-tune it by [creating your own plugins](/extending-nx/intro/getting-started) and optionally [share them with the community](/extending-nx/tutorials/publish-plugin#publish-your-nx-plugin).

<!-- - **Monorepo and Single Projects**: Nx supports both, monorepos as well as single-project (standalone) workspaces. -->

Find out more about [why you should use Nx](/getting-started/why-nx) or browse our [features](/features).

## Try Nx Yourself!

```shell
npx create-nx-workspace@latest
```

## Learn Nx

{% cards cols="2" lgCols="4" mdCols="4" smCols="2" %}

{% link-card title="Nx in 10 minutes!" type="video" url="https://youtu.be/-_4WMl-Fn0w" icon="nx" /%}

{% link-card title="What is Nx Cloud?" type="video" url="https://youtu.be/NZF0ZJpgaJM" icon="nxcloud" /%}

{% link-card title="PNPM Monorepos with Nx" type="video" url="https://youtu.be/ngdoUQBvAjo" icon="pnpm" /%}

{% link-card title="More On Youtube" type="video" url="https://www.youtube.com/@nxdevtools" icon="youtube" /%}

{% /cards %}

{% cards cols="2" lgCols="5" mdCols="5" smCols="2" %}

{% link-card title="Package Based Monorepos" type="tutorial" url="/getting-started/tutorials/package-based-repo-tutorial" icon="jsMono" /%}

{% link-card title="Integrated Monorepos" type="tutorial" url="/getting-started/tutorials/integrated-repo-tutorial" icon="nx" /%}

{% link-card title="Single React App" type="tutorial" url="/getting-started/tutorials/react-standalone-tutorial" icon="react" /%}

{% link-card title="Single Angular App" type="tutorial" url="/getting-started/tutorials/angular-standalone-tutorial" icon="angular" /%}

{% link-card title="Single Vue App" type="tutorial" url="/getting-started/tutorials/vue-standalone-tutorial" icon="vue" /%}

<!-- {% link-card title="React Monorepo" type="tutorial" url="/getting-started/tutorials/react-standalone-tutorial" icon="reactMono" /%}

{% link-card title="Angular Monorepo" type="tutorial" url="/getting-started/tutorials/angular-standalone-tutorial" icon="angularMono" /%}-->

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
{% link-card title="Deno" appearance="small" url="https://github.com/nrwl/nx-labs/tree/main/api/deno" icon="deno" /%}
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

## Have an Existing Project? Add Nx to it!

If you have an existing project and want to adopt Nx or migrate to Nx just run the following command which guides you through the migration process:

```shell
npx nx@latest init
```

Alternatively, here are some recipes that give you more details based on the technology stack you're using:

{% cards cols="2" mdCols="4" smCols="2" moreLink="/recipes/adopting-nx" %}

{% link-card title="Add to Existing Monorepo" appearance="small" url="/recipes/adopting-nx/adding-to-monorepo" icon="pnpm" /%}

{% link-card title="Add to Any Project" appearance="small" url="/recipes/adopting-nx/adding-to-existing-project" icon="nx" /%}

{% link-card title="Migrate from CRA" appearance="small" url="/recipes/react/migration-cra" icon="cra" /%}

{% link-card title="Migrate from Angular CLI" appearance="small" url="/recipes/angular/migration/angular" icon="angular" /%}

{% /cards %}

## Connect With Us

Connect on our channels and with the Nx Community to ask questions, get help and keep up to date with the latest news.

- Join our [Discord Community](https://go.nx.dev/community)
- Subscribe to our [Youtube Channel](https://www.youtube.com/@nxdevtools)
- Follow us on [Twitter](https://twitter.com/nxdevtools)
- Subscribe [to our tech newsletter](https://go.nrwl.io/nx-newsletter)
