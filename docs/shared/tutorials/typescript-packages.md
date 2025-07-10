---
title: 'TypeScript Monorepo Tutorial'
description: In this tutorial you'll add Nx to an existing TypeScript repo
---

# TypeScript Monorepo Tutorial

In this tutorial, you'll learn how to add Nx to a repository with an existing TypeScript project. The starting repository uses [NPM workspaces](https://docs.npmjs.com/cli/using-npm/workspaces) for project linking and is configured to build with [TypeScript project references](https://www.typescriptlang.org/docs/handbook/project-references.html).

What will you learn?

- how to add Nx to the repository with a single command
- how to configure caching for your tasks
- how to configure a task pipeline
- how to configure projects automatically with Nx Plugins
- how to manage your releases with `nx release`
- [how to speed up CI with Nx Cloud ⚡](#fast-ci)

<!-- ## Final Source Code

Here's the source code of the final result for this tutorial.

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/typescript-packages" /%} -->

<!-- {% youtube
src="https://www.youtube.com/embed/ZA9K4iT3ANc"
title="Nx NPM Workspaces Tutorial Walkthrough"
/%} -->

## Starting Repository

<!-- {% video-link link="https://youtu.be/ZA9K4iT3ANc?t=51" /%} -->

To get started, fork [the sample repository](https://github.com/nrwl/tuskydesign/fork) and clone it on your local machine:

```shell
git clone https://github.com/<your-username>/tuskydesign.git
```

The repository has three TypeScript packages under `packages/animals`, `packages/names` and `packages/zoo`. The `zoo` package uses `animals` and `names` to generate a random message. The root `package.json` has a `workspaces` property that tells NPM how to find the projects in the repository.

```json {% fileName="package.json" %}
{
  "workspaces": ["packages/*"]
}
```

Because of this setting, when the install command is run at the root, the correct packages are installed for each project. NPM will create dedicated `node_modules` folders inside of each project folder where necessary.

```shell
npm install
```

Now let's try running some tasks. To build the `animals` package, use the `build` npm script:

```text {% command="npm run build -w @tuskdesign/animals" path="~/tuskydesigns" %}
> @tuskdesign/animals@1.2.0 build
> tsc --build tsconfig.lib.json
```

The repository is set up using [TypeScript project references](https://www.typescriptlang.org/docs/handbook/project-references.html) so building the `zoo` package will automatically build all its dependencies.

```text {% command="npm run build -w @tuskdesign/zoo" path="~/tuskydesigns" %}
> @tuskdesign/zoo@1.2.0 build
> tsc --build tsconfig.lib.json
```

To run the `zoo` package use the `serve` script:

```text {% command="npm run serve -w @tuskdesign/zoo" path="~/tuskydesigns" %}
> @tuskdesign/zoo@1.2.0 serve
> node dist/index.js

Bo the pig says oink!
```

Now that you have a basic understanding of the repository we're working with, let's see how Nx can help us.

## Smart Monorepo

<!-- {% video-link link="https://youtu.be/ZA9K4iT3ANc?t=170" /%} -->

Nx offers many features, but at its core, it is a task runner. Out of the box, it can cache your tasks and ensure those tasks are run in the correct order. After the initial set up, you can incrementally add on other features that would be helpful in your organization.

### Add Nx

To enable Nx in your repository, run a single command:

```shell {% path="~/tuskydesigns" %}
npx nx@latest init
```

This command will download the latest version of Nx and help set up your repository to take advantage of it.

First, the script will propose installing some plugins based on the packages that are being used in your repository.

- Deselect both proposed plugins so that we can explore what Nx provides without any plugins.

Second, the script asks a series of questions to help set up caching for you.

- `Which scripts need to be run in order?` - Choose `build`
- `Which scripts are cacheable?` - Choose `build` and `typecheck`
- `Does the "build" script create any outputs?` - Enter `dist`
- `Does the "typecheck" script create any outputs?` - Enter nothing
- `Would you like remote caching to make your build faster?` - Choose `Skip for now`

### Explore Your Workspace

<!-- {% video-link link="https://youtu.be/ZA9K4iT3ANc?t=250" /%} -->

If you run `nx graph` as instructed, you'll see the dependencies between your projects.

```shell {% path="~/tuskydesigns" %}
npx nx graph --focus=@tuskdesign/zoo
```

{% graph title="Tusk Design" height="200px" jsonFile="shared/tutorials/typescript-packages-project-graph.json" %}
{% /graph %}

Nx uses this graph to determine the order tasks are run and enforce module boundaries. You can also leverage this graph to gain an accurate understanding of the architecture of your codebase. Part of what makes this graph invaluable is that it is derived directly from your codebase, so it will never become out of date.

### Caching Pre-configured

<!-- {% video-link link="https://youtu.be/ZA9K4iT3ANc?t=285" /%} -->

Nx has been configured to run your `build`, `typecheck` and `lint` tasks. You can run a single task like this:

```shell {% path="~/tuskydesigns" %}
npx nx build @tuskdesign/zoo
```

Or all tasks with a certain name like this:

```shell {% path="~/tuskydesigns" %}
npx nx run-many -t typecheck
```

During the `init` script, Nx also configured caching for these tasks. You can see in the `nx.json` file that the `build`, `typecheck` and `lint` targets have the `cache` property set to `true` and the `build` target specifies that its output goes to the project's `dist` folder.

```json {% fileName="nx.json" %}
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["{projectRoot}/dist"],
      "cache": true
    },
    "typecheck": {
      "cache": true
    },
    "lint": {
      "cache": true
    }
  },
  "defaultBase": "main"
}
```

Try running `build` for the `zoo` app a second time:

```shell {% path="~/tuskydesigns" %}
npx nx build @tuskdesign/zoo
```

The first time `nx build` was run, it took about 1 second - just like running `npm run build`. But the second time you run `nx build`, it completes instantly and displays this message:

```text
Nx read the output from the cache instead of running the command for 3 out of 3 tasks.
```

You can see the same caching behavior working when you run `npx nx typecheck`.

### Use Task Pipelines

<!-- {% video-link link="https://youtu.be/ZA9K4iT3ANc?t=358" /%} -->

You may be wondering why the caching message in the previous section mentioned 3 tasks when you only ran the `build` task from the terminal. When we said that `build` tasks must be run in order during the setup script, Nx created a simple task pipeline. You can see the configuration for it in the `nx.json` file:

```json {% fileName="nx.json" %}
{
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"]
    }
  }
}
```

This configuration means that if you run `build` on any project, Nx will first run `build` for the dependencies of that project and then run `build` on the project itself. The `^build` text means "the `build` tasks of the project's dependencies." You can visualize this in the Nx graph by selecting the `Tasks` dropdown in the top left and clicking `Show all tasks`:

```shell {% path="~/tuskydesigns" %}
npx nx graph
```

Alternatively, you can pass the `--graph` option to the run command to inspect the task graph.

```shell {% path="~/tuskydesigns" %}
npx nx run @tuskdesign/zoo:build --graph
```

{% graph height="200px" title="Build Task Pipeline" type="task" jsonFile="shared/tutorials/typescript-packages-build-tasks1.json" %}
{% /graph %}

### Create a Task Pipeline

<!-- {% video-link link="https://youtu.be/ZA9K4iT3ANc?t=450" /%} -->

You may have noticed in the `packages/zoo/package.json` file, there is a `serve` script that expects the `build` task to already have created the `dist` folder. Let's set up a task pipeline that will guarantee that the project's `build` task has been run.

```json {% fileName="nx.json" highlightLines=[5] %}
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "targetDefaults": {
    "serve": {
      "dependsOn": ["build"]
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["{projectRoot}/dist"],
      "cache": true
    },
    "typecheck": {
      "cache": true
    }
  },
  "defaultBase": "main"
}
```

The `serve` target's `dependsOn` line makes Nx run the `build` task for the current project before running the current project's `build` task. Now `nx serve` will run the `build` task before running the `serve` task.

### Use Nx Plugins to Enhance Your Workspace

<!-- {% video-link link="https://youtu.be/ZA9K4iT3ANc?t=507" /%} -->

We mentioned earlier that this repository is using TypeScript project references defined in the `tsconfig.json` files to incrementally build each project so that the output is available for other projects in the repository. In order for this feature to work, the `references` section in the `tsconfig.json` files for each project need to accurately reflect the actual dependencies of that project. This can be difficult to maintain, but Nx already knows the dependencies of every project and you can use the `@nx/js` plugin to automatically keep the TypeScript project references in sync with the code base.

Nx plugins can:

- automatically configure caching for you, including inputs and outputs based on the underlying tooling configuration
- infer tasks that can be run on a project because of the tooling present
- keep tooling configuration in sync with the structure of your codebase
- provide code generators to help scaffold out projects
- automatically keep the tooling versions and configuration files up to date

For this tutorial, we'll focus on inferring tasks and keeping tooling configuration in sync.

First, let's remove the existing `build` and `typecheck` scripts from each project's `package.json` files to allow the `@nx/js` plugin to infer those tasks for us.

```json {% fileName="packages/animals/package.json" %}
{
  "scripts": {}
}
```

```json {% fileName="packages/names/package.json" %}
{
  "scripts": {}
}
```

```json {% fileName="packages/zoo/package.json" %}
{
  "scripts": {
    "serve": "node dist/index.js"
  }
}
```

Now let's add the `@nx/js` plugin:

```{% command="npx nx add @nx/js" path="~/tuskydesign" %}
✔ Installing @nx/js...
✔ Initializing @nx/js...
 NX  Generating @nx/js:init

UPDATE nx.json
UPDATE package.json

 NX   Package @nx/js added successfully.
```

The `nx add` command installs the version of the plugin that matches your repo's Nx version and runs that plugin's initialization script. For `@nx/js`, the initialization script registers the plugin in the `plugins` array of `nx.json`. The registered plugin automatically infers `build` and `typecheck` tasks for any project with a `tsconfig.json` file. Open the project details view for the `zoo` package and look at the `build` task.

```shell {% path="~/tuskydesigns" %}
npx nx show project @tuskdesign/zoo
```

{% project-details title="Project Details View" jsonFile="shared/tutorials/typescript-packages-pdv.json" %}
{% /project-details %}

Notice that the `inputs` that are inferred for the `build` task match the `include` and `exclude` settings in the `tsconfig.lib.json` file. As those settings are changed, the cache `inputs` will automatically update to the correct values.

The `build` task also has a [sync generator](/concepts/sync-generators) defined. The `@nx/js:typescript-sync` generator will automatically update the `references` property in the `tsconfig.json` files across the repository to match the actual dependencies in your code.

Let's see this behavior in action by extracting some common code into a new `util` library.

First, create a library with `@nx/js:lib` generator:

```shell
nx g @nx/js:lib packages/util
```

Set the bundler to `tsc`, the linter to `none` and the unit test runner to `none`.

Now we can move the `getRandomItem` function from `packages/names/names.ts` and `packages/animals/animals.ts` into the `packages/util/src/lib/util.ts` file.

```ts {% fileName="packages/util/src/lib/util.ts" %}
export function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
```

```ts {% fileName="packages/animals/animals.ts" %}
import { getRandomItem } from '@tuskdesign/util';

// ...
```

```ts {% fileName="packages/names/names.ts" %}
import { getRandomItem } from '@tuskdesign/util';

// ...
```

Now if you run the build, Nx will notice that the TypeScript project references need to be updated and ask your permission to update them.

```text {% command="nx build @tuskdesign/zoo" path="~/tuskydesigns" %}
 NX   The workspace is out of sync

[@nx/js:typescript-sync]: Some TypeScript configuration files are missing project references to the projects they depend on or contain outdated project references.

This will result in an error in CI.

? Would you like to sync the identified changes to get your workspace up to date? …
❯ Yes, sync the changes and run the tasks
  No, run the tasks without syncing the changes
```

Allow the sync to happen and you'll see that the `tsconfig.json` and `tsconfig.lib.json` files have been updated to include references to the new `util` library. With this system in place, no matter how your codebase changes, the TypeScript project references will always be correct.

### Checkpoint

At this point, the repository is still using all the same tools to run tasks, but now Nx runs those tasks in a smarter way. The tasks are efficiently cached so that there is no repeated work and the cache configuration settings are automatically synced with your tooling configuration files by Nx plugins. Also, any task dependencies are automatically executed whenever needed because we configured task pipelines for the projects.

Open up the task graph for `zoo` app's `serve` task again to see the changes.

```shell {% path="~/tuskydesigns" %}
npx nx run @tuskdesign/zoo:serve --graph
```

{% graph height="200px" title="Build Task Pipeline" type="task" jsonFile="shared/tutorials/typescript-packages-build-tasks2.json" %}
{% /graph %}

## Manage Releases

<!-- {% video-link link="https://youtu.be/ZA9K4iT3ANc?t=713" /%} -->

If you decide to publish the `animals` or `names` packages on NPM, Nx can also help you [manage the release process](/features/manage-releases). Release management involves updating the version of your package, populating a changelog, and publishing the new version to the NPM registry.

First you'll need to define which projects Nx should manage releases for by setting the `release.projects` property in `nx.json`:

```json {% fileName="nx.json" %}
{
  "release": {
    "projects": ["packages/*"]
  }
}
```

Now you're ready to use the `nx release` command to publish the `animals` and `names` packages. The first time you run `nx release`, you need to add the `--first-release` flag so that Nx doesn't try to find the previous version to compare against. It's also recommended to use the `--dry-run` flag until you're sure about the results of the `nx release` command, then you can run it a final time without the `--dry-run` flag.

To preview your first release, run:

```shell
npx nx release --first-release --dry-run
```

The command will ask you a series of questions and then show you what the results would be. Once you are happy with the results, run it again without the `--dry-run` flag:

```shell
npx nx release --first-release
```

After this first release, you can remove the `--first-release` flag and just run `nx release --dry-run`. There is also a [dedicated feature page](/features/manage-releases) that goes into more detail about how to use the `nx release` command.

## Fast CI ⚡ {% highlightColor="green" %}

<!-- {% video-link link="https://youtu.be/ZA9K4iT3ANc?t=821" /%} -->

{% callout type="check" title="Forked repository with Nx" %}
Make sure you have completed the previous sections of this tutorial before starting this one. If you want a clean starting point, you can fork the [sample repository with Nx already added](https://github.com/nrwl/nx-recipes/tree/main/typescript-packages).
{% /callout %}

So far in this tutorial you've seen how Nx improves the local development experience, but the biggest difference Nx makes is in CI. As repositories get bigger, making sure that the CI is fast, reliable and maintainable can get very challenging. Nx provides a solution.

- Nx reduces wasted time in CI with the [`affected` command](/ci/features/affected).
- Nx Replay's [remote caching](/ci/features/remote-cache) will reuse task artifacts from different CI executions making sure you will never run the same computation twice.
- Nx Agents [efficiently distribute tasks across machines](/ci/features/distribute-task-execution) ensuring constant CI time regardless of the repository size. The right number of machines is allocated for each PR to ensure good performance without wasting compute.
- Nx Atomizer [automatically splits](/ci/features/split-e2e-tasks) large e2e tests to distribute them across machines. Nx can also automatically [identify and rerun flaky e2e tests](/ci/features/flaky-tasks).

### Connect to Nx Cloud {% highlightColor="green" %}

Nx Cloud is a companion app for your CI system that provides remote caching, task distribution, e2e tests deflaking, better DX and more.

Now that we're working on the CI pipeline, it is important for your changes to be pushed to a GitHub repository.

1. Commit your existing changes with `git add . && git commit -am "updates"`
2. Push your changes to your forked GitHub repository with `git push`

Now connect your repository to Nx Cloud with the following command:

```shell
npx nx connect
```

A browser window will open to register your repository in your [Nx Cloud](https://cloud.nx.app) account. The link is also printed to the terminal if the windows does not open, or you closed it before finishing the steps. The app will guide you to create a PR to enable Nx Cloud on your repository.

![](/shared/tutorials/nx-cloud-github-connect.avif)

Once the PR is created, merge it into your main branch.

![](/shared/tutorials/github-cloud-pr-merged.avif)

And make sure you pull the latest changes locally:

```shell
git pull
```

You should now have an `nxCloudId` property specified in the `nx.json` file.

### Create a CI Workflow {% highlightColor="green" %}

Use the following command to generate a CI workflow file.

```shell
npx nx generate ci-workflow --ci=github --useRunMany
```

This generator creates a `.github/workflows/ci.yml` file that contains a CI pipeline that will run the `lint`, `test`, `build` and `e2e` tasks for projects. If you would like to also distribute tasks across multiple machines to ensure fast and reliable CI runs, uncomment the `nx-cloud start-ci-run` line and have the `nx run-many` line run the `e2e-ci` task instead of `e2e`.

The key lines in the CI pipeline are:

```yml {% fileName=".github/workflows/ci.yml" highlightLines=["12-16", "22-24"] %}
name: CI
# ...
jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          filter: tree:0

      # This enables task distribution via Nx Cloud
      # Run this command as early as possible, before dependencies are installed
      # Learn more at https://nx.dev/ci/reference/nx-cloud-cli#npx-nxcloud-startcirun
      # Uncomment this line to enable task distribution
      # - run: npx nx-cloud start-ci-run --distribute-on="3 linux-medium-js" --stop-agents-after="e2e-ci"
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci --legacy-peer-deps
      # Prepend any command with "nx-cloud record --" to record its logs to Nx Cloud
      # - run: npx nx-cloud record -- echo Hello World
      # As your workspace grows, you can change this to use Nx Affected to run only tasks affected by the changes in this PR/commit. Learn more: https://nx.dev/ci/features/affected
      # When you enable task distribution, run the e2e-ci task instead of e2e
      - run: npx nx run-many -t lint test build e2e
      # Nx Cloud recommends fixes for failures to help you get CI green faster. Learn more: https://nx.dev/ci/features/self-healing-ci
      - run: npx nx fix-ci
        if: always()
```

### Open a Pull Request {% highlightColor="green" %}

Commit the changes and open a new PR on GitHub.

```shell
git add .
git commit -m 'add CI workflow file'
git push origin add-workflow
```

When you view the PR on GitHub, you will see a comment from Nx Cloud that reports on the status of the CI run.

![Nx Cloud report](/shared/tutorials/github-pr-cloud-report.avif)

The `See all runs` link goes to a page with the progress and results of tasks that were run in the CI pipeline.

![Run details](/shared/tutorials/nx-cloud-run-details.avif)

For more information about how Nx can improve your CI pipeline, check out one of these detailed tutorials:

- [Circle CI with Nx](/ci/intro/tutorials/circle)
- [GitHub Actions with Nx](/ci/intro/tutorials/github-actions)

## Next Steps

Connect with the rest of the Nx community with these resources:

- ⭐️ [Star us on GitHub](https://github.com/nrwl/nx) to show your support and stay updated on new releases!
- [Join the Official Nx Discord Server](https://go.nx.dev/community) to ask questions and find out the latest news about Nx.
- [Follow Nx on Twitter](https://twitter.com/nxdevtools) to stay up to date with Nx news
- [Read our Nx blog](/blog)
- [Subscribe to our Youtube channel](https://www.youtube.com/@nxdevtools) for demos and Nx insights
