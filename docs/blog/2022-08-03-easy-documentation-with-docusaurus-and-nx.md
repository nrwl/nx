---
title: 'Easy documentation with Docusaurus and Nx'
slug: 'easy-documentation-with-docusaurus-and-nx'
authors: ['Chau Tran']
cover_image: '/blog/images/2022-08-03/1*2jZKx8W5I3v5bpCsAUqlvQ.png'
tags: [nx, tutorial]
---

With its tight integration with the ecosystem, Nx is extremely powerful when it comes to authoring publishable Javascript/Typescript libraries. However, Nx doesn’t have a built-in documentation solution, which is essential to good libraries. But that does not mean we need to stop using Nx. In this blog, we will explore the power and flexibility of Nx that allows us to integrate some of the most popular documentation solutions out there. Docusaurus is one of them.

## What is Docusaurus?

Docusaurus is a Static Site Generator (SSG) solution that allows us to build beautiful documentation sites with the least amount of effort. Powered by React and its rich ecosystem, Docusaurus comes with a complete feature set:

- CLI tool to initialize a Docusaurus application
- Markdown / MDX support
- Feature-packed templates
- Advanced features like Versioning, i18n, Search, and Theming

Learn more about Docusaurus at: [https://docusaurus.io/docs](https://docusaurus.io/docs)

## Create a React library

We will create a UI library using React ([https://reactjs.org/](<https://reactjs.org/](https://reactjs.org/)>))) for this article's purposes. Let’s start by creating an empty Nx Workspace.

```shell
npx create-nx-workspace happyorg-docusaurus --preset=apps
```

Next, we will install the `@nrwl/react` plugin to have the best integration between React and Nx in our workspace.

```
npm install --save-dev @nrwl/react
```

With the plugin installed, we can generate a React library now. This library is going to be published to a registry (eg: NPM), so we will tell the generator that by setting the `--publishable` flag.

```shell
npx nx generate @nrwl/react:lib ui --publishable --import-path="@happyorg-docusaurus/ui"
```

> _Publishable Libraries require_ `_importPath_` _to be specified. Read more at_ [_Nx Publishable and Buildable Libraries_](/concepts/buildable-and-publishable-libraries)

The Nx React library generator gives us a fully set-up library that we can build, test, and lint against.

```
.
└── libs/ui/
    ├── README.md
    ├── jest.config.ts
    ├── package.json
    ├── project.json
    ├── src/
    │   ├── index.ts
    │   └── lib/
    │       ├── ui.module.css
    │       ├── ui.spec.tsx
    │       └── ui.tsx
    ├── tsconfig.json
    ├── tsconfig.lib.json
    └── tsconfig.spec.json
```

Let’s assume that our library is ready. Next, we are moving on to adding Docusaurus to write documentation for the library.

> _At this point, we can either generate a new React application, leverage standalone_ [_Storybook_](https://storybook.js.org/)_, or_ [_Nx React x Storybook integration_](/recipes/storybook/overview-react) _to render our library._

## Add Docusaurus to Nx

Nx does not come with an official plugin for Docusaurus. However, Docusaurus comes with its own CLI to get started, and we can just use that in our Nx Workspace. We will generate a new Docusaurus application named `docs` with the `classic` template. We also generate this Docusaurus application in our `apps/` directory.

```shell
npx create-docusaurus docs classic apps/
```

> _There are several other options that_ `_create-docusaurus_` _provides. Feel free to explore on your own._

From here, we can `cd apps/docs` and run the scripts to `start` or `build` our Docusaurus application. This approach does come with a couple of hiccups:

- We always have to remember to `cd apps/docs` to do anything with our Docusaurus application
- We do not take advantage of Nx caching mechanism and task orchestration.

With the current setup, we can integrate Docusaurus with Nx with one small configuration. Open up `workspace.json` and add the following

```json
{
  "$schema": "./node_modules/nx/schemas/workspace-schema.json",
  "version": 2,
  "projects": {
    "ui": "libs/ui",
+   "docs": {
+     "root": "apps/docs"
+   }
  }
}
```

Here, we tell Nx that there is a project called `docs` under `apps/docs`.

## Docusaurus and React 17

As of the time that this blog post is written, Docusaurus comes with React 17, while Nx React generators come with React 18. In addition to the configuration above, we need to update the React version of Docusaurus to React 18 before proceeding.

Let’s open `apps/docs/package.json` and update `react` with `react-dom` to `^18.0.0`.

> _Depending on your package manager, you might need to update React dependencies with_ `_--force_` _because Docusaurus sets React 17 as its peer dependencies._

## Working with Docusaurus and Nx

With the above small addition to `workspace.json`, we can now stay at the root of our workspace and invoke the scripts in `apps/docs/package.json`. Let’s start by serving our Docusaurus application

```shell
npx nx start docs
```

This command will subsequently invoke the `start` script in `apps/docs/package.json` which in turn invokes `docusaurus start`. We can use Nx to invoke any script in `apps/docs/package.json`, for example, `build`

```shell
npx nx build docs
```

## Caching Docusaurus build

With the current setup, we will see that our `docusaurus build` isn’t cached. The reason is Nx does not know about the output of `docusaurus build`, which is `apps/docs/build`. Conveniently, we can tell Nx about that by adding the following property to `apps/docs/package.json`

```json
{
  "name": "docs",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    ...
  },
  "dependencies": {
    ...
  },
  "devDependencies": {
        ...
  },
  "browserslist": {
        ...
  },
  "engines": {
    "node": ">=16.14"
  },
+  "nx": {
+    "targets": {
+      "build": {
+        "outputs": ["apps/docs/build"]
+      }
+    }
+  }
}
```

Now, running `npx nx build docs` might yield something like this

```
>  NX   Successfully ran target build for project docs (15s)
```

Running `npx nx build docs` the second time will then yield:

```
>  NX   Successfully ran target build for project docs (17ms)
```

> _Your time might differ from what is shown here._

## Control Nx command inputs

In addition to specifying the `outputs`, we can also specify the `inputs` that can help Nx determine whether to invalidate the cache.

Docusaurus comes with both documentation and blogging capabilities. We’d like to continue using the documentation capability in this scenario, but we want to hold off on blogging. However, we do not want to remove everything that relates to blogging capability. With `inputs` configuration, we can tell Nx to invalidate the cache only if the files in `apps/docs/docs` change

```json
{
  "name": "docs",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    ...
  },
  "dependencies": {
    ...
  },
  "devDependencies": {
        ...
  },
  "browserslist": {
        ...
  },
  "engines": {
    "node": ">=16.14"
  },
  "nx": {
    "targets": {
      "build": {
+       "inputs": [
+         "{projectRoot}/docs/*.(md|mdx)",
+         "{projectRoot}/docs/**/*.(md|mdx)"
+       ],
        "outputs": ["apps/docs/build"]
      }
    }
  }
}
```

That’s it. Now only changes to markdown files under `apps/docs/docs` invalidate the cache of our Docusaurus build.

## Bonus: Using Docusaurus Community Plugin

At Nx, we are extremely proud of our community. While there is no official Docusaurus plugin, there is one called [nx-plus/docusaurus](https://github.com/ZachJW34/nx-plus/tree/master/libs/docusaurus) that is created by the Nx Community. We are going to use `@nx-plus/docusaurus` to add another Docusaurus application to our workspace.

First, we need to install the plugin

```
npm install --save-dev @nx-plus/docusaurus
```

Next, we can generate a Docusaurus app by using the plugin’s `app` generator

```shell
npx nx generate @nx-plus/docusaurus:app plugin-docs
```

> _You can explore the options of_ `_@nx-plus/docusaurus:app_` _by using the flag_ `_--help_`

Now, we will have a new Docusaurus application under `apps/plugin-docs`. We can also start serving our new Docusaurus application with Nx

```shell
npx nx serve plugin-docs
```

## What is the difference between using `create-docusaurus` and the plugin?

The main difference is Docusaurus dependencies are added to the root `package.json` per [Single Version Policy](https://opensource.google/documentation/reference/thirdparty/oneversion), which might or might not be in our favor depending on the nature of our workspace. In return, the Nx plugin provides a unified way to `build` and `serve` the Docusaurus application using `targets`

## Conclusion

We did it! We finally have a great documentation solution for our library, provided by Docusaurus. In addition, we get to keep working both on the library and documentation under the same scalable and maintainable workspace provided by Nx.

Here are the things that we covered:

- How to generate an Nx Workspace and add a React library from scratch
- How to add a Docusaurus application in our Nx Workspace using `create-docusaurus`
- How to configure Nx with Docusaurus for discoverability and cache-ability
- How to use the Docusaurus community plugin instead of `create-docusaurus`

### Learn more

- 🧠 [Nx Docs](/getting-started/intro)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nrwl Youtube Channel](https://www.youtube.com/nrwl_io)
- 🥚 [Free Egghead course](https://egghead.io/courses/scale-react-development-with-nx-4038)
