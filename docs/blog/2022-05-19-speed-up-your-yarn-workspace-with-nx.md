---
title: 'Speed up your Yarn Workspace with Nx'
slug: 'speed-up-your-yarn-workspace-with-nx'
authors: ['Emily Xiong']
cover_image: '/blog/images/2022-05-19/1*V2gUpSRK_LMsjWUJiFkeig.png'
tags: [nx, release]
---

If you have a Yarn workspace, you can turn it into an Nx monorepo with a simple command. Below is an example of a Yarn
workspace with multiple Expo apps which we will be using to add Nx: [byCedric/eas-monorepo-example](https://github.com/byCedric/eas-monorepo-example)

For this example workspace, there are 3 Expo applications:

- managed: Expo [managed](https://docs.expo.dev/introduction/managed-vs-bare/#managed-workflow) app
- ejected: Expo [bare](https://docs.expo.dev/introduction/managed-vs-bare/#bare-workflow) app
- with-sentry: Expo managed app with [`sentry-expo`](https://github.com/expo/sentry-expo) integrated

When you run the app, each app will just have a text in the middle of the screen:

![](/blog/images/2022-05-19/1*ZUmmlN28C0dG9I_fu1lttw.avif)
_Screenshots of 3 applications_

This blog is going to show you how to turn the above Yarn workspace to Nx.

## Why Nx?

Before we start, the first question we need to address is: why go through all the troubles to turn a working Yarn
workspace to Nx? If you got a Yarn workspace, you can already share code between apps. So why Nx?

Like Yarn workspace, Nx is a monorepo tool. However, unlike Yarn workspace, not only does Nx provide faster build time
and better developer experience, but it will also provide:

- Workspace visualizations
- Distributed Task Execution
- Easy Updating
- Editor Plugin

## Steps

After checkout the repo, go to the folder and run:

```shell
npx add-nx-to-monorepo
```

You should see below in the terminal:

```
\>  NX  🐳 Nx initialization? Use Nx Cloud? (It's free and doesn't require registration.) Yes \[Faster builds, run detail
s, Github integration. Learn more at [https://nx.app](https://nx.app)\]\>  NX  🧑‍🔧 Analyzing the source code and creating configuration files\>  NX  📦 Installing dependencies
```

You should see that a file named `nx.json` is created in your workspace root.

Notice in package.json: you should see the latest `nx` is added to `devDependencies` like below:

```
"devDependencies": {
  "nx": "14.1.6"
}
```

That’s it! Now you officially added Nx to your workspace.

## Faster Build

In the Yarn workspace, if you run `yarn build`, it will run the build command for each app and library. It took 5.51
seconds for the below instance:

```shell
$ yarn workspaces run build\> @acme/app-ejected
$ echo 'Nothing to build'
Nothing to build\> @acme/app-managed
$ echo 'Nothing to build'
Nothing to build\> @acme/app-with-dev-client
$ echo 'Nothing to build'
Nothing to build\> @acme/app-with-sentry
$ echo 'Nothing to build'
Nothing to build\> @acme/babel-preset-expo
$ echo 'Nothing to build'
Nothing to build\> @acme/eslint-config
$ echo 'Nothing to build'
Nothing to build\> @acme/ui
$ bob build
ℹ Building target commonjs
ℹ Cleaning up previous build at build/commonjs
ℹ Compiling 1 files in src with babel
✔ Wrote files to build/commonjs
ℹ Building target module
ℹ Cleaning up previous build at build/module
ℹ Compiling 1 files in src with babel
✔ Wrote files to build/module
ℹ Building target typescript
ℹ Cleaning up previous build at build/typescript
ℹ Generating type definitions with tsc
✔ Wrote definition files to build/typescript
✨  Done in 5.51s.
```

However, after turning the workspace to Nx, run the build command against all apps and libraries:

```shell
yarn nx run-many --target=build --all
```

Notice it will take much less time the 2nd run. For example, it only took 0.96 seconds for the below instance:

![](/blog/images/2022-05-19/1*qjNY5uCAnC_0O2coa0Trpw.avif)
_Console output for Nx build command_

The same goes for linting. If you run `yarn test`, notice it would run linting for each app and library (in this repo,
it uses the `test` script to run eslint). For the below instance, it took 18.26 seconds.

```shell
yarn run v1.22.10
$ yarn workspaces run test\> @acme/app-ejected
$ eslint --ext js,ts,tsx .\> @acme/app-managed
$ eslint --ext js,ts,tsx .\> @acme/app-with-dev-client
$ eslint --ext js,ts,tsx .\> @acme/app-with-sentry
$ eslint --ext js,ts,tsx .\> @acme/babel-preset-expo
$ echo 'Nothing to test'
Nothing to test\> @acme/eslint-config
$ echo 'Nothing to test'
Nothing to test\> @acme/ui
$ eslint --ext ts,tsx ./src
✨  Done in 18.26s.
```

To run the test command for all apps and libraries:

```shell
yarn nx run-many --target=test --all
```

Notice for the below instance, it only took 0.95 seconds:

![](/blog/images/2022-05-19/1*m0GGbuQjBHCURuV71lxQMw.avif)
_Console output for Nx test command_

For this repo, it actually decreased build and lint runtime by ~90%. How does Nx achieve that?

Notice in the terminal console that it sometimes says
`Nx read the output from the cache instead of running the command`. This is because Nx
uses [Computation Caching](/concepts/how-caching-works). If the app or lib has no change, it would retrieve the
computation from the cache. In short, it never builds, tests, or lints the same code twice.

## Workspace Visualizations & Boundary Rules

To see the workspace project graph, run the command:

```shell
yarn nx graph
```

You should be able to see the below graph:

![](/blog/images/2022-05-19/1*pILzV-ESjXR_xsBBXRwPJw.avif)
_Workspace project graph_

Being able to perform [workspace visualization](features/explore-graph) can be a huge benefit. In particular, it is
handy for tracing and debugging as you can clearly see how apps and libs on this workspace are related to each other.

Now, this is a relatively small workspace with only 3 libraries and 4 applications. As your workspace grows it becomes
increasingly a challenge to tame dependencies and imports between libs. You definitely don’t want your monorepo to
become a big entangled mess. Also, tracing circular dependencies in a bigger repo can quickly become a headache to trace
and debug if your only tool is examining the code.

In addition to using the project graph Nx also comes with a lint rule `@nrwl/nx/enforce-module-boundaries` to help
detect circular dependencies early and prevent imports between libs that shouldn’t talk to each other. Read more in our
blog post on “[Taming Code Organization with Module Boundaries in Nx](/blog/mastering-the-project-boundaries-in-nx)”.

## Distributed Task Execution

Nx also comes with an [`affected`](/ci/features/affected) command: instead of running the command against all
apps and libraries, it will only run the command against the one that got “affected” by a change.

For example, if you made no code change and run the command:

```shell
yarn nx affected --target=build
```

It will not run build for any project:

![](/blog/images/2022-05-19/1*IRF5-bzEexpfPyGq0m4UVA.avif)
_Console output for Nx build when no change is made_

If instead, you changed the `ui` library in this workspace, the apps that depend on the library will get affected (
`apps-ejected`, `app-managed`, `app-with-dev-client`, `app-with-sentry`); the library `babel-preset-expo` and
`eslint-config` will not be affected.

If you run `yarn nx affected:graph`, you should see the dependency graph:

![](/blog/images/2022-05-19/1*BUshtwYUlgzhBjVSy2ly4A.avif)
_Affected dependency graph with UI change_

Now run the command `yarn nx affected --target=build`:

![](/blog/images/2022-05-19/1*Qm93eM3ZbTHNgzzwLBfsAQ.avif)
_Console output for Nx build when ui library changed_

Notice in the console, `babel-preset-expo` and `eslint-config` are retrieved from the cache; the library `ui` and all
the apps are rebuilt.

If you only changed the `managed` app, the other apps are not affected.The dependency graph should look like the below
with only `app-managed`:

![](/blog/images/2022-05-19/1*ywPHCW_mknliXc2qJMc5gw.avif)
_Dependency graph with managed app changed_

Now run the command again:

![](/blog/images/2022-05-19/1*jHnN0ErSuVMAtEFXDJOTAw.avif)
_Console output for Nx build when managed app changed_

Notice that it only builds the `app-managed`.

The `affected` command is a powerful tool that further reduces your build, test and lint time.

## Easy Updating

Another powerful command Nx has to offer is [`migrate`](/nx-api/nx/documents/migrate#migrate).

By running command `yarn nx migrate latest`, it would automatically update to the latest versions of all frameworks and
tools. For example, for an Expo workspace, if you want to upgrade the Expo version, you may need to upgrade React
Native, React and other libraries' versions as well. You can go into your package.json and try to change the version
number manually, or you can leave it to Nx to upgrade the version for you. Nx is not only going to update the version
numbers but also run code & config migrations if applicable.

## Nx Editor Plugins

Nx also offers powerful Editor Plugins to improve the developer experience. For example. you can
use [Nx Console](https://marketplace.visualstudio.com/items?itemName=nrwl.angular-console) for VS Code. Then adding
another Expo app to this workspace will be one click away:

![](/blog/images/2022-05-19/1*G92QDpZR_aoU4H6XuzrJBg.avif)
_Nx Console_

## Conclusion

These are some of the features Nx has to offer in comparison with Yarn Workspace.

Hopefully, after reading this blog, I have persuaded you to convert your Yarn workspace to Nx, or at least be willing to
try Nx out. If not, you can read more: [Adding Nx to NPM/Yarn/PNPM Workspace](/recipes/adopting-nx/adding-to-monorepo)

### Where to go from here?

- [join the Nx Official Discord Server](https://go.nx.dev/community)
- [follow Nx on Twitter](https://twitter.com/nxdevtools)
- subscribe to the [Nx Youtube channel](https://youtube.com/c/Nrwl_io)
