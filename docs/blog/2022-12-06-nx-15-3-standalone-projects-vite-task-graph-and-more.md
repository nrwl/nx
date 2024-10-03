---
title: 'Nx 15.3 — Standalone Projects, Vite, Task Graph and more!'
slug: 'nx-15-3-standalone-projects-vite-task-graph-and-more'
authors: ['Juri Strumpflohner']
cover_image: '/blog/images/2022-12-06/1*VXYjjWhOUpNuHFGCoF63OQ.png'
tags: [nx, release]
---

What a massive release! Here are all the news 👇

**Table of Contents**

· [Funding — Nx raises $8.6M](#funding-nx-raises-86m)  
· [3 million downloads per week](#3-million-downloads-per-week)  
· [New Task Graph Visualization](#new-task-graph-visualization)  
· [Standalone Projects](#standalone-projects)  
· [Integrated Vite and Vitest support is here!](#integrated-vite-and-vitest-support-is-here)  
· [Adopting Nx has never been easier](#adopting-nx-has-never-been-easier)  
· [Adding Nx to an Existing Standalone Project](#adding-nx-to-an-existing-standalone-project)  
· [Root-level Scripts](#rootlevel-scripts)  
· [Simplified Nx run-commands](#simplified-nx-runcommands)  
· [Coming up](#coming-up)  
· [How to Update Nx](#how-to-update-nx)

Prefer **a video version?**

{% youtube src="https://www.youtube.com/watch?v=KBFQZw5ynFs" /%}

## Funding — Nx raises $8.6M

In case you missed it, we raised $8.6 million a couple of weeks ago. Here’s the official blog post from our CEO Jeff: [/blog/from-bootstrapped-to-venture-backed](/blog/from-bootstrapped-to-venture-backed)

It is exciting for us as we can now have more employees focused on pushing Nx and Nx Cloud forward, which will significantly boost development speed!  
For most of our workforce, working on Nx and Nx Cloud was only part of their “20% project”. Yet we released terrific features over the last years and have seen tremendous growth with Nx (which brings us to the next section)

## 3 million downloads per week

2022 has been a particularly crazy but successful year for us. And Nx’s growth confirms that we’re on the right track:

- January: Nx crosses 1 million downloads per week
- June: Nx crosses 2 million downloads per week
- November: Nx crosses 3 million downloads per week

On to 4 million!

![](/blog/images/2022-12-06/0*TxO8bDuJW6pJZ-zy.avif)

## New Task Graph Visualization

{% youtube src="https://www.youtube.com/watch?v=wOE3r4299fs" /%}

One of our most loved features also just got more powerful: the Nx graph!

Nx already visualizes your project graph, mapping the dependencies different projects have on one another through imports and exports in your code. But your tasks also have a graph. Your task can either depend on another target on the same project, let’s say you have a `prebuild`  
and a `build` target. Whenever you run `build`, you want to run `prebuild` first. Similarly, if your project depends on other projects, you might want to make sure to build them first as well. This is called a [task pipeline](/concepts/task-pipeline-configuration) and can be defined in `nx.json` as follows:

```json5 {% fileName="nx.json" %}
{
    ...
    "targetDefaults": {
      "build": {
        "dependsOn": ["prebuild", "^build"]
      }
    }
}
```

This example is pretty straightforward, but such pipelines can become much more involved.

Therefore, let me introduce you the **task graph**. You might already be used to seeing the project graph after running the `nx graph` command. But there's now a dropdown in the corner that enables you to switch to the task graph. Select a target from the "Target Name dropdown" to filter the list of projects to only those with that target. Click on a project to show that target's task graph.

You can add another project as well, showing what the task graph looks like for a command that runs tasks for multiple projects like `nx run-many` or `nx affected`. Click on the `Group by project` checkbox to group related tasks by their project, and click on a task to see what executor it uses.

![](/blog/images/2022-12-06/0*NZWdLWLIxwzwcfmp.avif)

## Standalone Projects

{% youtube src="https://www.youtube.com/watch?v=qEaVzh-oBBc" /%}

Nx is widely known as [THE developer tool](https://monorepo.tools/) people look at when it comes to implementing monorepos in the frontend space. However, a lot of the unique features that Nx ships (in particular when it comes to implementing [Integrated Monorepos](/deprecated/integrated-vs-package-based)) can be beneficial even outside of the typical monorepo scenario. In particular, Nx plugin features such as code generation, pre-configured build tooling setup, and battle-tested integration with best practices tools (e.g. Cypress, Jest, ESLint, Vite, …).

But one stands out most prominently: the **ability to easily modularize** your codebase.

![](/blog/images/2022-12-06/0*wBnyRIMm8_K6K9k3.avif)

A lot of our users adopt Nx for precisely this reason. They have a large app and want to break it into smaller pieces while still having the comfort of deploying it as a single one.

In 15.3 we are therefore making **standalone projects** a first-class feature. Suppose you now create a new workspace with `npx create-nx-workspace` alongside the usual monorepo options. In that case, you will now see two more options for scaffolding a standalone React or Angular application (we will add more in the future).

![](/blog/images/2022-12-06/0*z3UOtkyCIKcL2LNg.avif)

In a standalone project setup, you don’t have the typical `apps` and `libs` structure you might be accustomed to if you have been using Nx in the past. Instead, the app lives directly at the root of your workspace. The structure looks similar to the following:

```text
e2e/
  src/
  cypress.config.ts
  project.json
  ...
src/
  app/
  main.tsx
  ...
public/
index.html
project.json
tsconfig.spec.json
tsconfig.app.json
tsconfig.json
vite.config.ts
nx.json
package.json
```

The critical part here is that you can still have multiple nodes. Even in this example, we have the app itself at the root of the workspace and a nested `e2e` project for that application (using Cypress).

To modularize your application, you can add libraries as you would do in a more traditional integrated Nx monorepo setup, but you can now have those alongside your application. Either create them directly at the root-level or group them in one or more root-level folders. In the example below, I have a `features` as well as `utils` folder, both of which can host multiple libraries.

```text
e2e/
  ...
src/
  app/
  main.tsx
  ...
features/
  feature1/
  feature2/
utils/
  ...
index.html
...
nx.json
package.json
```

It is really up to you how you want to structure them.

Think of it as a supercharged development tool, providing powerful generators, features like [module boundary rules](/blog/mastering-the-project-boundaries-in-nx) and obviously the ability to run tests, linting, building on individual libraries. Not to forget about Nx’s powerful caching ability. And if you’re ready for a “real” monorepo because you want to add multiple applications, there will be paths for you to “upgrade” to that structure.

## Integrated Vite and Vitest support is here!

Finally! We talked about it; now it is here! Official Vite and Vitest support for Nx-based integrated monorepos and standalone app projects! That adds the Vite community into the Nx family, and we’ve been chatting with core members there recently, and we love it!

So before we dive into this: if you are using a package-based monorepo with Nx, you could already use Vite or whatever other technology you want. Nx does just the task scheduling there, running your `package.json` scripts efficiently. Whatever those scripts do "internally" is up to you.

But if you power an integrated setup, you’d want more support via a dedicated Nx plugin. And there has already been a [Nx community plugin](/community) created by the folks from [https://nxext.dev/](https://nxext.dev/). Given the high demand for Vite support, we (the Nx core team) started to look into creating and maintaining our own. We reached out to the out [Dominik Piper](https://mobile.twitter.com/dominik_pieper) and [Jordan Hall](https://mobile.twitter.com/JordanHall_dev) from the NxExt team and they were on board from the beginning! We got lots of helpful input, while designing the new Vite plugin. Huge shoutout to them!!

`@nrwl/vite` (just like `@nrwl/webpack`) is a package that can be integrated as part of other packages. Right now, we're prioritizing our React setup. If you generate a new Nx workspace and choose the new "Standalone React app" version, you will get a React application powered by Vite and Vitest.

Similarly, you can add a new Vite-powered React app to an existing Nx workspace using the `vite` bundler option:

```shell
npx nx generate @nrwl/react:application --bundler=vite
```

This new setup gives you an easy jumpstart as it does all the configuration for you:

- React with Vite
- Tests with Vitest
- Making sure it nicely works with TypeScript (both in src and spec files)

Open the application’s `project.json` to inspect the setup:

```json
{
  "name": "viteapp",
  ...
  "projectType": "application",
  "targets": {
    "build": {
      "executor": "@nrwl/vite:build",
      ...
    },
    "serve": {
      "executor": "@nrwl/vite:dev-server",
      "defaultConfiguration": "development",
      ...
    },
    "test": {
      "executor": "@nrwl/vite:test",
      "outputs": ["{projectRoot}/coverage"],
      "options": {
        "passWithNoTests": true
      }
    },
    ...
  }
}
```

Furthermore, there’s a `vite.config.ts` at the project root level, which you can further customize to your needs. It is already pre-configured to seamlessly work in a monorepo scenario and has the Vitest setup. Just run `npx nx serve` or `npx nx build` or `npx nx test` to serve, build or test your standalone React app.

If you are currently using the NxExt based Vite plugin, or even a Webpack based Nx React setup, you can easily transition to the new Vite plugin by just running the following generator:

```shell
npx nx g @nrwl/vite:configuration
```

This will adjust the NxExt Vite plugin configuration to match the one provided by our core team. Check out our docs for more info: [/nx-api/vite/generators/configuration](/nx-api/vite/generators/configuration)

You can also find all the details about the new Vite package on our docs: [/nx-api/vite](/nx-api/vite)

## Adopting Nx has never been easier

Many developers don’t necessarily start with a greenfield project, but rather have an existing reality where they want to use Nx. We’ve been improving this process of adopting Nx over this year to the point where it has never been easier than now!

Regardless of whether you have

- an existing package-based monorepo setup using NPM/Yarn or PNPM workspaces
- an existing Lerna workspace (for this you probably want to consult the [Lerna docs](https://lerna.js.org/upgrade) for some awesome feature updates)
- a Create-React-App (CRA) application
- a Angular CLI standalone application
- or really any other form of project

You can just run

```shell
npx nx@latest init
```

Running this command will install the `nx` package, and then analyze your existing project structure and correctly identify whether it is a monorepo workspace or some standalone project, whether it's a CRA app or whether you're coming from the Angular CLI. Based on that, you'll get a couple of questions asked and then your workspace gets configured to run it with Nx.

Check out our docs for all the details on

- [adding Nx to an existing monorepo](/recipes/adopting-nx/adding-to-monorepo)
- [adding Nx to any non-monorepo setup](/recipes/adopting-nx/adding-to-existing-project)
- [migrating your CRA project to Nx](/recipes/adopting-nx/adding-to-existing-project)
- [migrating your Angular CLI app to Nx](/recipes/angular/migration/angular)

Oh..you’re wondering why you would want to add Nx to an existing non-monorepo project? Then keep reading 👇

## Adding Nx to an Existing Standalone Project

{% youtube src="https://www.youtube.com/watch?v=VmGCZ77ao_I" /%}

Adding Nx to a single application? Why would that be useful? Well, most apps have multilple scripts in their `package.json`, which includes building, testing, linting your app and potentially much more. Nx can cache these! Obviously it is just app-level caching (since you didn't modularize it with libraries), but imagine your CI setup running these:

```shell
npx nx build
npx nx test
npx nx lint
npx nx e2e
```

If your change just modified a couple of “spec files”, then there’s no point on running `build` or `e2e` again, but just `test` and potentially `lint`. Nx can restore the results of the other operations from the cache.

To add Nx to an existing standalone project, all you need to run is

```shell
npx nx@latest init
```

This process will ask you a few questions about which operations are cacheable. We optimized it so that you don’t necessarily have to use `nx` to run your build, linting or serving your app. You can keep using `npm run build` or `npm start`. This is because Nx wraps your scripts in the `package.json`. Notice how `build` and `lint` are wrapped because they are cacheable operations.

```json
{
  ...
  "scripts": {
    "build": "nx exec -- vite build",
    "lint": "nx exec -- eslint \"src/**/*.ts*\"",
    ...
    "dev": "vite",
    "start": "vite --open",
  },
  "devDependencies": {
    ...
    "nx": "15.3.0"
  }
}
```

Read more on our docs: [/recipes/adopting-nx/adding-to-existing-project](/recipes/adopting-nx/adding-to-existing-project)

## Root-level Scripts

{% youtube src="https://www.youtube.com/watch?v=PRURABLaS8s" /%}

Most of the tasks in a workspace run against a specific project, like building or testing it. That’s why they live in the corresponding `package.json` or `project.json`. But sometimes you have workspace-wide commands which you want to run through the "Nx pipeline" to get the benefits of caching.

Assume you already have a script called `docs` in your root-level `package.json`.

```json5
// package.json
{
  name: 'myorg',
  scripts: {
    docs: 'node ./generateDocsSite.js',
  },
}
```

To allow it to be cached and to be run with Nx, all you need to do is add the follow `nx` property to your `package.json`:

```json5
// package.json
{
  "name": "myorg",
  "scripts": {
    "docs": "node ./generateDocsSite.js"
  }
  "nx": {}
}
```

You can then run it with

```shell
npx nx docs
```

As the next steps you might obviously want to add `docs` to the [cacheable operations](/ci/reference/config) and [fine-tune it's cache inputs](/recipes/running-tasks/configure-inputs).

Read more about it on our docs: [/recipes/running-tasks/root-level-scripts](/recipes/running-tasks/root-level-scripts)

## Simplified Nx run-commands

{% youtube src="https://www.youtube.com/watch?v=iygb-KhAeik" /%}

Nx can automatically detect your scripts in `package.json`. But if you have an integrated setup using Nx plugins, they usually come with a `project.json` . There you have targets like `build`, `test`, `lint` etc.. and they mostly look as follows:

```json5 {% fileName="project.json" %}
{
  "name": "demoapp",
  ...
  "targets": {
    "build": {
      "executor": "@nrwl/vite:build",
      "outputs": ["{options.outputPath}"],
      "defaultConfiguration": "production",
      "options": {
        "outputPath": "dist/demoapp"
      },
      ...
    },
    "serve": {
      "executor": "@nrwl/vite:dev-server",
      ...
    },
    ...
  }
}
```

The task itself is handled by an [Nx executor](/extending-nx/recipes/local-executors) that comes with the plugin, in this case `@nrwl/vite:build` to build a Vite project.

To add a custom command, like invoking a node script, Nx has the so-called [“run-commands”](/recipes/running-tasks/run-commands-executor). So far you had to wrap those commands as follows:

```json5 {% fileName="project.json" %}
{
  "name": "demoapp",
  ...
  "targets": {
    "prebuild": {
      "executor": "nx:run-commands",
      "options": {
        "command": "echo 'hi'"
       }
    },
    "build": {
      ...
    },
    ...
  }
}
```

For simple commands this was a huge overhead, so we simplified it to just this:

```json5 {% fileName="project.json" %}
{
  "name": "demoapp",
  ...
  "targets": {
    "prebuild": {
      "command": "echo 'hi'"
    },
    "build": {
      ...
    },
    ...
  }
}
```

Simple, isn’t it! Obviously the expanded form is still there and also useful for when you need more options, run multiple commands or features such as argument forwarding.

You can read all about it on our docs: [/recipes/running-tasks/run-commands-executor](/recipes/running-tasks/run-commands-executor)

## Coming up

Wow, what a launch! But more features are on the way in the coming weeks that didn’t make it for this release. Super excited about these, which most prominently include

- Workspace watching
- Lock-file pruning
- Nx Cloud integration into Nx Console

Follow us [on our socials](https://twitter.com/nxdevtools) and on [Youtube](https://www.youtube.com/@nxdevtools) to make sure to see it when we announce them!

## How to Update Nx

Updating Nx is done with the following command and will update your Nx workspace dependencies and code to the latest version:

```shell
npx nx migrate latest
```

After updating your dependencies, run any necessary migrations.

```shell
npx nx migrate --run-migrations
```

## Learn more

- 🧠 [Nx Docs](/getting-started/intro)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nrwl Youtube Channel](https://www.youtube.com/@nxdevtools)
