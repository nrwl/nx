---
title: 'Nx v14 is out — Here is all you need to know!'
slug: 'nx-v14-is-out-here-is-all-you-need-to-know'
authors: ['Juri Strumpflohner']
cover_image: '/blog/images/2022-05-02/1*UAN1p_RMt38_IvB3CRpYTA.png'
tags: [nx, release]
---

A lot happened since we released Nx version 13 back in October 2021. Nx has roughly a 6-month major release cycle and so that time has come again: I’m happy to announce the **release of Nx v14**.

Those last 6 months have been incredible and Nx probably got the biggest boost ever in terms of simplicity, features, and speed. We even made Nx more beautiful. Join me to explore some of the biggest highlights and what makes v14 so incredible.

> _Nx is open source, so feel free to browse the_ [_repo_](https://github.com/nrwl/nx) _and_ [_changelog_](https://github.com/nrwl/nx/releases/tag/14.0.0) _by yourself 🙂_

**💡Did you have a chance to watch Nx Conf Lite 2022 last Friday?** Many of the new features have been discussed there, and more. You can watch the [entire stream on Youtube](https://youtu.be/iIZOfV0GFmU). All the single talk videos will be released over the next weeks too, so make sure you subscribe and switch on notifications 🙂: [https://youtube.com/nrwl_io](https://youtube.com/nrwl_io)

## Over 1.6 Million Downloads per week 🎉

We hit a major milestone with Nx v13 when we reached 1 million weekly downloads back in December 2021. Only 3 months later, we’re already over 1.6 million per week and growing fast!

{% tweet url="https://x.com/victorsavkin/status/1504465520640278533" /%}

Nx also outgrew Lerna in February in weekly downloads. Up until that point, [Lerna](https://lerna.js.org/) was considered the go-to choice when it comes to JS-based monorepos. But just recently, they made it [even more evident](https://github.com/lerna/lerna/pull/3092) that Lerna has been and is [largely unmaintained](https://github.com/lerna/lerna/issues/2703).

![](/blog/images/2022-05-02/0*mPx5PywQEPHBayAO.avif)

We saw that coming and made it easy for people to migrate to Nx.

```shell
npx add-nx-to-monorepo
```

There’s a detailed guide helping with some of the doubts and misconceptions which commonly come up with Lerna users: [https://lerna.js.org/](https://lerna.js.org/)

The future for monorepo tools looks bright as the awareness of monorepos, especially in the JS ecosystem, has grown a lot in recent months. Nx is doing great compared to those tools. But this movement excites us and we are more than ever committed to keep pushing forward and making Nx even better.

![](/blog/images/2022-05-02/0*3nUxgDpXZ82yx6r8.avif)

## Nx Console reaches 1 million installs

While we’re talking numbers. We just hit another milestone 🎉

{% tweet url="https://x.com/NxDevTools/status/1518620884570820608" /%}

## Nx Core

We made a lot of improvements in Nx core since v13 that can roughly be categorized into: making Nx faster, simpler and improved dev ergonomics. Let’s explore some of the highlights there

## Making Nx even faster!

Being as fast as possible is a key design principle in Nx. Back in December we [tweeted about our speed benchmarks](https://twitter.com/victorsavkin/status/1471582667212738562?s=20&t=fZQ82vUXMztNXFRMmuYQTw) and we keep running them against our releases to see how we compare.

Turns out the latest Nx v14 release is considerably faster than Nx v13:

- Nx v13: 1.587 seconds
- Nx v14: 0.259 seconds

You can check and run the benchmarks by yourself: [https://github.com/vsavkin/large-monorepo](https://github.com/vsavkin/large-monorepo)

How can Nx be so fast? One thing we did introduce after v13 and [recently enabled by default](/blog/what-is-new-in-nx-13-10) is the **Nx Daemon**. There is a fixed amount of computation that needs to happen in every workspace and which increases as the workspace grows. In order to still keep operations fast, we can now use the Nx Daemon to precompute a lot of the operations in the background. Then whenever some Nx operation is triggered, they can directly benefit from that.

> **_Running into a performance issue?_** _Try to debug it by using_ `_NX_PERF_LOGGING=true_` _in combination with your Nx command:_ `_NX_PERF_LOGGING=true nx build crew_`_. Alternatively, you can also have Nx generate a_ `_profile.json_` _and import it into Chrome Devtools._ [_Read more about that here_](/troubleshooting/performance-profiling)_._

While a lot of the above improvements help with local development, one of the biggest pain points of having a large monorepo can be CI times. This is where **distributed task execution (DTE)** makes all the difference\*_._\* Nx Cloud’s DTE understands which commands your CI is running, how many agents are typically being used, and how long a given task typically takes. It leverages that information along with task dependencies to create an execution plan that prioritizes builds of shared libraries first to unblock upstream builds. This results in a more even utilization of CI agents, optimizing the overall running time of your CI.

![](/blog/images/2022-05-02/0*k4ayjIt_OMEedxn-.avif)

Over time, Nx Cloud’s DTE learns about your workspace, keeping metrics about running times to allow the best possible distribution of a given task with the given amount of agents. This comes with Nx Cloud.

> _Note, if you are a large enterprise, you might want to look into the_ [_Nx Private Cloud_](/enterprise) _offering which allows to self-host Nx Cloud within your own infrastructure._

Also see this example repository with some more information: [https://github.com/vsavkin/interstellar](https://github.com/vsavkin/interstellar)

## Simplifying Nx

Nx follows a modular plugin architecture. There is the core part of Nx which has the main logic around managing the project graph, computation caching, hashing and more. On top of that we have a series of Nx provided plugins for some of the most common frameworks and libraries out there, like [TypeScript/Javascript](/nx-api/js), [Angular](/nx-api/angular), [React](/nx-api/react) & [React Native](/nx-api/react-native), [Next.js](/nx-api/next), [Nest.js](/nx-api/nest), [Node](/nx-api/node) and many more, not to forget about [all the community plugins](/community). We also have a [labs project section](https://github.com/nrwl/nx-labs) which is our incubator for potentially new, natively supported Nx plugins.

This modular structure allows you to just use [Nx core without plugins](/getting-started/intro). An ideal approach if you want to add Nx to an [existing Lerna/Yarn/NPM/PNPM workspace](/recipes/adopting-nx/adding-to-monorepo). With v14 we made it even simpler s.t. now you only have a single `nx` package in your dependencies with the core setup.

From there you can go ahead and add new plugins as you need them, thus gradually enhancing the capabilities of your Nx workspace.

Nx is also able now to directly pick up your `package.json` scripts which are common in NPM/Yarn workspaces. Read more here: [/reference/project-configuration](/reference/project-configuration)

## Terminal Output

Developer experience is highly important to us. And that doesn’t stop at the terminal output which is something we developers constantly interact with throughout our entire workday. We, therefore, put a lot of love for the details into how we present our terminal output, improving it in a way to show all completed tasks towards the top, while information about the current progress is shown below

_(here executed by skipping the cache to show some progress running_ 🙂*)*

![](/blog/images/2022-05-02/0*Sodlw6nDI6l9LgsB.avif)

We now even filter out the build of dependent projects. Say you build the `react` project in your workspace which depends on 11 other projects. Nx needs to first incrementally build those 11 dependent projects, which it does now in a very subtle way by just reporting the overall progress at the top of the terminal output, while the main `react` project build output is printed just as normal.

![](/blog/images/2022-05-02/0*jXaiowGZpPMC6PlJ.avif)

Obviously, all errors would be reported properly, and on CI this behavior is disabled by default. If you want to disable it, you can always set `NX_TASKS_RUNNER_DYNAMIC_OUTPUT` to false.

## “Local Plugins” for your Nx Workspace

[Check out our previous release post](/blog/what-is-new-in-nx-13-10) where we went into some of the details on how local plugins work. But in a nutshell, you can now generate a plugin into an existing Nx workspace:

```shell
npx nx generate @nrwl/nx-plugin:plugin --name=workspace-extensions
```

Now normally you would develop it there, and then publish it to npm s.t. others can install it into their Nx workspaces. Since one of our recent versions of Nx, we now also allow you to directly use them in the same Nx workspace, without the need to pre-compile or publish your plugin.

```json
{
  "root": "apps/demo",
  "sourceRoot": "apps/demo/src",
  "projectType": "application",
  "targets": {
    "mybuild": {
      "executor": "@myorg/workspace-extensions:build",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/apps/someoutput"
      }
    }
  }
}
```

This can be a game changer for automating your Nx workspace.

## Automating CI Setup

Ever struggled with setting up CI? Especially in a large monorepo? We got your back now, with the new `--ci` generator that we introduced in Nx v14.

```shell
npx nx generate @nrwl/workspace:ci-workflow --ci=github
```

Or just use [Nx Console](/getting-started/editor-setup), as always.

![](/blog/images/2022-05-02/0*XFXDdGUWc3dF9ZMC.avif)

This sets you up with an automated CI workflow that properly uses the Nx affected command together with the power of [Nx Cloud’s distributed task execution](/ci/features/distribute-task-execution).

You can also use the `--all` flag when generating a new workspace, for seeing all the available options, including to setup CI.

## nx-cloud record

The [Nx Cloud GitHub app](https://github.com/apps/nx-cloud) is so useful for not having to go to your CircleCI logs and try to find the entry you’re searching for. Instead all the executed targets nicely show up as a comment in your PR.

![](/blog/images/2022-05-02/0*4zTea6s4BTMyDToD.avif)

Once you click them, you get a nicely formatted and structured page within Nx Cloud.

![](/blog/images/2022-05-02/0*WnsKJB1ceufeHGPZ.avif)

Until now, you had to have a task that is being executed through Nx Cloud. But what about those workspace utility scripts, like checking the commit format etc. You can now use `nx-cloud record` for those, like

```shell
npx nx-cloud record -- npx nx format:check
```

and they will automatically show up in the Nx Cloud viewer. 🤫 you don’t even have to have Nx Cloud installed in the workspace.

## Module Federation for Faster Builds

For many workspaces it is enough to leverage [Nx affected commands](/ci/features/affected), [computation caching](/concepts/how-caching-works) and [distributed task execution](/ci/features/distribute-task-execution).

However, if you have a huge monorepo, this might not be enough. You can add incremental builds and benefit from caching, but still, you might run into the issue of the final linking process taking a long time, which can hardly be optimized further. Unless you can split up your app into smaller pieces. No, we’re not talking about micro frontends necessarily (more on that in the next section). Rather we can leverage Webpack’s Module Federation support.

We added dedicated generators to create a new module federation setup for Angular and React:

```shell
# React
nx g @nrwl/react:host shell --remotes=shop,cart,about

#a Angular
nx g @nrwl/angular:host shell --remotes=shop,cart,about
```

By specifying the `implicitDependencies` in Nx ([see docs](/reference/project-configuration)) Nx knows what the relation between the various apps is, even though there are not direct imports

![](/blog/images/2022-05-02/0*1VDr0oYKNn4j4gWm.avif)

Combining this with the power of Nx Cloud distributed caching, you can now serve your shell project

```shell
npx nx serve shell
```

and all the other remotes are statically served from the cache. Your entire infrastructure is working, without you having to worry about building and serving all of the separate remotes. As you can imagine this speeds up local serve times by an order of magnitude.

If you want to work on one of the remotes, simply explicitly pass their name using `--devRemotes` flag and it will be served just normally with the Webpack dev server, with all the features you’re used to.

```shell
npx nx serve shell --devRemotes=cart,shop
```

This can be a game-changer when building huge apps. Stay tuned for more content around this as we’re really just getting started.

We recommend this approach if you want to speed up local serve and build times, but you still deploy the application as a whole.

Read more on our docs: [/concepts/module-federation/faster-builds-with-module-federation](/concepts/module-federation/faster-builds-with-module-federation)

## Micro Frontend Architecture with Nx

As mentioned in the previous section, Nx v14 comes with out-of-the-box for Webpack Module Federation. The Micro Frontend architecture builds on top of that and adds the ability for independent deployability. While Module Federation enables faster builds by vertically slicing your application into smaller ones, the MFE architecture layers _independent deployments_  
on top of federation. Teams should only choose MFEs if they want to deploy their host and remotes on different cadences.

Read more on our docs: [/concepts/module-federation/micro-frontend-architecture](/concepts/module-federation/micro-frontend-architecture)

## Dark mode for Project Graph as well as path tracking

You asked for it, the community responded. [Luís Carvalho](https://github.com/Lcarv20) - a first time contributor - worked together with Nx core team members Philip and Ben to deliver dark mode for the project graph visualization!!

![](/blog/images/2022-05-02/0*TzVbTnDmzgInCw6H.avif)

Also, have you ever wondered whether in your gigantic graph there’s a connection between two nodes?

![](/blog/images/2022-05-02/0*eMk2cAwrdHmaK07h.avif)

Now you can easily find out! Just click on a node and hit the “Start” button.

![](/blog/images/2022-05-02/0*gDnkyfnnAHy2P0Z8.avif)

Then click the target node you’re interested in and hit “End”.

![](/blog/images/2022-05-02/0*BMoc7FuUD94GzOXO.avif)

The project graph now renders the path between those nodes.

![](/blog/images/2022-05-02/0*I2E5CvnLb-C8z95L.avif)

And by clicking on the edges you can even get a more detailed output of why the connection exists in the first place 🤯

![](/blog/images/2022-05-02/0*EnPbSRFUD3KeOH4w.avif)

Oh wait, you didn’t want the shortest path? There’s a button for showing all possible paths too 😉

![](/blog/images/2022-05-02/0*OlhUXFMhEwshLoTV.avif)

## JavaScript & TypeScript library support

In version 13.4 we released a brand new dedicated package for developing pure JavaScript/TypeScript packages: `@nrwl/js`

We kept improving it, adding SWC support (including an easy migration between TSC → SWC using an Nx generator) and we’re currently looking into automated publishing support.

Read all the details on our docs: [/getting-started/intro](/getting-started/intro)

## React

Nx v14 ships with React 18 support for React DOM and React Native. The latter has seen some drastic improvements since Nx v13, adding [guides on how to create a monorepo for React Native](/blog/step-by-step-guide-on-creating-a-monorepo-for-react-native-apps-using-nx) apps with Nx as well as how to [share code between a React Web and React Native app](/blog/share-code-between-react-web-react-native-mobile-with-nx). We also added Storybook support to React Native. Read all about that in [our recent blog post](/blog/use-storybook-with-nx-react-native).

In addition to that, Expo and Expo Application Service support has been added which has lead already to some drastic speed improvements with some of our clients.

Finally, it is the first version which ships the built-in module federation support for React as we’ve mentioned a couple of sections above. Check out the React package docs page and search for the `host` and `remote` generator: [/nx-api/react](/nx-api/react)

## Angular

There have been a lot of highlights for the Nx Angular plugin since v13. Here are some:

- Support and migrations for Angular 13 (Angular v14 coming soon. We will release that as a minor upgrade in Nx once the Angular team releases v14)
- Tailwind CSS support (generators, added support to library executors). Read [our blog detailed post](/blog/set-up-tailwind-css-with-angular-in-an-nx-workspace).
- Single Component Application Modules (SCAM) generators for components, directives and pipes ([see our docs](/nx-api/angular))
- Improved Angular CLI to Nx migration support. We invested quite some time refactoring our current migration support from the Angular CLI which not only will allow us to implement more migration scenarios in the future but it also provides better error messages and hints during the migration process. This also allowed us to add support for multi-project Angular CLI workspaces which can now be seamlessly migrated. Multi-application Angular CLI workspace support will be added soon.

Finally, similar to React also Angular gets built-in support for Webpack Module federation and hence also Microfrontends within Nx. See the sections about Module Federation and Microservices for more info and links to the docs.

## Improved docs

Docs are hard! But we keep investing and a lot of work has gone into making docs more organized and even more interactive.

{% tweet url="https://twitter.com/bencabanes/status/1509641445086535687" /%}

## There’s more

Check out our previous release blog posts for all the details:

- [Single File Monorepo Config, Custom Workspace Presets, Improved Tailwind Support, and more in Nx 13.4!](/blog/single-file-monorepo-config-custom-workspace-presets-improved-tailwind-support-and-more-in-nx-13)
- [New Terminal Output & Performance Improvements in v13.5](/blog/new-terminal-output-performance-improvements-in-nx-13-5)
- [What’s new in Nx v13.10?](/blog/what-is-new-in-nx-13-10)

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

We already started working on v15. You can [find the roadmap on our GitHub repository](https://github.com/nrwl/nx/discussions/9716). There are some exciting things coming up, like

- “Negative” Configuration
- React Server Side Rendering and Server Components support
- React Native + Detox
- Cypress v10 migration and Cypess Component Testing
- ...

Make sure you don’t miss anything by

- Following us [on Twitter](https://twitter.com/NxDevTools), and
- Subscribe to the [YouTube Channel](https://youtube.com/nrwl_io?sub_confirmation=1) for more information on [Angular](https://angular.io/), [React](https://reactjs.org/), Nx, and more!
- Subscribing to [our newsletter](https://go.nx.dev/nx-newsletter)!
