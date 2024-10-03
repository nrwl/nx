---
title: 'Evergreen Tooling — More than Just CodeMods'
slug: 'evergreen-tooling-more-than-just-codemods'
authors: ['Juri Strumpflohner']
cover_image: '/blog/images/2023-07-26/1*CPiI60mSguYXJzPfAHMbEQ.png'
tags: [nx]
---

As developers we always want to use the latest shiny tools. There’s a new bundler? Let’s try! A new code editor, I’m in! For your side-project: for sure! At work: nah, not really. Keeping your tooling up to date with the rather fast moving JS ecosystem can be a major challenge. Nx provides a mechanism that can help mitigate that, by providing a command to upgrade your tooling automatically:

```shell
npx nx migrate latest
```

**Prefer a video? I’ve got you covered!**

{% youtube src="https://www.youtube.com/watch?v=Ss6MfcXi0jE" /%}

## TL;DR

You can run the following command to automatically upgrade your Nx workspace to the latest version:

```shell
npx nx migrate latest
```

## The Balancing Act: Updating Tooling vs Shipping Features

If you’re anything like me, you’ve probably found that discussions about updating tooling tend to fall to the bottom of the priority list when talking to your product owner. It’s understandable — their primary goal is to ship features. However, sticking with outdated tooling can impact our ability to deliver these features swiftly (not to speak about potential security concerns due to outdated libraries).

Don’t get me wrong, I’m not suggesting that we should always be on the bleeding edge of technological innovation — especially in an enterprise environment.

> _Jason Lengstorf has some opinions there as well:_ [_“The Hidden Danger of Switching Tech Stacks in 2023_](https://youtu.be/u0j-DlsimZ4)_?)._

It’s wise to let security patches land and initial bugs get fixed before jumping on the upgrade bandwagon. But here’s the catch — don’t wait too long. The **longer you delay upgrading, the more challenging and time-consuming** it becomes. And the more effort it requires, the harder it is to sell the idea to your product owner.

## The Key: Making Updates Easy(ier)!

Updating tooling is never easy, but the Nx team aims at making it “easier” at least. We try to embrace the concept of “evergreen tooling”, a strategy that’s been around since Google decided to automatically update Chrome for all users. The Angular team adopted this approach for their Angular CLI, and Nx has followed suit. But what exactly is it, and how does it work?

> _What if I told you Nx users have been_ **_automatically_** _updating their React applications from Webpack 4 to Webpack 5!_

The “why” is pretty straightforward. From the perspective of an open-source project, you want users to adopt the latest version as quickly as possible. This minimizes the maintenance work involved in supporting older versions, which can be a real headache. Looking at how Nx manages it, it seems to be successful in this regard ([Source](https://www.craigory.dev/npm-burst/?package=nx)):

![](/blog/images/2023-07-26/0*M7X1nddld2oBJ736.avif)

The distribution of Nx installs by version demonstrates the effectiveness of this approach. For instance, v16.5, which accounts for 19.7% of all versions, has already been adopted by many users, despite [its recent release](/changelog). The latest major accounts for 34.7% already and 41.4% are on the previous v15, a large majority of which is on the latest 15.9 minor. Hence, v16 & v15 make up 3/4 of all Nx installs.

## How? Database Migration Scripts for Code?

If you know what “database migration scripts” are, then yes, it’s the same concept but applied at the code level. A series of small functions invoked to bring your workspace from version X to version Y (usually the latest). That includes:

- update `nx` itself
- update all Nx plugins and the technology they are responsible for (for example: `@nx/react` will upgrade React as well, `@nx/webpack` is upgrading Webpack)
- automatically adjust relevant config files and source code (e.g., adjusting imports, functions etc..)

Everything that is required to get you to the latest version and still have a running code, even if there have been breaking changes.

**How?!** Because the **Nx team (and plugin authors) do the work for you**! Nx has a built-in mechanism where you can define so-called “migrations” for each Nx package. Here’s an excerpt of the `@nx/webpack`'s migration file.

```json
{
  “generators”: {
    "add-babel-inputs": {
      “cli”: “nx”,
      “version”: “15.0.0-beta.0”,
      “description”: “Adds babel.config.json to the hash of all tasks”,
      "factory": "./src/migrations/update-15-0-0/add-babel-inputs"
    },
    "remove-es2015-polyfills-option": {
      “cli”: “nx”,
      “version”: “15.4.5-beta.0”,
      “description”: “Removes es2015Polyfills option since legacy browsers are no longer supported.”,
      "factory": "./src/migrations/update-15-4-5/remove-es2015-polyfills-option"
    },
    "webpack-config-setup": {
      “cli”: “nx”,
      “version”: “15.6.3-beta.0”,
      “description”: “Creates or updates webpack.config.js file with the new options for webpack.”,
      "factory": "./src/migrations/update-15-6-3/webpack-config-setup"
    },
    "add-babelUpwardRootMode-flag": {
      “cli”: “nx”,
      “version”: “15.7.2-beta.0”,
      “description”: “Add the babelUpwardRootMode option to the build executor options.”,
      "factory": "./src/migrations/update-15-7-2/add-babelUpwardRootMode-flag"
    },
    "update-16-0-0-add-nx-packages": {
      “cli”: “nx”,
      “version”: “16.0.0-beta.1”,
      "description": "Replace @nrwl/webpack with @nx/webpack",
      "implementation": "./src/migrations/update-16-0-0-add-nx-packages/update-16-0-0-add-nx-packages"
    }
  },
  ...
}
```

They are defined in a `migrations.json` config file within the NPM package. Each entry defines a `version` for which the entry should be run, a `description` (just for humans to read) and a `factory` property which points to a TypeScript file.

Example: if you’re on Nx 15.5 and you run `nx migrate latest` it would run the corresponding “factory functions” for:

- `webpack-config-setup`
- `add-babelUpwardRootMode-flag`
- `update-16-0-0-add-nx-packages`

Depending on the nature of the update, these functions can be as simple as performing text replacements to more complex AST parsing and TypeScript source file manipulations. Let’s have a look at the `add-babelUpwardRootMode-flag` migration:

```
import {
  formatFiles,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { WebpackExecutorOptions } from '../../executors/webpack/schema';

export default async function (tree: Tree) {
  forEachExecutorOptions<WebpackExecutorOptions>(
    tree,
    ‘@nrwl/webpack:webpack’,
    (
      options: WebpackExecutorOptions,
      projectName,
      targetName,
      _configurationName
    ) => {
      if (options.babelUpwardRootMode !== undefined) {
        return;
      }

      typconst projectConfiguration = readProjectConfiguration(tree, projectName);
      projectConfiguration.targets[targetName].options.babelUpwardRootMode =
        true;
      updateProjectConfiguration(tree, projectName, projectConfiguration);
    }
  );

  await formatFiles(tree);
}
```

It leverages the utility functions provided by the `@nx/devkit` package to read the various `projects.json` files to adjust the `babelupwardRootMode` property.

Nx’s modular design helps as each plugin is responsible for a particular area and can thus contribute according migration scripts. To give you some context. There is the [nx package](https://www.npmjs.com/package/nx) at the core — which you can use nicely in combination with a [PNPM workspaces repo](/blog/setup-a-monorepo-with-pnpm-workspaces-and-speed-it-up-with-nx) to speed things up — and then there are plugins built on top.

![](/blog/images/2023-07-26/0*LNYWLmdgxQ07bqyt.avif)

_(Source:_ [_/getting-started/why-nx_](/getting-started/why-nx)_)_

These plugins are usually technology-specific, like a plugin to help you manage React, Next, Remix, or Angular projects and tooling like ESLint, Cypress, Playwright, Vite, Jest, and so on. There are no limits as you can [create your own](/extending-nx/intro/getting-started). They are **optional**, in that you can use Nx and React and set everything up on your own. But it might be worth relying on them for some better DX and automation, such as the update mechanism we’re currently looking at.

Plugins are helpful here, because each plugin has a clearly defined responsibility. Like the `@nx/webpack` we looked at earlier, handles everything related to Webpack. So it’ll be responsible for updating the `webpack` NPM package and adjusting config Webpack-related files.

## Performing the Update

Alright, we’ve learned how these updates work behind the scenes. Let’s look at what the experience looks like as a developer performing the update on your codebase.

> _Note, it is highly recommended to start with a clean Git workspace s.t. you can quickly revert the update._

To run the update, use the following command:

```shell
npx nx migrate latest
```

Note `latest` stands for the target version. You can also provide a specific Nx version if you cannot update to the latest one for some reason.

At this point, Nx

- analyzes your workspace and finds all the plugins you’re using
- downloads the version of the plugins specified in the migrate command above
- collects all the `migration.json` files from these plugins
- picks out the relevant ones based on your current workspace version
- creates a `migrations.json` at the root of your workspace
- updates the `package.json` to point to the matching NPM package versions (without performing an install just yet)

You can now inspect the `migration.json` and the `package.json` before you run the following command to run the migrations on your codebase.

```shell
npx nx migrate —-run-migrations
```

After that, your codebase should have been updated. Run your (ideally automated) sanity checks and fix the remaining issues that couldn’t be adjusted automatically.

## Wrapping Up

That’s it! If you want to dive deeper, here are some potentially helpful links:

- [Watch our YT video about Code Migrations](https://youtu.be/Ss6MfcXi0jE)
- [/features/automate-updating-dependencies](/features/automate-updating-dependencies)

Also, if you haven’t already, give us a ⭐️ on Github: [https://github.com/nrwl/nx](https://github.com/nrwl/nx). We’d appreciate it 😃.

## Learn more

- 🧠 [Nx Docs](/getting-started/intro)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- 🚀 [Speed up your CI](/nx-cloud)
