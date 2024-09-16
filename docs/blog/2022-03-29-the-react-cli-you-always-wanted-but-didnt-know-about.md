---
title: 'The React CLI you always wanted but didn’t know about'
slug: 'the-react-cli-you-always-wanted-but-didnt-know-about'
authors: ['Juri Strumpflohner']
cover_image: '/blog/images/2022-03-29/1*YR6QUEZel3nlNcTo6Pdlwg.png'
tags: [nx]
---

_In this article, I’d like to specifically talk about developer tooling, why it is so massively important and how you might have missed out on Nx as your main React CLI for kickstarting new awesome projects._

It is awesome to be a JavaScript developer nowadays. The JavaScript ecosystem has evolved a lot in recent years. For the better! Speed has become a major focus, both from the framework perspective of running the app in production, as well as the speed of developing, testing, and building JavaScript/TypeScript from a developer tooling point of view. Frameworks and libraries such as Next.js, Astro, Qwik and Remix (just to name a few) have brought some great innovations to push the web even further.

While speed is of major importance, developer ergonomics shouldn’t be left behind. Both of them greatly contribute to the overall productivity and also developer happiness 🙂. Let’s see how Nx can help with that.

**Prefer the video version?**

{% youtube src="https://www.youtube.com/watch?v=QghilgRe-pw" /%}

## Update (Aug 2023): Want a non-monorepo setup?

This article walks you through how to setup a new Nx monorepo workspace with React. If you rather prefer starting with a single-project setup (also named “standalone”) then you might want to have a look at this tutorial (including video):

[/getting-started/tutorials/react-standalone-tutorial](/getting-started/tutorials/react-standalone-tutorial)

## Why use a devtool CLI?

Regardless of whether you’re a seasoned developer or someone new just getting started with React: the last thing you want to have to deal with is to manually set up all the tooling to actually get started and be productive. You want to be able to focus on the actual task, like learning React or kicking off that new shiny project.

Still, we definitely want to **have good defaults set up for us**. Things like the latest build tooling, tooling for writing unit tests as well as e2e tests, code quality tools like linters, and we definitely also don’t want to argue about tabs vs spaces or spend time formatting our code: Prettier can help with that.

Taking the time to set up a starter kit or template would work. But it is time-consuming, requires a lot of knowledge, and especially needs maintenance to update the tools over time. That rarely works out well in the long run, unless this is your job.

## Nx — from a bird’s eye view

What you usually want is a CLI, a command-line interface that helps you develop and deal with the underlying build infrastructure, something that sets you up with modern up-to-date tooling and also keeps those updated!

Nx comes with such a CLI, it is widely adopted by the Angular, React and Node community currently being downloaded more than 1.3 million times a week. Nx is [fully open source](https://github.com/nrwl/nx) (MIT licensed), baked by [Nrwl](/company) and the [community](https://go.nx.dev/community).

From a bird’s eye view, Nx comes with

- Code generators to generate new projects, configuration but also components, Redux setup, routes…
- Out of the box support for modern tools such as TypeScript, Webpack, Babel, SWC, Jest, Cypress, ESLint, Prettier, Storybook and more
- It keeps tooling up to date via dedicated migration commands
- Speed! Nx uses local computation caching that can be extended with Nx Cloud (which is basically free) to remote caching and DTE (Distributed Task Execution).

But let’s have a deeper look at how Nx works exactly.

## Using Nx

Let me give you an overview of the most used functionality that Nx gives you such that you get a good understanding of whether it might suit your needs.

## Creating a new Nx React project

Open your favorite terminal window and type:

```shell
npx create-nx-workspace@latest myorg
```

> _Note, I’m using_ `_npx_` _to not have to install the Nx CLI globally. If you want to, you totally can:_ `_npm i nx -g_`

`myorg` is the scope of your Nx workspace. Think of it as your NPM scope in case you’d publish an npm package. In the case you create libraries in this new Nx workspace (more about that later), it would be used to import those, like

```typescript
import { someFunc } from '@myorg/somelib';
```

What you’ll get is a setup wizard that guides you through creating your application. We would most likely choose “React” in this case.

![](/blog/images/2022-03-29/1*zLwqiNgVNDrLJMir1BV5TA.avif)
_Nx CLI guides through the setup process_

As part of this process, you’ll be asked to pick an “Application name”. This is simply the application Nx is going to generate for us to get started: `happynrwl` would be a nice name 🙂.

You should end up with a new Nx workspace and our `happynrwl` React app in the `apps/` folder.

![](/blog/images/2022-03-29/1*3OToVs1mu94M0Bt4WHvYMg.avif)
_Layout of a Nx workspace in VSCode_

## Serving our React app

To serve our React app, run

```shell
npx nx serve happynrwl
```

> _Note I prefix the commands with_ `_npx_`_, which is just a way to use the local_ `_nx_` _binary from the_ `_node_modules_` _folder of our workspace. Also, this way we don’t have to install Nx globally. If you prefer doing that, run_ `_npm install -g nx_`_._

Going to [http://localhost:4200](http://localhost:4200/) should show the running React app located in `apps/happynrwl`.

![](/blog/images/2022-03-29/1*TCZXh6HHJ7t9mEl3WzACrg.avif)
_Welcome screen when launching the React application with Nx_

## Build our React app

Similarly, to build our React application, run

```shell
npx nx build happynrwl
```

This should build the app into `dist/apps/happynrwl`, which we can then take and deploy to wherever we want to deploy it.

![](/blog/images/2022-03-29/1*JvmIPkyEijF7akQwgr201w.avif)
_Output folder assets when building the React app_

Nx has another nice feature that basically comes for free: [computation caching](/concepts/how-caching-works). For every command Nx runs, it computes a unique hash that contains information about the involved source code, environment variables and the command itself. Next time the same conditions are met, the command is not executed again, but rather pulled out of a cache. As you can imagine, this drammatically speeds up things.

If you’re curious and want to learn more, check out the docs page on [computation caching](/concepts/how-caching-works) and how to leverage [Nx Cloud](/nx-cloud) to store the cache remotely for sharing it with your team members. Also, Nx Cloud pricing recently changed, which makes it basically free for everyone.

## Code Generators!

One of the core parts of Nx is code generators. As the name already suggests, code generators generate source code and configuration. That can range from a single React component file to an entire project with all that is needed. You basically already saw them in action when you created the initial project setup. But there’s more to explore! Every Nx plugin (e.g. `@nrwl/react`, `@nrwl/next`,...) come with their own set of generators. All of them are invoked with the `npx nx generate` or short `npx nx g` command.

Let’s for instance generate a new component for our React application:

```shell
npx nx generate @nrwl/react:component HelloWorld
```

This generates a new component in our `happynrwl` application

![](/blog/images/2022-03-29/1*LSrJe2d93wPWzKwZ-gGzXw.avif)
_Example of a React component generated by Nx_

> _Note, you can also use_ `_nx g @nrwl/react..._` _as a shorthand for_ `_generate_`_. Also, if you attach_ `_--dry-run_` _to the end of the command it will just simulate the run without touching the file system._

Many of these generators come with a rich set of flags. For example, passing `--routing` to our component generator from before, generates a component with routes already set up, adds `react-router-dom` to the `package.json` and executes a `npm install`.

**How do we find all these generators though?** There are different options:

- **Nx documentation** — use the search function there or just navigate the docs. All the reference pages are structured like `nx.dev/packages/<packagename>`. As an example for React that would look like: [/nx-api/react](/nx-api/react).
- `npx nx list` - lists a set of installed plugins as well as other available plugins that can be installed. To get a list of generators for a specific plugin - say for the `@nrwl/react` plugin - run `npx nx list @nrwl/react`. Similarly, you can then run `npx nx g @nrwl/react:lib --help` to get help for a particular generator

However, the absolute easiest way to explore the potential and even use Nx if you are not the “terminal type of person” is [Nx Console](https://marketplace.visualstudio.com/items?itemName=nrwl.angular-console)! I’ll go a bit deeper into that in a later section.

## State of the Art Tooling Preconfigured

When setting up a new React project (that also holds for Angular, Node, Next.js,…), you do not only get the React project, but also a set of tools preconfigured that help you stay productive and produce higher quality code. These are

- TypeScript
- ESLint
- Jest
- Cypress
- Prettier

The Nx core team closely collaborates with these open source projects to not only make sure they integrate seamlessly with the React setup but also to keep them updated over time as those tools evolve. In fact, by using [automated code migrations](https://egghead.io/lessons/javascript-update-your-nx-workspace-with-nx-migrations) updating your Nx workspace will automatically also update those tools and the corresponding config files for you.

Let’s have a closer look.

## TypeScript as a first-class citizen!

The Nx core team strongly believes in the benefits of TypeScript (in fact, check out the [new Nx and TypeScript setup](/getting-started/intro)). As such, by default every project is automatically set up and configured to use TypeScript, making sure builds, as well as IDEs, are able to properly pick up TypeScript definitions. All without you having to worry about it.

Now, if you really want to use pure JavaScript you totally can. Just pass the `--js` when running a generator. Read [more on the docs](/recipes/tips-n-tricks/js-and-ts).

## ESLint preconfigured!

Every new Nx workspace comes with [ESLint](https://eslint.org/) already preconfigured. Having proper linting in place is a great way to help contribute to overall better code quality by statically analyzing your source code and finding potential issues early in the process.

Every project generated by Nx comes with a `.eslintrc.json` file. That configuration extends from an ESLint plugin `@nrwl/nx/react` , containing a set of best practices rules, and at the same time allows you to add further rules that are specific to your needs.

![](/blog/images/2022-03-29/1*dK6mtSHmsgiMDWF1XotMEA.avif)
_ESLint configuration in an Nx workspace_

Linting can be run similarly to the other commands:

```shell
npx nx lint happynrwl
```

## Jest preconfigured!

Similar to the linting setup, every project in an Nx workspace has a test runner preconfigured already. By default, Nx comes with [Jest](https://jestjs.io/).

At the root of every project, there’s a `jest.config.js` which already comes with proper transformers to support TypeScript and TSX/JSX. If you need to further customize how Jest should behave for this project, this is the place to do that.

![](/blog/images/2022-03-29/1*JyIIbncCwSqDMg3gWzUPBw.avif)
_Jest configuration in an Nx workspace_

Running Jest tests is as easy as

```shell
npx nx test happynrwl
```

Obviously, you can pass parameters to customize the Jest run, like

- `--watch` for interactive mode
- `--t` to execute tests that match a given pattern
- `--testFile="apps/happynrwl/src/app/hello-world/hello-world.spec.tsx”` to run a specific file
- …

If you happen to use [VSCode](https://code.visualstudio.com/), the easiest way however is to install [Jest Runner](https://marketplace.visualstudio.com/items?itemName=firsttris.vscode-jest-runner) and leverage its code lens feature to run and debug Jest tests:

![](/blog/images/2022-03-29/1*11HC8HeQER_YIbyd9RpdNA.avif)
_Using VSCode extensions to run Jest tests directly via Code Lens support_

## Cypress preconfigured!

[Cypress](https://www.cypress.io/) has revolutionized e2e testing by making it more developer-friendly. Who likes to write tests after all. That just gets even worse if the DX sucks. Cypress successfully tackled that by listening and addressing the pain of existing e2e testing solutions.

Whenever you generate a new project in an Nx workspace, you have the option to automatically also create a Cypress-based e2e project alongside it. In our case, it is called `happynrwl-e2e`.

![](/blog/images/2022-03-29/1*OA1d-lV54ylpNFd9ayJ07Q.avif)
_Cypress e2e app generated by Nx along-side the main React app_

The awesome part of this is that you don’t have to configure anything at all. No need to

- make sure TypeScript runs smoothly with Cypress
- set up linting for our e2e project (yes writing good quality test code is just as important)
- spinning up our development server manually first that serves our React app such that we are able to load it in our Cypress tests environment

Just execute

```shell
npx e2e happynrwl-e2e
```

You can also pass `--watch` to run it interactively with the Cypress test runner such that the tests get re-executed whenever we change our source.

## Don’t argue over code formatting — use Prettier!

Are you a `tabs` or `spaces` person? Use semicolons or not? What about trailing commas? We all know that we devs can have some strong opinions on this 😅. But honestly, there are probably more important things to focus on. Luckily [Prettier](https://prettier.io/) can help a ton with these issues. It is opinionated with just very few configuration options and just takes away the burden of formatting the code.

When you set up a new Nx workspace, it has Prettier already preconfigured. The best way is to integrate it with your code editor such that formatting is run on every save of a file. Alternatively, you can also run

```shell
npx nx format
```

## Nx Console — A dedicated VSCode extension for Nx

![](/blog/images/2022-03-29/1*1gRcDUmEkjOn6DR8vO9MHA.avif)

Nx really is an advanced CLI based development tool. But regardless of whether you are a command line person or not, if you happen to use [VSCode](https://code.visualstudio.com/) make sure you install the [Nx Console extension](/getting-started/editor-setup) from the [marketplace](https://marketplace.visualstudio.com/items?itemName=nrwl.angular-console).

> _For_ [_Webstorm_](https://www.jetbrains.com/webstorm/) _there are two community extensions that can be used:_ [_nx-webstorm_](https://plugins.jetbrains.com/plugin/15000-nx-webstorm) _and_ [_Nx Console Idea_](https://plugins.jetbrains.com/plugin/15101-nx-console-idea)_._

Once you have the extension installed, you can click its icon in the VSCode Activity Bar (1) which reveals the Nx Console UI.

![](/blog/images/2022-03-29/1*GPrI7Pta18FuEljgm9h4pQ.avif)
_Nx Console VSCode extension_

A couple of things:

- (2) is the panel where you see a fixed command “Generate” to invoke the Nx generator for creating new projects, libraries etc as we mentioned before. In addition you see a list of available commands to run.
- (3) shows additional commands that are commonly used in an Nx workspace. Feel free to click and explore them.
- (4) shows a list of projects in your workspace. We really just have our React app and Cypress e2e application, but potentially you could add more. See [Nx applications and libraries](/concepts/decisions/project-size) for more.

Let’s take the example of generating a new React component, just as we did before, but this time using Nx Console. This is how you’d do that:

![](/blog/images/2022-03-29/1*wJ4ZldDh_Glvxwl_0SDxHA.avif)
_Actions to generate a new React component with Nx Console_

Once you click the entry in the dropdown list, the Nx Console generate form opens, showing all the options the Nx generator supports:

![](/blog/images/2022-03-29/1*0F8baQFGgATjnQn30CqVeg.avif)
_Detail form shown by Nx Console to generate a new React component_

Whenever you change something in the form (1), you’ll automatically see a dry-run in the console that opens below (2). That shows what would happen if you run the command and is equivalent of adding the `--dry-run` flag whenever you’d run the command on the terminal. Once you’re ready, hit the “Run” button (3), or click the copy symbol (4) to copy the full command into your clipboard s.t. you can then paste it into your terminal.

As you can see this approach is also really powerful for exploring different commands and their corresponding options.

Besides running generators, Nx Console also adds [VSCode Code Lens](https://code.visualstudio.com/blogs/2017/02/12/code-lens-roundup) abilities to the configuration files that help you navigate more quickly across the workspace. This is particularly useful if you happen to add more [apps and libraries](/concepts/decisions/project-size) to the workspace at some point.

![](/blog/images/2022-03-29/1*WIbxp7um-f4CK2-N-zRing.avif)
_Nx Console Code Lens support to navigate easily among config files_

## Evergreen Workspace Setup

One of the advantages of using Nx over — say CRA or a custom starter template — is that your **Nx workspace is evergreen**. What do I mean by that: by now we all know how fast the frontend space is moving, and so are the corresponding devtools. Today you might be using [Rollup](https://rollupjs.org/) to build your libraries, tomorrow you use [swc](https://swc.rs/), [vite](https://vitejs.dev/) or [esbuild](https://esbuild.github.io/). Same with [Webpack](https://webpack.js.org/). Webpack 5 has been around for a while already, and still, a lot of projects are stuck at v4.

Just to mention an example: when upgrading Nx to v13, all Nx users automatically got migrated to Webpack 5.

This is possible with Nx’s [migrate command](/nx-api/nx/documents/migrate) that allows you to keep up to date with your framework in a mostly automated fashion. Whenever you upgrade Nx, you run

```shell
npx nx migrate latest
```

Running this command, Nx

- analyzes the current packages
- fetches the latest Nx packages and plugins (or whatever version was specified in the migration command)
- creates a `migrations.json` file containing all migration scripts that need to be executed
- updates the `package.json` to the new package versions

The `migrations.json` file can be inspected and potentially modified. Once it is ready, running the following command executes the migration:

```shell
npx nx migrate --run-migrations=migrations.json
```

These migrations not only update the `package.json` version. They also update corresponding configuration files and even source code by leveraging ASTs to query and manipulate files.

It is not even only about upgrading the frameworks such as React or Angular themselves, though. A common pain point is their integration with other tools, such as Jest, Storybook, ESLint etc. The Nx core team closely collaborates with these communities to make sure that a particular combination of versions works and is tested before migrating your workspace.

{% youtube src="https://www.youtube.com/watch?v=Ss6MfcXi0jE" /%}

## Common Questions

Here are some common questions developers have. Have some more? Feel free to ping me on Twitter ([@juristr](https://twitter.com/juristr)), the official Nx account ([@NxDevtools](https://twitter.com/nxdevtools)) or in the [Nx community Discord](https://go.nx.dev/community).

## Q: How can I customize how my project is built and served?

Every Nx project comes with a `project.json` which contains the basic setup of targets (example: `build`, `serve`, `test`, `lint`,..) that can be run against the project.

Here’s the `project.json` for our `happynrwl` React application. I clipped out the non-relevant parts here:

```json5
{
  ...
  "targets": {
    "build": {
      "executor": "@nrwl/web:webpack",
      ...
      "options": {
        "compiler": "babel",
        "outputPath": "dist/apps/happynrwl",
        "index": "apps/happynrwl/src/index.html",
        "baseHref": "/",
        "main": "apps/happynrwl/src/main.tsx",
        "polyfills": "apps/happynrwl/src/polyfills.ts",
        "tsConfig": "apps/happynrwl/tsconfig.app.json",
        "assets": [
          "apps/happynrwl/src/favicon.ico",
          "apps/happynrwl/src/assets"
        ],
        "styles": ["apps/happynrwl/src/styles.css"],
        "scripts": [],
        "webpackConfig": "@nrwl/react/plugins/webpack"
      },
      "configurations": {
        "production": {
          ...
        }
      }
    },
    "serve": {
      ...
    },
    ...
  },
  "tags": []
}
```

As you can see, all these “targets” (`build`, `serve`,...) have a so-called `options` property that allows you to configure how the target behaves. The actual configuration is abstracted behind the “[Nx Executor](/concepts/executors-and-configurations)”, in our case `@nrwl/web:webpack`. You can find the details of how to configure that on the Nx docs in the CLI reference for the `@nrwl/web` package: [/nx-api/webpack/executors/webpack](/nx-api/webpack/executors/webpack).

To read more about how the `project.json`, its executors, and configuration options are structured, check out the official docs: [/reference/project-configuration](/reference/project-configuration).

> _Note, Nx is also able to just pick up NPM scripts registered in the_ `_package.json_` _of your project root. This scenario is most useful if you’re adding Nx to an existing monorepo (see_ [_add-nx-to-monorepo_](https://www.npmjs.com/package/add-nx-to-monorepo)_). Read more here:_ [_/reference/project-configuration_](/reference/project-configuration)

Nx’s extensibility and customizability have really no limits, allowing it to really adapt to your needs. Here are some resources to learn more if you need some advanced features.

- [Custom workspace executors](/extending-nx/recipes/local-executors)
- [Custom workspace generators](/extending-nx/recipes/local-generators)
- [Create Nx plugins](/nx-api/plugin)
- Control the entire workspace setup with [custom presets](/nx-api/plugin)

## Q: Can I customize my Webpack config used to build my React app?

As mentioned previously, the underlying build machinery is usually hidden by a so-called [Nx Executor](/concepts/executors-and-configurations). As we have seen you can customize its behavior via the corresponding `options` property. By abstracting the underlying build tool, Nx is able to fulfill its evergreen promise as mentioned previously and allows to seamlessly upgrade workspaces to the latest versions of the build tooling that is being used.

If the available `options` are not enough, you can further customize the Webpack configuration using the `webpackConfig` property:

```json5
{
  ...
  "targets": {
    "build": {
      "executor": "@nrwl/web:webpack",
      ...
      "options": {
        ...
        "webpackConfig": "@nrwl/react/plugins/webpack"
      },
      ...
    },
    ...
  },
  "tags": []
}
```

By default it links to `@nrwl/react/plugins/webpack`, but you can point to your own custom file in the Nx workspace. The file needs to look like the following:

```javascript {% fileName="apps/my-app/webpack.config.js" %}
const fromNrwlReact = require('@nrwl/react/plugins/webpack');
function getWebpackConfig(config) {
  // invoke the Nrwl specific config to preserve the original
  // behavior
  config = fromNrwlReact(config); // add your own customizations HERE return config;
}
module.exports = getWebpackConfig;
```

Notice how the default Nrwl provided Webpack configuration is invoked first to not lose the default behavior, followed by your own customizations.

## Q: Why is there an “apps” folder? Can I change it?

Sure! Nx allows to host multiple applications and libraries in a single workspace: a monorepo scenario basically. In fact, even in our simple setup we have two applications: `happynrwl` and the corresponding e2e application, `happynrwl-e2e`.

In a default setup Nx generates an `apps` folder for hosting applications, and `libs` folder for hosting libraries. Read more about [“Apps and Libs” on the Nx docs](/concepts/decisions/project-size).

You can change this setup in `nx.json` by adjustijng the `workspaceLayout` property which has an `appsDir` and `libsDir` configuration.

```json5
{
  ...
  "workspaceLayout": {
    "appsDir": "apps",
    "libsDir": "libs"
  },
  ...
}
```

## Q: Is there a way to migrate from CRA?

Absolutely. Check out this guide on the Nx docs that has all the details (including a video walkthrough): [/recipes/adopting-nx/adding-to-existing-project](/recipes/adopting-nx/adding-to-existing-project)

## Q: This looks like a lot 🤯. Do I really need it from the get go?

Agreed. Luckily Nx is plugin based, so you can start with the bare minimum (see using [Nx without plugins](/getting-started/intro)) and then slowly add them as you need them. Similarly you can add Nx to an existing workspace (say a Yarn workspace) by using the [add-nx-to-monorepo](https://www.npmjs.com/package/add-nx-to-monorepo) package.

From my own experience, what usually happens is that teams start light and then over time end up with a similar stack, but hand-woven and therefore loosing out on a lot of the benefits Nx comes with.

## Q: Isn’t Nx just for monorepos?

Nx has been designed to support monorepo scenarios, and it really shines at scale. However, a lot of the features I’ve been mentioning in this article, such as generators, out of the box setup of best practices development tools, automated migrations and more make it an excellent choice, even if your intention is not to create a monorepo.

From my experience, I’ve often seen teams start with a single application, which then over time gets company by other apps, in the form of React applications, also Node based backends or even a React Native application. Mainly because adding new applications is easy and the possibility to [share functionality (even across platforms)](/blog/share-code-between-react-web-react-native-mobile-with-nx) is appealing.

> _If you’re interested in monorepos or want to learn more about it, check out_ [_https://monorepo.tools_](https://monorepo.tools/)_._

## Q: Isn’t Nx just for Angular projects?

This is a common but understandable misconception. Although Nx was heavily inspired by the Angular CLI initially, it is now a completely independent build system and CLI with first-class support for Angular, React, Node, Next.js, TypeScript and more. And with tons of [community plugins](/community) that extend Nx beyond that.

## Conclusion

Congrats, you made it to the end of this article. By now you should have gotten a pretty good overview of what Nx is about, its strengths and how it can be useful in your next React project. If you still got questions or are hesitant to adopt Nx, [reach out to me on Twitter](https://twitter.com/juristr)!

Where to go from here?

- [Nx Official Discord Server](https://go.nx.dev/community)
- [follow me on Twitter](https://twitter.com/juristr)
- [follow Nx on Twitter](https://twitter.com/nxdevtools)
- subscribe on the [Nx Youtube channel](https://youtube.com/c/Nrwl_io)
- join more than 200+ developers and [take the free Egghead course](https://egghead.io/courses/scale-react-development-with-nx-4038) on how to scale React development with Nx.
