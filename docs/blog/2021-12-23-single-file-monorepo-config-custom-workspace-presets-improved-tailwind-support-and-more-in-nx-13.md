---
title: 'Single File Monorepo Config, Custom Workspace Presets, Improved Tailwind Support, and more in Nx 13.4!'
slug: 'single-file-monorepo-config-custom-workspace-presets-improved-tailwind-support-and-more-in-nx-13'
authors: ['Brandon Roberts']
cover_image: '/blog/images/2021-12-23/1*_4u3Fw49H5U-sqgyBoGsqw.png'
tags: [nx, release]
---

Nx is a smart, extensible build framework to help you architect, test, and build at any scale — integrating seamlessly with modern technologies and libraries while providing a robust CLI, computation caching, dependency management, and more.

## One Million Weekly Downloads 🎉

Nx reached a major milestone this week of one million weekly downloads. Nx has been working to push monorepos forward for a long time, and this milestone is a reflection of work between us and the Nx community to grow and expand in this space.

![](/blog/images/2021-12-23/1*WC4RQRZhTtOCsiATOL1cBg.avif)
_One million weekly downloads_

## Single File Monorepo Configuration ☝️

When operating with a monorepo, some level of configuration is needed to provide context about the tools and structure for inferring information about projects. Nx has traditionally done this with 2 files, the **nx.json** that contains global configuration for the Nx CLI, and the **workspace.json** that contains references to projects within your workspace.

With the latest release of Nx and add-nx-to-monorepo 2.0, there is only the **nx.json** configuration file added to your existing monorepo, with the project information done through analyzing your workspace for existing projects. This allows you to **incrementally adopt** Nx into your monorepo to run tasks, cache computations, and more.

```shell
npx add-nx-to-monorepo
```

> Victor Savkin demoed the flexibility of Nx by migrating Meta’s (Facebook) React repository: [video link](https://youtu.be/XLP2RAOwfLQ)

Learn more in our guide of [adding Nx to an existing workspace](/recipes/adopting-nx/adding-to-monorepo) and the config inside the [**nx.json**](/reference/project-configuration)**.**

## Custom Workspace Presets 🎨

Nx provides many presets by default to support many different ecosystems. Nx for monorepos is like VSCode, where plugins allow you to extend the functionality of your monorepo to fit your ecosystem or platform of choice. To make it easier for scaffolding a pre-defined setup, we’ve introduced the ability to use custom presets when creating Nx workspaces with a provided npm package.

```shell
npx create-nx-workspace --preset=your-npm-package-name
```

Nicholas Cunningham just joined Nrwl and already implemented this new Nx feature! In the following video, [Juri Strumpflohner](https://twitter.com/juristr) walks you through the process of creating a new Nx Plugin with a custom preset.

{% youtube src="https://www.youtube.com/watch?v=yGUrF0-uqaU" /%}

This allows you to enhance the initial experience for new workspaces directly for your organization, and allows the Nx Plugin community to offer more tailored experiences. Please try out the new feature and [let us know](https://github.com/nrwl/nx) how we can improve it!

## Dedicated TypeScript and JavaScript support with @nrwl/js

Nx has always shipped with great TypeScript support. In version 13.4 we improve it even further by releasing a brand new package: `@nrwl/js` .

This is particularly useful if you have framework-agnostic TS/JS packages within an existing Nx workspace but also for those scenarios where you want to build and publish a TS/JS-based library to some package registry. The setup is very lightweight, but still provides all benefits you’d expect from an Nx-based setup such as Jest, ESLint, Prettier etc.

Read all the details on [our new TypeScript guide](/getting-started/intro) or check out the video walkthrough below.

{% youtube src="https://www.youtube.com/watch?v=-OmQ-PaSY5M" /%}

## Improved Tailwind support for Angular 💅

![](/blog/images/2021-12-23/0*1yacozydc1muZ74G.avif)
_Tailwind Logo_

Tailwind is a utility-first CSS framework packed with classes that can be composed to build any design, directly in your markup. If you’ve used Tailwind with Angular applications previously, it's supported out of the box with Nx. We’re continually looking to improve the developer experience of using Tailwind in Angular applications and libraries. We already added support to the Angular plugin for Nx, and have added a new generator to configure Tailwind in **existing** apps and buildable/publishable libs, allowing you to set up and configure Tailwind without manual steps. The ability to configure new apps and libs is also supported, with support for Tailwind V2 and the latest V3 release.

```shell
nx g @nrwl/angular:app my-app --addTailwind
```

Read more about Angular and Tailwind in our [docs](/nx-api/angular/generators/setup-tailwind).

### Other Highlights 🗒

- Added SWC support for compiling JavaScript libraries and React apps/libs when building projects
- Added migration support Create React App version 5
- Updated the Angular framework to version 13.1
- Update support for Cypress to version 9
- Added additional SCAM generators for Angular for pipes and directives.
- Improved developer experience for using Module Federation with Angular v13

## How to Update Nx

Updating Nx is done with the following command, and will update your Nx workspace dependencies and code to the latest version:

```shell
nx migrate latest
```

After updating your dependencies, run any necessary migrations.

```shell
nx migrate --run-migrations
```

## Explore More

- Get our [free basic Nx workspaces course on YouTube](https://youtu.be/2mYLe9Kp9VM)!
- Purchase our premium video course on advanced practices for Nx workspaces: [here](https://nxplaybook.com/p/advanced-nx-workspaces)!

Follow us [on Twitter](https://twitter.com/NxDevTools), and subscribe to the [YouTube Channel](https://youtube.com/nrwl_io?sub_confirmation=1) for more information on [Angular](https://angular.io/), [React](https://reactjs.org/), Nx, and more!
