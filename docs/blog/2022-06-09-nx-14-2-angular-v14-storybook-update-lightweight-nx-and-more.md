---
title: 'Nx 14.2 — Angular v14, Storybook update, lightweight Nx and more!'
slug: 'nx-14-2-angular-v14-storybook-update-lightweight-nx-and-more'
authors: ['Juri Strumpflohner']
cover_image: '/blog/images/2022-06-09/uScdSDGP4NgCKFrPdznbhw.avif'
tags: [nx, release]
description: Nx 14.2 brings Angular v14 support, Storybook 6.5, improved Angular CLI migrations, optional nx.json configuration, and significant performance gains.
---

Another release packed with cool features and improvements just got released: [Nx 14.2](https://github.com/nrwl/nx/releases/tag/14.2.2). Read all about the Angular v14 upgrade that comes with it, TypeScript and other 3rd party package upgrades, improved Angular CLI to Nx migrations, optional `nx.json` and speed improvements.

## Angular v14

Angular v14 just got released last week. Read all about [the news here](https://blog.angular.io/angular-v14-is-now-available-391a6db736af). Huge kudos and congrats to the Angular team for again shipping on time based on their 6 months major release cycle. We've been collaborating with the team closely over the last couple of weeks to test early RCs, give feedback about upcoming features and foremost, make sure the new version not only works great in Nx, but also in the broader ecosystem that Nx supports such as Jest, ESLint, Storybook, Cypress and more.

We're excited about the new features that landed in Angular v14 which bring some fresh air and long-awaited innovations to the framework (\* cough \* Standalone Components, \* cough \* typed Angular forms).

As such, if you upgrade to Nx 14.2 (`npx nx migrate latest`), Nx will make sure to also trigger all the Angular v14 related migration scripts to update your workspace to the latest Angular version.

## TypeScript 4.7 and Prettier 2.6

With this release we also automatically update:

- TypeScript to version v4.7 ([announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-4-7/))
- Prettier to v2.6 ([announcement](https://prettier.io/blog/2022/03/16/2.6.0.html))

## Storybook 6.5

Nx 14.2 upgrades Storybook to the latest 6.5 version automatically for you.

Storybook support has been in Nx for a long time and we had our custom executor (builder) to preconfigure Storybook in a way that it works best within an Angular monorepo setup. We're glad that the Storybook support for Angular improved a lot over the last couple of releases s.t. we can **now directly use the Storybook native builders for Angular** (`@storybook/angular:start-storybook`, `@storybook/angular:build-storybook`). In your `project.json` (or `workspace.json` / `angular.json`) you should see the executor now being set to:

```json
"storybook": {
  "executor": "@storybook/angular:start-storybook",
  ...
},
```

This avoids any potential downsides of options being different or not available and lowers the maintenance burden on our side going forward.

Storybook 6.5 also comes with support for using TS based Storybook configurations files, such as `main.ts` , `preview.ts` etc. We added support for that to our Storybook configuration generators.

For all the other cool Storybook features, please refer to their release [announcement](https://storybook.js.org/releases/6.5).

## Easy migration from Angular CLI to Nx

Nx is not only for large monorepos, but works really well for single-project Angular workspaces too! Why switch to Nx? We need an entire blog post for that (spoiler: coming soon 😉), but in a nutshell:

- everything from the Angular CLI still works
- you get faster builds, test runs, linting etc powered by Nx's task scheduling and caching
- more schematics (we call them generators in Nx) with specific support for SCAM, NgRX setup, module federation and micro frontend setup and much more to come (looking at you Standalone Components)
- better, out of the box integration with community tools such as Jest for unit testing, ESLint, Cypress, Storybook,…
- improved developer experience powered by the [Nx Console VSCode extension](/getting-started/editor-setup)
- …

In the last couple of weeks we've been working hard on making an automated migration from the Angular CLI to Nx as seamless as it can possibly get. And this can be tricky, believe us. We always had automated migrations, but we improved our existing ones and in addition also added support for multi-project Angular CLI workspaces.

All you need to do is to run the following command on your existing Angular CLI setup.

```
ng add @nrwl/angular
```

We try to infer your current setup and configuration and automatically migrate it, in addition to providing useful warnings and logs for the things we couldn't migrate along the way, such that you have the possibility to manually adjust things.

## More lightweight Nx

When you setup a new Nx workspace you can choose from a variety of presets (templates) that preconfigure your workspace in the best possible way, already setting up tool like Prettier, Jest, ESLint and Cypress. For some folks however, this might seem too much.

For that, Nx always already had the — what we call — "Nx Core" setup. You can read more about [that on our guide](/getting-started/intro), but it basically allows Nx to be used without its plugins, just for the fast, powerful task scheduling and caching capabilities.

In v14 we already simplified Nx (we have a whole section in [our release blog post](/blog/nx-v14-is-out-here-is-all-you-need-to-know)) and in v14.2 we even go a step further: **we made `nx.json` optional**, providing some reasonable defaults. Now, if you want to add Nx's powerful task scheduler to an existing repository, all you need to do is to add the `nx` package as a dependency and you're all set up.

Whenever you need to fine-tune the default settings you can run the following command to get a `nx.json` generated or you can obviously create it by hand:

```shell
npx nx init
```

## Run Nx graph on any monorepo!

Speaking about lightweight Nx. With Nx v14.2.3 you can now just run

```shell
npx nx graph
```

to download the Nx package, have it analyze your monorepo's project graph and visualize it in its powerful project graph UI. Give it a try. Here's Victor demoing it on the Next.js and Babel.js repository!

{% tweet url="https://twitter.com/victorsavkin/status/1534909897976041474" /%}

## Nx just got faster, again!

Part of our team has been heads-down on Lerna in the past month since we [took over stewardship of Lerna](/blog/lerna-is-dead-long-live-lerna). And apart from releasing Lerna 5 with important package upgrades, we wanted to solve Lerna's biggest pain point: being slow. [We published an article](/blog/lerna-used-to-walk-now-it-can-fly) on how we envision that strategy 2 weeks ago and as part of that we've been digging deep into the Nx core and have been doing some proper profiling.

The result: Nx itself got faster as well 😃.

Here's the result of running our benchmark using the latest version of Nx 14.2:

```plaintext
* average lage time is: 10203.6
* average turbo time is: 1532.3
* average lerna (powered by nx) time is: 272.2
* average nx time is: 194.8
* nx is 52.379876796714576x faster than lage
* nx is 7.866016427104722x faster than turbo
* nx is 1.3973305954825461x faster than lerna (powered by nx)
```

(as always, feel free to [reproduce it here](https://github.com/vsavkin/large-monorepo))

## Dedicated Linting support for Nx Plugins

Only the possibility of being able to tailor and customize the processes and behavior of your monorepo tooling to your own needs, makes working with it pleasant and allows you to get most out of it. Whether it is to customize the code generation aspect to your company coding styleguide and best practices, to automate the setup of new projects or even add support for languages such as Go, .Net or Flutter. [Nx Plugins](/community) enable such support and really help you make Nx work in the best possible way for your current scenario.

Nx plugin support has been around for a while. Just have a look at our [Nx community plugins page](/community). And we keep improving it. We added support for [Nx Plugin presets](https://www.youtube.com/watch?v=yGUrF0-uqaU) and [lately also the ability for local plugins](/blog/nx-v14-is-out-here-is-all-you-need-to-know). In this release, we add proper **linting support for Nx Plugin development**.

Ever happened to you that you mistyped the implementation file in your `generators.json` configuration file of your plugin? Well guess what, now the linting process would warn you about:

![](/blog/images/2022-06-09/mbcZT24F7G8mbRGEnJ7iEg.avif)

When you generate a new Nx plugin, you should now have a `@nrwl/nx/nx-plugin-checks` configuration in your `.eslintrc.json` file.

```json
{
  "files": ["./package.json", "./generators.json", "./executors.json"],
  "parser": "jsonc-eslint-parser",
  "rules": {
    "@nrwl/nx/nx-plugin-checks": "error"
  }
}
```

If you have an existing plugin, you can run the following generator to add the new lint rules:

```shell
npx nx g @nrwl/nx-plugin:plugin-lint-checks --projectName=awesomeplugin
```

## How to Update Nx

Updating Nx is done with the following command, and will update your Nx workspace dependencies and code to the latest version:

```shell
npx nx migrate latest
```

After updating your dependencies, run any necessary migrations.

```shell
npx nx migrate --run-migrations
```

## Exciting?

We're already deep into following our v15 [roadmap](https://github.com/nrwl/nx/discussions/9716) with a lot of cool stuff coming up on the horizon.

Makes sure you don't miss anything by

- Following us [on Twitter](https://twitter.com/NxDevTools), and
- Subscribe to the [YouTube Channel](https://youtube.com/nrwl_io?sub_confirmation=1) for more information on [Angular](https://angular.io/), [React](https://reactjs.org/), Nx, and more!
- Subscribing to [our newsletter](https://go.nx.dev/nx-newsletter)!
