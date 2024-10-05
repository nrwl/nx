---
title: Introducing @nx/nuxt Enhanced Nuxt.js Support in Nx
slug: 'introducing-nx-nuxt-enhanced-nuxt-js-support-in-nx'
cover_image: '/blog/images/2024-02-06/featured_img.png'
authors: ['Katerina Skroumpelou']
tags: [devtools, javascript, monorepos, nuxt]
---

We're excited to introduce a new way to enhance your [Nuxt](https://nuxt.com/) development workflow! After the Vue plugin, we're introducing our new Nx plugin for Nuxt, `@nx/nuxt`. Designed for Nuxt developers and existing Nx users alike, this integration brings the best of both worlds into your development ecosystem, enabling you to leverage Nx's powerful capabilities seamlessly within your Nuxt projects.

## Why Consider Nx for Your Nuxt Projects?

Using Nx with your Nuxt.js projects presents the following advantages:

- **Monorepo Management**: Simplify the management of multiple projects within a single repository, facilitating code sharing and reducing overhead.
- **Modular Development**: Break down your Nuxt app into manageable, independent modules that can be developed, tested, and deployed in isolation.
- **Enhanced Caching**: Accelerate your development with Nx's intelligent caching, automatically configured for your Nuxt projects.
- **Nx generators**: Nx provides generators for scaffolding new Nuxt applications, with support for Jest, Storybook, and e2e test generation with Cypress or Playwright.
- **Automated upgrades**: Nx offers a set of migrators that help you upgrade your projects.

## Getting Started with Nx and Nuxt.js

Whether you're initiating a new project or integrating into an existing one, `@nx/nuxt` offers a straightforward setup process:

### Starting a New Nx Workspace with Nuxt

Creating a new Nx workspace optimized for Nuxt is as simple as running:

```shell
npx create-nx-workspace@latest --preset=nuxt
```

Our setup wizard will guide you through the initial configuration, ensuring your workspace is tailored to your needs:

```shell
npx create-nx-workspace@latest

 >  NX   Let's create a new workspace [/getting-started/intro)/getting-started/intro]

✔ Where would you like to create your workspace? · my-org
✔ Which stack do you want to use? · vue
✔ What framework would you like to use? · nuxt
✔ Integrated monorepo, or standalone project? · integrated
✔ Application name · my-app
✔ Test runner to use for end to end (E2E) tests · playwright (also cypress)
✔ Default stylesheet format · scss (also css, less)
✔ Set up CI with caching, distribution and test deflaking · github
```

This command will create a new Nx workspace with a single Nuxt application, complete with essential features and ready for development.

## Enhancing an Existing Nuxt Project with Nx

Integrating Nx into an existing Nuxt.js project has never been easier, with the help of the `nx init` command. This command will add Nx to your project without the need to disrupt your current setup.

### How It Works

When you run `nx init` in your existing Nuxt.js project, Nx does the following:

- **Installs @nx/nuxt**: Adds the necessary Nx and @nx/nuxt dependencies to your project, enabling Nx's features while keeping your existing setup intact.
- **Understands Existing Configurations**: Nx automatically recognizes your nuxt.config.js or nuxt.config.ts file, ensuring that all your custom configurations, scripts, and commands are preserved and utilized.
- **Minimal Configuration**: Only a minimal `nx.json` file is added to your project. This file is used to configure the `@nx/nuxt` plugin if needed, but in most cases, your existing Nuxt.js configurations will suffice.

To begin the integration process, simply navigate to the root of your existing Nuxt.js project and run:

```shell
npx nx init
```

This approach offers several key benefits for teams looking to adopt Nx:

- **Zero Disruption**: Your project will continue to use its existing configurations, and the existing configuration entrypoint files. There's no need to learn new configuration syntaxes or reconfigure your project to start using Nx.
- **Immediate Value**: Instantly gain access to Nx's powerful developer tools and build system, without significant changes to your project.
- **Future Flexibility**: As your project grows, Nx is ready to scale with you. You can gradually adopt more Nx features and plugins over time, at a pace that suits your team.

## Using Nx to run your Nuxt app

Nx scans your workspace to look for Nuxt configuration files (eg. `nuxt.config.ts`). It uses these files to understand where your Nuxt projects live, and uses them to set up tasks that can be invoked through Nx, like `serve` and `build`. So, in your Nx workspace, you can then run:

```shell
nx serve my-nuxt-app
```

and

```shell
nx build my-nuxt-app
```

and these commands will call the `nuxt` CLI under the hood, enhanced with Nx's features.

You can see a visual representation of your task dependencies by running

```shell
nx graph
```

![Task graph - build](/blog/images/2024-02-06/bodyimg1.png)

You can also see how Nx configures your tasks, by running:

```shell
nx show project my-nuxt-app --web
```

![Project details](/blog/images/2024-02-06/bodyimg2.png)

![Project details - individual task details](/blog/images/2024-02-06/bodyimg3.png)

### Using Nx Console

You get access to all these features through our VSCode and WebStorm [Nx Console extension](/getting-started/editor-setup).

You can use Nx Console to visualize tasks, and understand where each inferred task (like `build` and `serve` in Nuxt's case) is coming from, with our codelens-like feature, as an alternative to the `--web` flag on the `nx show project` command.

Nx Console is also very convenient for generating code and running tasks, since it offers a graphical user interface for all the amazing features of the Nx CLI.

## What Does Nx Bring to Your Nuxt Development?

With `@nx/nuxt`, your Nuxt projects gain automatic recognition of `build` and `serve` processes. There's no need to deal with unfamiliar configurations; Nx intuitively understands your Nuxt project structure and optimizes accordingly.

### Modularize and Scale with Ease

One of the most compelling aspects of using Nx with Nuxt.js is the ability to modularize large applications into manageable libraries or components. This not only makes your codebase more organized and maintainable but also significantly enhances your development workflow and CI processes.

#### Breaking Down a Monolithic Nuxt App

Large Nuxt applications can become challenging to maintain and scale over time. By adopting Nx, you can structure your Nuxt app as a collection of smaller, focused libraries. Each library can encapsulate specific functionalities or features, such as UI components, utilities, or business logic.

#### Independent Development and Testing

This modular structure allows teams to work on different aspects of the application in parallel, reducing bottlenecks and improving collaboration. Furthermore, you can run tests, linters, and other checks independently for each library, making your development process more efficient and targeted.

For instance, if you want to create a new Vue UI library, you can use the following command:

```shell
nx generate @nx/vue:lib libs/my-shared-ui
```

This command creates a my-shared-ui library within your workspace, which can then be used across your Nuxt app and potentially other applications within the same workspace.

#### Enhancing CI with Modular Builds

On the CI front, Nx's modular approach makes things much faster. You can configure your CI pipeline to build, test, and deploy only the affected libraries and applications, thanks to Nx's advanced dependency graph analysis. This results in faster CI runs and more efficient resource utilization.

#### Sharing Code Between Applications

Nx's workspace model facilitates code sharing between projects, which is particularly useful in monorepos containing multiple front-end projects. With Nx, sharing UI components, utilities, or services between these applications becomes straightforward.
To share code, simply import the library into your Nuxt and Vue applications as needed. Nx takes care of the rest, ensuring that dependencies are correctly managed and that your applications remain buildable and testable.

Imagine a scenario where your workspace contains a Nuxt application for your public-facing website and a Vue application for an internal tool. You can create a shared library for common UI components, such as buttons, inputs, and modals, and use these components in both applications. This not only reduces duplication but also ensures consistency across your projects.

```ts
// Importing a shared UI component in your Nuxt app
import { MyButton } from '@my-org/my-shared-ui';
```

```ts
// Importing the same component in your Vue app
import { MyButton } from '@my-org/my-shared-ui';
```

### Visualizing Your Project Structure

Nx provides a clear overview of your project's structure and dependencies, making it easier to manage complex applications. The Nx Console extension for VSCode, for instance, offers a graphical interface to visualize and run tasks, enhancing your development experience.

In your workspace, you can run

```shell
nx graph
```

and see the structure of your projects:

![A project graph](/blog/images/2024-02-06/bodyimg4.png)

## Embracing Nx in Your Nuxt Journey

Whether you're starting a new Nuxt project or looking to enhance an existing one, Nx offers a compelling set of tools and features to streamline your development process. From modularization to caching, the integration of Nx into your Nuxt projects promises a more efficient, scalable, and enjoyable development experience. By embracing Nx's capabilities in your Nuxt development, you're not just optimizing your current workflow; you're future-proofing your development process. As your projects grow and evolve, Nx's modular architecture and powerful tooling will continue to provide value, making your development experience more enjoyable and productive.

## Nx Live With Nuxt Maintainer Daniel Roe

Don’t miss Nx team members Zack and Katerina with Nuxt’s maintainer, Daniel Roe — live!

{% youtube src="https://www.youtube.com/watch?v=uHwUxFYX2DY" %}

## Learn more

Check out the [example repo](https://github.com/mandarini/my-nx-nuxt-workspace) used in this blog post or one of the links below to learn more:

- [Nx Docs](/getting-started/intro)
- [Nx GitHub](https://github.com/nrwl/nx)
- [Nx Community Discord](https://go.nx.dev/community)
- [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- [Speed up your CI](/nx-cloud)

Also, if you liked this, make sure to follow [Katerina](https://twitter.com/psybercity) and [Nx](https://twitter.com/nxdevtools) on Twitter for more!
