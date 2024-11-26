---
title: 'Introducing Nx Ecosystem CI'
slug: 'introducing-nx-ecosystem-ci'
authors: ['Katerina Skroumpelou']
cover_image: '/blog/images/2023-06-20/1*EffyLKcVe5gE_x3MT8PJUQ.png'
tags: [nx]
---

The JavaScript ecosystem evolves at a rapid pace, frequently introducing new tools and packages. At Nx, we provide out-of-the-box integrations with the most popular among them so you don’t have to worry when stitching them together. That, however…yes you guessed it… can be a challenging task. There’s just one way to keep up: automation.

We already run a ton of automated testing on our repository to ensure we don’t break anything. But given Nx’s popularity and vast usage across open source and enterprise projects, we want to go a step further: introducing the [Nx Ecosystem CI](https://github.com/nrwl/nx-ecosystem-ci). Inspired by the work done by our friends on the [Vite](https://vitejs.dev/) team, the [Nx Ecosystem CI](https://github.com/nrwl/nx-ecosystem-ci) is designed to enhance the stability of Nx by testing pre-release versions with projects in the Nx ecosystem.

### Inspired by the Vite Ecosystem CI

The [Vite Ecosystem CI](https://github.com/vitejs/vite-ecosystem-ci) is an innovative tool that has significantly enhanced the use of [Vite](https://vitejs.dev/). It monitors the compatibility of Vite with various other packages and projects in the ecosystem by running tests against the latest changes in the Vite codebase and the projects it integrates with. This allows the Vite team to catch issues early and maintain a high level of stability, ensuring that developers using Vite can trust that new contributions to either Vite or their project will not result in breaking changes.

This robust testing system is essential because it gives users confidence in Vite’s reliability, encouraging more developers to adopt Vite. It’s a great example of proactive testing in a fast-paced ecosystem and an inspiration for other projects, including Nx. The concept of the Ecosystem CI introduces a framework-agnostic way of testing integrations of one tool with other tools in the ecosystem. It puts together a “syntax” with which tools can easily find the way to test their latest versions with one another.

### Nx Ecosystem CI

The [Nx Ecosystem CI](https://github.com/nrwl/nx-ecosystem-ci) is a fork of the [Vite Ecosystem CI](https://github.com/vitejs/vite-ecosystem-ci) but is tailored specifically for the Nx ecosystem. It’s designed to ensure that Nx maintains its high standards of reliability and compatibility with all our users.

### How Nx Ecosystem CI Works

The Nx Ecosystem CI works in the following way:

1.  It clones the provided repo which uses Nx
2.  It installs the project’s dependencies
3.  It runs a number of scripts specified by the project’s author (eg. `test`, `build`, `e2e`)
4.  It migrates the repository to the `next` version of Nx (using `nx migrate next`)
5.  It runs the scripts again
6.  It reports the results of the runs to the [Nx Official Discord Server](https://go.nx.dev/community)
    in the `#ecosystem-ci` channel.

The main difference between the Nx Ecosystem CI and the Vite Ecosystem CI is that Nx Ecosystem CI uses the \`next\` version of Nx as published on npm, rather than cloning and building Nx locally, like Vite does in the Vite Ecosystem CI. This approach ensures that the tests run against the same code that developers are most likely to use in their projects. It also makes it easier for the script to migrate to that version.

At its core, the Nx Ecosystem CI is a set of command-line tools that run tests for a specific or all available suites. Each test suite corresponds to a specific configuration and consists of a set of commands executed in a given repository. The test suite checks for the correct execution of Nx commands, such as build, test, and e2e tests, ensuring that Nx functions as expected in different environments and projects.

### Adding a new test suite

To add a new test suite for your project in the Nx Ecosystem CI, you would need to create a new file under the tests directory. The name of this file should reflect the suite it represents, for example, [`nx-rspack.ts`](https://github.com/nrwl/nx-ecosystem-ci/blob/main/tests/nx-rspack.ts) .

The first step is to import the necessary modules and types from `utils.ts` and `types.ts` at the top of your file:

```typescript
import { runInRepo } from '../utils';
import { RunOptions } from '../types';
```

`RunOptions` is a type that represents the options for running a test suite. It includes properties such as the repository to test, the branch to use, and the commands to run for building, testing, and performing e2e tests (all optional).

Next, you need to define the `test` function that accepts the `RunOptions`. Within this function, you’ll call the `runInRepo` function, passing in the options as well as any specific properties required for your suite:

Again, using the example of `nx-rspack`:

```
export async function test(options: RunOptions) {
    await runInRepo({
        …options,
        repo: 'nrwl/nx-labs',
        branch: 'main',
        build: ['build rspack'],
        test: ['test rspack'],
        e2e: ['e2e rspack-e2e'],
    })
}
```

In this example, the suite is set up to run on the ‘nrwl/nx-labs’ repository on the `main` branch. It will run `build rspack`, `test rspack`, and `e2e rspack-e2e` as its build, test, and e2e tests respectively. These commands will be invoked using the package manager used by your repository. So, in the `nx-labs` case, it will run `yarn build rspack` in the `nrwl/nx-labs` repo.

For this reason, adding a new test suite to the Nx Ecosystem CI also requires setting up appropriate `scripts` in your repository’s `package.json` file. These scripts provide the commands that will be invoked by your package manager to carry out the `build`, `test`, and `e2e` steps.

Here’s an example of how scripts might be configured in a package.json file for a repository using Nx:

```
"scripts": {
…
    "build": "nx build",
    "test": "nx test",
    "e2e": "nx e2e"
…
},
```

These scripts should be set up in such a way that they can be invoked directly by your package manager. For example, in a repository using `pnpm`, you could run the build script with the command `pnpm run build`.

When you create your test suite file, you’ll specify these script names in the `build`, `test`, and `e2e` properties of the `options` object passed to `runInRepo`.

```
export async function test(options: RunOptions) {
    await runInRepo({
        …options,
        repo: 'nrwl/nx-labs',
        branch: 'main',
        build: ['build'],
        test: ['test'],
        e2e: ['e2e'],
        })
}
```

With this setup, the Nx Ecosystem CI will run these scripts in your repository as part of its CI process, or just when you run `pnpm test <name-of-suite>` locally.

In addition to creating the test suite and setting up the package.json scripts, you will also need to add the name of the new suite to the workflow configuration files in the `.github/workflows` directory of the Nx Ecosystem CI repository. This suite name should match the filename of your test suite script.

There are two workflow files you’ll need to update:

- `.github/workflows/ecosystem-ci-selected.yml`
- `.github/workflows/ecosystem-ci.yml`

In `.github/workflows/ecosystem-ci.yml` you’ll find a strategy section with a `matrix` property. This `matrix` property specifies an array of suite names for the workflow to run. You’ll need to add your new suite name to this array.

Here’s what the strategy section might look like after adding a new suite named `my-new-suite`:

```
strategy:
  matrix:
   suite:
     - ….
     - nx-remix
     - nx-rspack
     - …
     - my-new-suite # your new suite
```

By adding your suite name to this file, you’re instructing the Nx Ecosystem CI to include your suite in its test runs.

In addition to the `.github/workflows/ecosystem-ci.yml` file, you also need to include your suite in the `.github/workflows/ecosystem-ci-selected.yml` file.

The `ecosystem-ci-selected.yml` workflow is designed to allow manual selection of a test suite to run. To add a suite to this workflow, you add it to the options array under `workflow_dispatch > inputs > suite`. Here’s what it might look like with a new suite named `my-new-suite`:

```
on:
  workflow_dispatch:
    inputs:
      suite:
        description: "testsuite to run"
        required: true
        type: choice
        options:
          - ….
          - nx-remix
          - nx-rspack
          - …
          - my-new-suite # your new suite
```

Adding your suite name to this file allows it to be manually selected for a test run via the GitHub Actions interface. This manual selection process provides additional flexibility and control over the testing process, allowing you to run individual suites as needed.

### Reporting the results

The Nx Ecosystem CI is integrated with GitHub Actions, which helps with its automation process. The CI pipeline is scheduled to run three times a week (on Mondays, Wednesdays, and Fridays) and can also be triggered manually. The workflow uses a matrix strategy to run the suites in parallel. Each suite is given a big amount of memory, and the pipeline is configured with a long timeout, meaning that even if one suite encounters an error, the rest will continue to run. This ensures that we get comprehensive feedback on the health of all the test suites, regardless of individual failures. Once the test suites run, Github sends a message to the [Nx Official Discord Server](https://go.nx.dev/community)
`#ecosystem-ci` channel with the status of each suite, enabling the team and the community to view the results. Each result points to the Nx tag that was used, and also the job logs on GitHub.

Here is an example of a test run:

[https://github.com/nrwl/nx-ecosystem-ci/actions/runs/5144215568/jobs/9260227337](https://github.com/nrwl/nx-ecosystem-ci/actions/runs/5144215568/jobs/9260227337)

### Benefits for the Nx Community

The introduction of the Nx Ecosystem CI is a significant win for both the Nx team and the Nx developer community. For us, it enables us to catch issues early, often before they affect most end-users. By running tests against the \`next\` version of Nx, we can ensure that any changes we make are compatible with the various configurations that our users maintain.

For developers using Nx, the Nx Ecosystem CI offers reassurance that the tools they rely on are being actively tested and maintained. This provides confidence in the stability of Nx and its plugins.

### Ecosystem CI as part of the Open Source community

We are not alone in recognizing the value of an Ecosystem CI approach. Other OSS projects including Nuxt, VueJs, VolarJs, and Rspack, have also adopted this strategy. You can explore their implementations here:

- Nuxt: [https://github.com/nuxt/ecosystem-ci](https://github.com/nuxt/ecosystem-ci))
- VueJs: [https://github.com/vuejs/ecosystem-ci](https://github.com/vuejs/ecosystem-ci)
- VolarJs: [https://github.com/volarjs/ecosystem-ci](https://github.com/volarjs/ecosystem-ci)
- Rspack: [https://github.com/web-infra-dev/rspack-ecosystem-ci](https://github.com/web-infra-dev/rspack-ecosystem-ci)
- Storybook: [https://storybook.js.org/blog/storybook-ecosystem-ci/](https://storybook.js.org/blog/storybook-ecosystem-ci/)

As we continue to improve and refine the Nx Ecosystem CI, we remain committed to the goal of making Nx a reliable and integral part of your development workflow. If you’re an open-source maintainer, you can create your own Ecosystem CI either from scratch (like Storybook) or by cloning the Vite Ecosystem CI. If your project uses Nx, you can easily add a new test suite for it.

## Learn more

- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- 🚀 [Speed up your CI](/nx-cloud)
