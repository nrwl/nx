---
title: 'Nx 15.7 — Node Support, Angular LTS, Lockfile Pruning'
slug: 'nx-15-7-node-support-angular-lts-lockfile-pruning'
authors: ['Juri Strumpflohner']
cover_image: '/blog/images/2023-02-16/1*2AAo-mng7QyJP9yC80zNFQ.png'
tags: [nx, release]
---

Here’s all you need to know about our latest Nx release.

### Table of Contents

· [10k Subscribers on Youtube](#10k-subscribers-on-youtube)  
· [Updates to our Nx Plugin Guides](#updates-to-our-nx-plugin-guides)  
· [Nx meets Node — First-Class Support landed](#nx-meets-node-firstclass-support-landed)  
· [Detaching Angular versions](#detaching-angular-versions)  
· [Bootstrapping a new Angular app with Standalone API support](#bootstrapping-a-new-angular-app-with-standalone-api-support)  
· [Lockfile parsing and pruning](#lockfile-parsing-and-pruning)  
· [Storybook 7.0 beta support](#storybook-70-beta-support)  
· [More flexible Webpack config](#more-flexible-webpack-config)  
· [How to Update Nx](#how-to-update-nx)  
· [Coming up](#coming-up)

### Prefer a video? We’ve got you covered!

{% youtube src="https://www.youtube.com/watch?v=IStJODzZSoc" /%}

## 10k Subscribers on Youtube

It’s almost a tradition to have some stats at the beginning of our Nx release blog posts. This time, about our YT channel: incredibly, we crossed 10k subscribers [on our Youtube channel](https://www.youtube.com/@nxdevtools)!!

![](/blog/images/2023-02-16/0*s8uTPTC3X01sE3u2.avif)

Apart from delivering high-quality engineering work, we’re very invested in producing educational content around developer tooling and monorepos. We’ve been almost consistently shipping new content every week, whether that is blog posts on the [Nx blog](/blog) or in the form of new videos and live streams on our channel. Seeing our audience grow on Youtube confirms we’re on the right track and gives us new fuel to keep pushing!!

If you haven’t subscribed yet, please do 🙏: [https://www.youtube.com/@nxdevtools](https://www.youtube.com/@nxdevtools). We also announce most of our new videos and live streams [on Twitter](https://twitter.com/nxdevtools).

## Updates to our Nx Plugin Guides

Nx has been designed to be extensible from the ground up. Which is precisely why Nx Plugins are so powerful. They don’t just come as part of an Nx integrated monorepo or standalone setup. Still, you can leverage them in the same way to automate your local workspace or even share them as proper Nx plugins with the community.

Please have a look at our updated guide: [/extending-nx/tutorials/organization-specific-plugin](/extending-nx/tutorials/organization-specific-plugin)

## Nx meets Node — First-Class Support landed

{% youtube src="https://youtu.be/K4f-fMuAoRY" /%}

Due to a lack of time we never invested much more into streamlining the Node experience within Nx, though. This [changed now](/blog/from-bootstrapped-to-venture-backed), which is why we’re committed to making Nx the best developer tool for node based apps. Starting with v15.7 we improved support for [ExpressJS](https://expressjs.com/), [Fastify](https://fastify.io/) and [Koa](https://koajs.com/).  
When starting a new Nx workspace, you now have a new option: “Standalone Node Server app”.

![](/blog/images/2023-02-16/0*yTl82iMY0EsbjmBQ.avif)

This is when you want a single-project Nx workspace to build out your Node backend.

All the features Nx is known for also apply to backend development. That includes

- **code generation support** for all the previously mentioned Node frameworks
- avoiding monolithic codebases via **modularizing it with local libraries** (with code generation support)
- Ability to **automatically setup a Dockerfile** for packaging your app
- **Optionally bundle** your Node app for easy deployment in the case of edge-functions
- **Speed** via running building, linting, testing for only **(**[**affected**](/ci/features/affected)**) parts of your applications**, via [caching](/concepts/how-caching-works) and [optimized CI setups](/ci/features/distribute-task-execution)
- the ability to use and/or expand to a monorepo

This is the first iteration with first-class Node support. But we’re already working on a whole set of improvements for the Nx + Node story. So stay tuned!

## Detaching Angular versions

{% youtube src="https://youtu.be/AQV4WFldwlY" /%}

The Angular CLI supports a single version of Angular and requires the user to upgrade them together with the help of automated upgrade mechanisms like `ng update`. On the other hand, Nx operates on a different release cycle and is independent of Angular versions. However, prior technical limitations resulted in each Nx major version only being compatible with a specific Angular major version. This caused challenges for Angular developers and corporations who were either stuck on an older Angular version or unable to upgrade promptly but still wanted access to the latest and greatest Nx features for increased productivity.

Starting with v15.7.0, the `@nrwl/angular` plugin will support both Angular v14 and v15, and our goal is to continue supporting the Angular LTS versions from Angular v14 onwards.

New workspaces will always be created with the latest Angular version, but during migration, you can skip some package updates as defined by Nx plugin authors. For Angular, this means you can skip migrating to newer versions. This feature can be enabled by running the following command in an interactive mode:

```
$ nx migrate latest --interactive
```

When collecting migrations in interactive mode, you’ll be prompted to apply any optional migrations, and any updates you choose to skip won’t be applied. The rest of the updates will be used as usual.

If you need to apply an Angular update that you previously skipped, you can collect migrations from an older version of Nx by running:

```
$ nx migrate latest --from=nx@<version>
```

In particular, we’re working on making that part more intuitive in upcoming versions.

Also, have a look at our [updated docs](/recipes/tips-n-tricks/advanced-update) as well as our [Nx and Angular compatibility matrix](/nx-api/angular/documents/angular-nx-version-matrix) for more details.

## Bootstrapping a new Angular app with Standalone API support

{% youtube src="https://youtu.be/Hi3aJ0Rlkls" /%}

Angular’s new [standalone APIs](https://angular.io/guide/standalone-components) is exciting as it provides a new, more lightweight way of developing and composing Angular applications without the need for `NgModules`. Nx has had the ability to generate new Angular components using the Standalone API for a while. With v15.7, we now also allow you to quickly bootstrap a new single-project Nx workspace with a NgModule-less Angular application.

```shell
npx create-nx-workspace@latest ngapp
  --preset=angular-standalone
  --standaloneApi
```

## Lockfile parsing and pruning

Lockfiles can be highly complex, and different formats across the NPM, Yarn, and PNPM package managers don’t make it easier. Nx used to consider the lock-file a black box. Starting with 15.7, this changes! Nx can now properly process the lock-file of all three major package managers (and their different versions!).

Why is this useful? Glad you asked! Mostly for three reasons:

- more **accurately map the nodes and dependencies** in the Nx graph (yep the graph also includes npm packages used by every single project)
- generate a `package.json` with **precise snapshot of the used versions** (especially useful in a monorepo with single-version policy)
- ability to **generate a pruned lock-file** that can be used along-side the `package.json` when packaging your app in a Docker container

Some of our plugins’ `build` executors include:

- `generatePackageJson` flag (`@nrwl/webpack:webpack` and `@nrwl/node:webpack`) that automatically generates `package.json` and lock file.
- `generateLockfile` flag (`@nrwl/js:swc`, `@nrwl/js:tsc` and `@nrwl/next:build`) that generates lock file

If you’re an Nx plugin developer, you can generate `package.json` and lock file using the following functions from the `@nrwl/devkit` package:

```
import { createPackageJson, createLockFile } from '@nrwl/devkit';

const projectGraph = await createProjectGraphAsync();
const packageJson = createPackageJson(projectName, projectGraph);
const lockFile = createLockFile(packageJson);

// save files using e.g. `fs.writeFileSync`
```

Stay tuned for a more in-depth blog post coming soon to [our blog](blog).

## Storybook 7.0 beta support

Nx provides support for Storybook version 7.0 beta, with generators and executors, so that you can try it out now, either in a new or in your existing Nx workspace. Storybook version 7 is a major release that brings a lot of new features and improvements. You can read more about it in the [Storybook 7 beta announcement blog post](https://storybook.js.org/blog/7-0-beta/). Apart from the new features and enhancements, it also brings some breaking changes. You can read more about them in the [Storybook 7 migration docs](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#from-version-65x-to-700) and the [Storybook 7 migration guide](https://chromatic-ui.notion.site/Storybook-7-migration-guide-dbf41fa347304eb2a5e9c69b34503937). Do note that _version 7 is still in beta_, and so is the Nx support for it.

You can try out Storybook 7.0 beta in a new Nx workspace by passing the `--storybook7betaConfiguration` flag when generating the Storybook configuration for your projects. Read more in our [Storybook 7 setup guide](/nx-api/storybook/documents/storybook-7-setup). If you want to migrate your existing Storybook configuration to Storybook 7.0 beta, please read our [migration guide](/nx-api/storybook/generators/migrate-7).

## More flexible Webpack config

{% youtube src="https://youtu.be/CIT4MFMraXg" /%}

Previously when you created a new React application with the Nx `@nrwl/react` plugin, the actual Webpack config was hidden within the plugin itself.

![](/blog/images/2023-02-16/0*1rWmKSybkBC8I-0O.avif)

It was for a good reason, but at the same time, it is a thin line to walk between giving more flexibility and ensuring integrity and consistency (not to speak about features such as [automated code migrations](/features/automate-updating-dependencies)). We wrote a [blog post about it last week](/blog/configuration-files-and-potholes-in-your-codebase).

Inspired by our new [Vite setup](/nx-api/vite), which allows for a more modular configuration in the `vite.config.ts`, we wanted to bring some of the same flexibility to our Webpack setup as well. As such, now every Nx Webpack setup (e.g. a new React + Webpack based app) have a `webpack.config.js` in the project root. Old project are automatically migrated to this new setup.

![](/blog/images/2023-02-16/0*emRP2gF7umWc4UE-.avif)

If you want to upgrade but still retain the previous behavior, we introduced an `isolatedConfig` mode that can be set to `false`. More details on our docs: [/recipes/webpack/webpack-config-setup](/recipes/webpack/webpack-config-setup)

## How to Update Nx

Updating Nx is done with the following command and will update your Nx workspace dependencies and code to the latest version:

```shell
npx nx migrate latest
```

After updating your dependencies, run any necessary migrations.

```shell
npx nx migrate --run-migrations
```

## Coming up

We are currently working on some exciting stuff, including

- Deno support
- Improvements to Nx Console, including support for IntelliJ
- NestJS
- Rust 👀
- Nx for non-JS environments
- …

So keep an eye on our [Twitter](https://twitter.com/nxdevtools), [Youtube](https://www.youtube.com/@nxdevtools) and [blog](/blog) to not miss those announcements.

## Learn more

- 🧠 [Nx Docs](/getting-started/intro)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nrwl Youtube Channel](https://www.youtube.com/nrwl_io)
- 🥚 [Free Egghead course](https://egghead.io/courses/scale-react-development-with-nx-4038)
