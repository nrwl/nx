---
title: 'Battle-Testing Nx Console with E2E Tests'
slug: 'battle-testing-nx-console-with-e2e-tests'
authors: ['Max Kless']
cover_image: '/blog/images/2022-11-11/1*UzvS9ABZtlLL7ESSDrM00A.png'
tags: [nx]
---

Nx Console is the UI for Nx & Lerna. It’s available as a VSCode extension (and more IDEs coming soon!) and with it, you get powerful features like:

- autocomplete for Nx config files,
- exploration of generators (and schematics) in a form-based view,
- context-aware visualisation of the Nx dependency graph right in your IDE
- and many more DX improvements throughout the extension!

The Nx Console project started many years ago and went through various iterations. From a small, standalone client for angular schematics to what it is today: A fully-integrated tool to help you be more productive while developing with Nx.

And folks like it: We passed a million installs this year! 🎉

Of course we as maintainers need to make sure that all of our features work when we make a PR or release a new version.

This used to mean manually clicking through features in different sample workspaces — as you can imagine, this quickly became tedious as well as unreliable. Keep in mind that Nx Console works not just for Nx but also for Lerna and Angular workspaces across multiple versions!

We needed a solution to automate this.

## The Problem with testing VSCode extensions

There’s many different kinds of tests and different ways to structure and write them. Let’s go over four common types of tests and see how to use them in the context of a VSCode extension.

- **Static Tests,** like type checking and linting, are a given. VSCode extensions are written in Typescript and Nx sets up ESLint for us automatically so we get these static checks for free.
- **Unit Tests** break your code down into ‘units’ and test those in isolation (what exactly constitutes a ‘unit’ is up to interpretation in most cases). They are a bit more complicated to get right here. Because a lot of functionality is tied to the VSCode APIs, unit tests often end up mocking everything which results in little functionality actually being tested. Because of this, unit tests are mostly useful for niches as well as helper and utility functions, not for broad coverage. They can still be useful and we have unit tests written with jest throughout our repo (but you could use any JS test runner to write and run unit tests).
- **Integration Tests** combine multiple parts of your software and test them together. They are a good option for testing some behaviour of extensions. If you [read the docs](https://code.visualstudio.com/api/working-with-extensions/testing-extension), they suggest using the `[@vscode/test-electron](https://github.com/microsoft/vscode-test)` package and `[mocha](https://mochajs.org/)`. This will allow you to run tests inside an actual VSCode instance, so you avoid mocking. However, you are still constrained. The API gives limited information on many areas. For example even this very simple test is not easily realizable with the VSCode API:

- **End-to-End (E2E) tests** are robots that click through your application to make sure it works. They can test every kind of behaviour an actual user could do. Of course, this comes with a price: The overhead to run them can be quite high as you need to spin up fresh VSCode instances for each test. But this is a tradeoff worth taking: You will not be restricted in what you test and the tests mimic actual user flows. The best part: Since VSCode is built on Electron, there is a DOM that you can read, manipulate and assert on just like you would with any web application and keep using the well-established JS tooling we have for this. This is where WebdriverIO comes into play.

## WebdriverIO and the wdio-vscode-service

[WebdriverIO (abbreviated as WDIO)](https://webdriver.io/) is an E2E testing framework for Node.js. It allows you to automate all kinds of web and mobile applications using the Webdriver or Chrome DevTools protocols.

In theory — since VSCode is built on Electron and is just Javascript, HTML and CSS under the hood — you could use any other framework like Cypress or Nightwatch to test it.

So why WebdriverIO?

WDIO has one big advantage: The `[wdio-vscode-service](https://github.com/webdriverio-community/wdio-vscode-service)` . It’s a plugin that integrates with WDIO and handles all setup-related work for you. You won’t have to think about downloading, installing and running a VSCode instance or the matching Chromedriver. On top of that, it bootstraps page objects for many functionalities and lets you access the VSCode API via remote function execution.

All these (and more) features enable you to set WDIO up quickly and move on to writing test!

## Configuring WDIO and writing the first test

Setting up WDIO is a straightforward process. By following the [installation guide](https://webdriver.io/docs/wdio-vscode-service) you get a preconfigured `wdio.conf.ts` file and all required dependencies installed. After [adding some types to](https://webdriver.io/docs/wdio-vscode-service#typescript-support) `[tsconfig.json](https://webdriver.io/docs/wdio-vscode-service#typescript-support)` and tweaking some paths in `wdio.conf.ts` to match our folder structure, we were already at the point where we could execute `wdio run ./wdio.conf.ts` . You can see that VSCode is downloaded and unpacked for us. But of course, without any tests nothing really happens. Let’s change that!

Writing a test isn’t very complicated. Create a file in a location matching your configuration’s `specs` property and WDIO will pick it up automatically. You can use mocha, cucumber or jasmine as test frameworks and start writing `describe`, `it` and `before` blocks like you’re used to.

Refer to the [WebdriverIO docs](https://webdriver.io/docs/gettingstarted) to learn more about its API and how to write tests.

If we run `wdio run ./wdio.conf.ts` again, we will see that WDIO is using the cached VSCode binary and successfully executing our test!

## Integrating with Nx — defining a target

![](/blog/images/2022-11-11/0*cIswwkZN58b6pcHi.avif)

Of course, we wanted to take advantage of Nx’s powerful features like [the task graph](/features/explore-graph), [computation caching](/features/cache-task-results) and [distributed task execution](/ci/features/distribute-task-execution). If you’re working on an [integrated style Nx repo](/concepts/integrated-vs-package-based), you get access to many official and community plugins that allow for instant integration with popular dev tools. Jest, ESLint, Cypress and many more have executors ([more on that here](/concepts/executors-and-configurations)) that allow you to run them through Nx. This isn’t the case for WebdriverIO, so we had two options: Create a custom plugin and WDIO executor or simply use `[nx:run-commands](/packages/workspace/generators/run-commands)` to wrap arbitrary commands with Nx. If WDIO became widely used in our repo, writing a custom plugin isn’t too much effort and could definitely be worth it! But for this one-time usage, we went with the quicker option. Let’s set up an `e2e` target like this:

Now, if we run `nx run vscode-e2e:e2e` , we will see WDIO run inside Nx!

While the output doesn’t look too different, this enables some amazing features! If we run the tests again, they will complete in a few milliseconds because the result could be [retrieved from cache](/concepts/how-caching-works). Also, because we defined `dependsOn` and `implicitDependencies` , Nx will always make sure that up-to-date versions of Nx Console and the nxls are built before E2E tests run. All this with just a few lines of config!

## Setting up CI

Another important step in getting the maximum value out of automated E2E testing is running it in CI. Adding new checks to an existing Github Actions pipeline isn’t complicated, so a single line of yaml configuration should do the trick:

`run: yarn exec nx affected --target=e2e --parallel=3`

> `_nx affected_` _analyzes your code changes in order to compute the minimal set of projects that need to be retested. Learn more about it here:_ [_How Affected Works_](/ci/features/affected)

This will fail, however, because WebdriverIO tries to open VSCode and expects a screen — which action runners obviously don’t have. If we were testing on a simple Chrome or Firefox instance, this could be solved by adding `--headless` to the browser’s launch options. VSCode doesn’t support a headless mode, though, so we had to find another solution: `xvfb`.

`[xvfb](https://www.x.org/releases/X11R7.6/doc/man/man1/Xvfb.1.xhtml)`[, short for X virtual frame buffer](https://www.x.org/releases/X11R7.6/doc/man/man1/Xvfb.1.xhtml), is a display server that allows you to run any program headlessly by creating a virtual display - the frame buffer. To run our E2E test through `xvfb` on CI, two steps were necessary:

First, we created a new configuration in our `e2e` target that runs the same script, but through `xvfb`.

Second, we have to make sure `xvfb` is installed on our action runners. Theoretically, we could just run `sudo apt-get install -y xvfb` on all our runners and call it a day. But for clarity’s sake and to demonstrate some of the advanced things you can do with Nx Cloud, we decided on a different solution. We want to create two kinds of runners: One with `xvfb` installed and one without it. This can be done by using the `NX_RUN_GROUP` variable in our agent and task definitions. With it, E2E tests are run on the first kind and other tasks are run on any runner.

First, we specify a unique value of `NX_RUN_GROUP` per run attempt and set it as an environment variable in our agent definition. Then, we make sure `xvfb` is installed on these agents.

In `action.yml` , where we specify the checks to be run, we provide the same `NX_RUN_GROUP` environment variable for our E2E task.

Nx Cloud then matches these run groups and makes sure that all E2E tasks are only executed on agents with `xvfb` installed. With it, we can now do everything we can do locally, with a real screen. For example, we take screenshots on failure and make them available to download from GitHub via `actions/upload-artifact` .

## Conclusion

In the end, we have fully functioning E2E test running on every PR, fully cached and distributable through Nx.

I want to take a moment and give special thanks to [Christian Bromann](https://twitter.com/bromann) who is a lead maintainer on WebdriverIO and the wdio-vscode-service. Without his foundational work, this would’ve been 100x harder.

If you have questions, comments or just want to chat about Nx Console, you can find me on twitter: [@MaxKless](https://twitter.com/home)

Some of the code snippets I showed here have been shortened for clarity, but if you want to see our setup with all details, [head over to GitHub](https://github.com/nrwl/nx-console).

## Learn more

- 🧠 [Nx Docs](/getting-started/intro)
- 👩‍💻 [Nx Console GitHub](https://github.com/nrwl/nx-console)
- 🤖 [WebdriverIO Docs](https://webdriver.io/)
- 👨‍💻 [wdio-vscode-service GitHub](https://github.com/webdriverio-community/wdio-vscode-service)
- 🧑‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
