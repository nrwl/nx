---
title: What if Nx Plugins Were More Like VSCode Extensions
slug: 'what-if-nx-plugins-were-more-like-vscode-extensions'
authors: [Juri Strumpflohner]
cover_image: '/blog/images/2024-02-05/featured_img.png'
tags: [nx, releases]
reposts: []
---

Enhance, but don’t interfere! That’s the ideal! And this is how extensions work in VSCode (or Webstorm). You can use VSCode without any extension and get some basic functionality, or you can add an extension on top to enhance your experience and, ideally, increase your productivity.

Table of Contents

- [Adding Nx to an Existing Monorepo](#adding-nx-to-an-existing-monorepo)
- [Project Crystal](#project-crystal)
- [Project Crystal Plugins in an Nx Monorepo](#project-crystal-plugins-in-an-nx-monorepo)
  - [Inferred Targets](#inferred-targets)
  - [Visualizing Inferred Targets](#visualizing-inferred-targets)
- [More Transparency and a Single Source of Truth](#more-transparency-and-a-single-source-of-truth)
- [Enhancing existing Monorepos with Nx Plugins](#enhancing-existing-monorepos-with-nx-plugins)
- [This is just the Beginning](#this-is-just-the-beginning)
- [Learn more](#learn-more)

---

**Prefer a video? We’ve got you covered!**
{% youtube src="https://www.youtube.com/embed/wADNsVItnsM?si=sQ3-Dlx6KBRBUMkE" title="What if Nx Plugins Were More Like VSCode Extensions" /%}

Also, make sure to check out [Launch Nx Conf](/launch-nx) on Thursday, Feb 8th, where we’ll have more in-depth talks about Project Crystal as well as other exciting features around Nx and Nx Cloud.

---

Take, for instance, the Playwright plugin. You install it, and it’ll automatically detect the Playwright config file and enhance your workspace by providing quick run buttons alongside your tests or even a dedicated Test Explorer window.

![](/blog/images/2024-02-05/bodyimg1.webp)
_The Playwright VSCode extension enhancing the developer experience_

## Adding Nx to an Existing Monorepo

You can add Nx to an existing npm/yarn/pnpm monorepo quite straightforwardly. You run:

```shell
npx nx@latest init
```

You’ll get an `nx` package installed and an `nx.json` allowing you to define [task dependencies](/recipes/running-tasks/defining-task-pipeline) and caching. With that, you're now able to run commands like `nx build <your project>` or nx `run-many -t build test` to run all `build` and `test` targets in your workspace in parallel. Nx will read and use your existing `package.json` scripts. I've written an in-depth [blog post about adopting Nx in such a scenario](/blog/setup-a-monorepo-with-pnpm-workspaces-and-speed-it-up-with-nx).

This is the most lightweight setup you can get while still getting some improvements via Nx regarding faster task running and more intelligent parallelization. But, you need to deal with the remaining of the monorepo setup.

## Project Crystal

Nx always had more to offer, though, which it mainly did through its plugins. They’re optional but usually something you’d get set up when creating a new workspace with `create-nx-workspace`. Nx Plugins are extremely powerful, helping you not only create and configure new monorepos, but also taking away the burden of integrating various tooling as well as providing features for enforcing consistency and helping with maintainability. These aspects are fundamental in enterprise settings, where Nx Plugins have proven to help teams successfully manage their monorepos.

However, this is a balancing act. More abstraction and automation means more support but also potentially a learning curve and giving up some low-level control. It also requires a slightly more significant upfront investment when migrating to an Nx plugin-powered monorepo.

**These are things we wanted to solve**, and **Project Crystal** is the first step in that direction.

![](/blog/images/2024-02-05/bodyimg2.webp)

Some of the main objectives of Project Crystal are to...

- make Nx plugins more transparent
- reduce the amount of configuration required
- allow Nx plugins to be drop-in enhancements in existing npm/yarn/pnpm monorepos
- allow for a migration to an Nx plugin-powered monorepo

## Project Crystal Plugins in an Nx Monorepo

> Note: starting with Nx 18, Project Crystal will be active for new workspaces only. You can opt-in to use them though.

When you create a new Nx workspace using

```shell
npx create-nx-workspace myorg
```

... and you choose an “integrated monorepo” you’ll get the usual setup powered by Nx Plugins and all the features and benefits that come with them. Where you’ll see Project Crystal in action is when you open a `project.json` file, which will most likely look like the following:

```json {% fileName="project.json" }
{
  "name": "reactapp",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "apps/reactapp/src",
  "projectType": "application",
  "targets": {},
  "tags": []
}
```

### Inferred Targets

Starting with Nx 18 and Project Crystal, we don’t generate any targets anymore, but the corresponding Nx plugin instead [infers them](/concepts/inferred-tasks). If we open the `nx.json`, you'll see a new property, `plugins`:

```json {% fileName="nx.json" %}
{
  ...
  "plugins": [
    {
      "plugin": "@nx/vite/plugin",
      "options": {
        "buildTargetName": "build",
        "previewTargetName": "preview",
        "testTargetName": "test",
        "serveTargetName": "serve",
        "serveStaticTargetName": "serve-static"
      }
    },
    {
      "plugin": "@nx/eslint/plugin",
      "options": {
        "targetName": "lint"
      }
    },
    {
      "plugin": "@nx/cypress/plugin",
      "options": {
        "targetName": "e2e",
        "componentTestingTargetName": "component-test"
      }
    },
    ...
  ],
  ...
}
```

Notice the options property defining the names of the potentially inferred targets for each plugin. These targets will be generated dynamically s.t. you can still run `nx build reactapp` even though there's no `build` target explicitly defined in the `project.json` of your `apps/reactapp` project.

This dramatically reduces the redundancy of repeatedly configuring the same tasks (e.g., Jest or Vitest tasks) throughout your various projects. Instead, with this new approach, you get the defaults, and if you need to override them, you can still define them in your `project.json` file as you were accustomed to before.

### Visualizing Inferred Targets

Dynamically inferred targets help with the maintainability aspect and reduce the configuration overhead overall. But how do we know which targets are available for a given project?

Option 1 is to run the following command:

```shell
npx nx show project reactapp --web
```

This opens your browser with the following view:

![Browser view reads "reactapp, root: apps/reactapp, type: application" and shows a list of targets.](/blog/images/2024-02-05/bodyimg3.webp)
_Browser view of the inferred targets_

Option 2 is [Nx Console](/getting-started/editor-setup), which is an extension for VSCode as well as IntelliJ (Webstorm etc.). It comes with a project detail view, as shown below, as well as “Codelens” features that enhance your configuration files with context-based information and features.

![](/blog/images/2024-02-05/bodyimg4.webp)
_Nx Console showing the inferred targets in a dedicated view_

## More Transparency and a Single Source of Truth

We also wanted the new approach to plugins to be closer to the actual CLI tool of the framework you’re using. If you have a React + Vite project, `nx build` should be as close as possible to the `vite build` while still providing the enhancements around caching configuration.

And this is what happens. Behind the scenes, the plugin configures caching with inputs and outputs and task dependencies (e.g., `^build`) but then mostly pipes through to the Vite CLI (in this particular case), Remix, Next CLI, etc.

![](/blog/images/2024-02-05/bodyimg5.webp)

Furthermore, the framework-specific config — in the example of Vite, the `vite.config.ts` - is the single source of truth from which Nx infers configuration such as caching. If you change your Vite `build.outDir`, Nx automatically picks that up and uses that as the caching output directory.

## Enhancing existing Monorepos with Nx Plugins

As mentioned earlier, one of the key goals of Project Crystal was to improve the adoption story of Nx Plugins, which implicitly also helps with migrating to Nx plugin-based monorepos. By reducing the config footprint of an Nx plugin and by automatically inferring tasks from existing framework configs, we’ve moved in a direction where plugins have become much more of a drop-in approach.

Starting with Nx 18, if you now run `nx init` on an existing npm/yarn/pnpm workspace, you'll also get asked about installing plugins based on the setup you have in your monorepo.

![](/blog/images/2024-02-05/bodyimg6.webp)
_Asking about installing plugins based on your monorepo tooling_

You can also obviously start with no plugin at all and incrementally add them as you go and feel comfortable using the new `add` command:

```shell
npx nx add @nx/vite
```

## This is just the Beginning

We just released Project Crystal, so this is just the beginning of it. While we’ve moved many of our existing Nx plugins to adopt the new approach, there are still some more refinements to be done in the coming weeks. But we are excited about the possibilities Project Crystal enables for Nx and its adoption story going forward, making Nx plugins more approachable, transparent, and lightweight.

---

## Learn more

- [Nx Docs](/getting-started/intro)
- [Nx GitHub](https://github.com/nrwl/nx)
- [Nx Official Discord Server](https://go.nx.dev/community)
- [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- [Speed up your CI](/nx-cloud)
