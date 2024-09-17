---
title: 'NPM Workspaces Tutorial'
description: In this tutorial you'll add Nx to an existing NPM workspaces repo
---

# NPM Workspaces Tutorial

In this tutorial, you'll learn how to add Nx to a repository with an existing [NPM workspaces](https://docs.npmjs.com/cli/using-npm/workspaces) setup.

What will you learn?

- how to add Nx to the repository with a single command
- how to configure caching for your tasks
- how to configure a task pipeline
- how to configure projects automatically with Nx Plugins
- how to manage your releases with `nx release`
- [how to speed up CI with Nx Cloud ⚡](#fast-ci)

<!-- ## Final Source Code

Here's the source code of the final result for this tutorial.

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/npm-workspaces" /%} -->

{% youtube
src="https://www.youtube.com/embed/ZA9K4iT3ANc"
title="Nx NPM Workspaces Tutorial Walkthrough"
/%}

## Starting Repository

{% video-link link="https://youtu.be/ZA9K4iT3ANc?t=51" /%}

To get started, fork [the sample repository](https://github.com/nrwl/tuskydesign/fork) and clone it on your local machine:

```shell
git clone https://github.com/<your-username>/tuskydesign.git
```

The repository has two React packages (under `packages/buttons` and `packages/forms`) that are used in a `demo` application (located in `apps/demo`) that was designed to be used with the Vite CLI. The root `package.json` has a `workspaces` property that tells NPM how to find the projects in the repository.

```json {% fileName="package.json" %}
{
  "workspaces": ["packages/*", "apps/*"]
}
```

Because of this setting, when the install command is run at the root, the correct packages are installed for each project. NPM will create dedicated `node_modules` folders inside of each project folder where necessary.

```shell
npm install
```

Now let's try running some tasks. To lint the `demo` app, use the `lint` npm script:

```text {% command="npm run lint -w @tuskdesign/demo" path="~/tuskydesigns" %}
> @tuskdesign/demo@0.0.0 lint
> eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0
```

If you try to build the `demo` app, it will fail.

```text
Error: Failed to resolve entry for package "@tuskdesign/buttons". The package may have incorrect main/module/exports specified in its package.json.
```

The `build` script fails because it needs the `buttons` and `forms` projects to be built first in order to work correctly. To do this, lets return to the root of the repository and run the `build` task for every project in the repo:

```shell {% path="~/tuskydesigns" %}
npm run build --ws
```

When the `buttons` and `forms` projects are built first, the `demo` app can build successfully.

Now that you have a basic understanding of the repository we're working with, let's see how Nx can help us.

## Smart Monorepo

{% video-link link="https://youtu.be/ZA9K4iT3ANc?t=170" /%}

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
- `Which scripts are cacheable?` - Choose `typecheck`, `build` and `lint`
- `Does the "typecheck" script create any outputs?` - Enter nothing
- `Does the "build" script create any outputs?` - Enter `dist`
- `Does the "lint" script create any outputs?` - Enter nothing
- `Would you like remote caching to make your build faster?` - Choose `Skip for now`

### Explore Your Workspace

{% video-link link="https://youtu.be/ZA9K4iT3ANc?t=250" /%}

If you run `nx graph` as instructed, you'll see the dependencies between your projects.

```shell {% path="~/tuskydesigns" %}
npx nx graph --focus=@tuskdesign/demo
```

{% graph title="Tusk Design" height="200px" jsonFile="shared/tutorials/npm-workspaces-project-graph.json" %}
{% /graph %}

Nx uses this graph to determine the order tasks are run and enforce module boundaries. You can also leverage this graph to gain an accurate understanding of the architecture of your codebase. Part of what makes this graph invaluable is that it is derived directly from your codebase, so it will never become out of date.

### Caching Pre-configured

{% video-link link="https://youtu.be/ZA9K4iT3ANc?t=285" /%}

Nx has been configured to run your `build`, `typecheck` and `lint` tasks. You can run a single task like this:

```shell {% path="~/tuskydesigns" %}
npx nx build @tuskdesign/demo
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

Try running `build` for the `demo` app a second time:

```shell {% path="~/tuskydesigns" %}
npx nx build @tuskdesign/demo
```

The first time `nx build` was run, it took about 5 seconds - just like running `npm run build`. But the second time you run `nx build`, it completes instantly and displays this message:

```text
Nx read the output from the cache instead of running the command for 3 out of 3 tasks.
```

You can see the same caching behavior working when you run `npx nx lint` or `npx nx typecheck`.

### Use Task Pipelines

{% video-link link="https://youtu.be/ZA9K4iT3ANc?t=358" /%}

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
npx nx run @tuskdesign/demo:build --graph
```

{% graph height="200px" title="Build Task Pipeline" type="task" jsonFile="shared/tutorials/npm-workspaces-build-tasks1.json" %}
{% /graph %}

With this pipeline in place, you will never run into the error we hit at the beginning of the tutorial where the `forms` and `buttons` packages weren't built so the `demo` app couldn't build. Test this out by deleting the `packages/forms/dist` folder and then re-running the `build` task for the `demo` app.

```text {% command="npx nx build @tuskdesign/demo" path="~/tuskydesigns" %}
...

 NX   Successfully ran target build for project @tuskdesign/demo and 2 tasks it depends on (40ms)

Nx read the output from the cache instead of running the command for 3 out of 3 tasks.
```

Not only does the build complete successfully, but it finishes instantly and the `packages/forms/dist` folder is put back in place thanks to the caching.

### Create a Task Pipeline

{% video-link link="https://youtu.be/ZA9K4iT3ANc?t=450" /%}

You may have noticed in the `apps/demo/package.json` file, there is a `prebuild` script that runs `typecheck` before the `build` script in order to catch any type errors. Let's set up this same behavior in the Nx task pipeline as well.

```json {% fileName="nx.json" highlightLines=[5] %}
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build", "typecheck"],
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

The `dependsOn` line makes Nx run the `typecheck` task for the current project and the `build` task for any dependencies before running the current project's `build` task. Now `nx build` will run the `typecheck` task just like `npm run build` does.

### Use Nx Plugins to Enhance Vite Tasks with Caching

{% video-link link="https://youtu.be/ZA9K4iT3ANc?t=507" /%}

You may remember that we defined the `outputs` property in `nx.json` when we were answering questions in the `nx init` script. The value is currently hard-coded so that if you change the output path in your `vite.config.ts`, you have to remember to also change the `outputs` array in the `build` task configuration. This is where plugins can help. They directly infer information from the actual tooling configuration files (`vite.config.ts` in this case).

Nx plugins can:

- automatically configure caching for you, including inputs and outputs based on the underlying tooling configuration
- infer tasks that can be run on a project because of the tooling present
- provide code generators to help scaffold out projects
- automatically keep the tooling versions and configuration files up to date

For this tutorial, we'll just focus on the automatic caching configuration.

First, let's delete the `outputs` array from `nx.json` so that we don't override the inferred values from the plugin. Your `nx.json` should look like this:

```json {% fileName="nx.json" %}
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build", "typecheck"],
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

Now let's add the `@nx/vite` plugin:

```{% command="npx nx add @nx/vite" path="~/tuskydesign" %}
✔ Installing @nx/vite...
✔ Initializing @nx/vite...

 NX   Package @nx/vite added successfully.
```

The `nx add` command installs the version of the plugin that matches your repo's Nx version and runs that plugin's initialization script. For `@nx/vite`, the initialization script registers the plugin in the `plugins` array of `nx.json` and updates any `package.json` scripts that execute Vite related tasks. Open the project details view for the `demo` app and look at the `build` task.

```shell {% path="~/tuskydesigns" %}
npx nx show project @tuskdesign/demo
```

{% project-details title="Project Details View" jsonFile="shared/tutorials/npm-workspaces-pdv.json" %}
{% /project-details %}

If you hover over the settings for the `vite:build` task, you can see where those settings come from. The `inputs` and `outputs` are defined by the `@nx/vite` plugin from the `vite.config.ts` file where as the `dependsOn` property we set earlier in the tutorial in the `targetDefaults` in the `nx.json` file.

Now let's change where the `build` results are output to in the `vite.config.ts` file.

```ts {% fileName="apps/demo/vite.config.ts" highlightLines=[7-9] %}
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../../dist/demo',
  },
});
```

Now if you look at project details view again, you'll see that the `outputs` property for Nx's caching has been updated to stay in sync with the setting in the `vite.config.ts` file.

You can also add the `@nx/eslint` plugin to see how it infers `lint` tasks based on the ESLint configuration files.

### Checkpoint

At this point, the repository is still using all the same tools to run tasks, but now Nx runs those tasks in a smarter way. The tasks are efficiently cached so that there is no repeated work and the cache configuration settings are automatically synced with your tooling configuration files by Nx plugins. Also, any task dependencies are automatically executed whenever needed because we configured task pipelines for the projects.

Open up the task graph for `demo` app's `build` task again to see the changes.

```shell {% path="~/tuskydesigns" %}
npx nx run @tuskdesign/demo:build --graph
```

{% graph height="200px" title="Build Task Pipeline" type="task" jsonFile="shared/tutorials/npm-workspaces-build-tasks2.json" %}
{% /graph %}

## Manage Releases

{% video-link link="https://youtu.be/ZA9K4iT3ANc?t=713" /%}

If you decide to publish the `forms` or `buttons` packages on NPM, Nx can also help you [manage the release process](/features/manage-releases). Release management involves updating the version of your package, populating a changelog, and publishing the new version to the NPM registry.

First you'll need to define which projects Nx should manage releases for by setting the `release.projects` property in `nx.json`:

```json {% fileName="nx.json" %}
{
  "release": {
    "projects": ["packages/*"]
  }
}
```

Now you're ready to use the `nx release` command to publish the `forms` and `buttons` packages. The first time you run `nx release`, you need to add the `--first-release` flag so that Nx doesn't try to find the previous version to compare against. It's also recommended to use the `--dry-run` flag until you're sure about the results of the `nx release` command, then you can run it a final time without the `--dry-run` flag.

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

{% video-link link="https://youtu.be/ZA9K4iT3ANc?t=821" /%}

{% callout type="check" title="Forked repository with Nx" %}
Make sure you have completed the previous sections of this tutorial before starting this one. If you want a clean starting point, you can fork the [sample repository with Nx already added](https://github.com/nrwl/nx-recipes/tree/main/npm-workspaces).
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
npx nx generate ci-workflow --ci=github
```

This generator creates a `.github/workflows/ci.yml` file that contains a CI pipeline that will run the `lint`, `test`, `build` and `e2e` tasks for projects that are affected by any given PR. Since we are using Nx Cloud, the pipeline will also [distribute tasks across multiple machines](/ci/features/distribute-task-execution) to ensure fast and reliable CI runs.

The key lines in the CI pipeline are:

```yml {% fileName=".github/workflows/ci.yml" highlightLines=["10-14", "21-22"] %}
name: CI
# ...
jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      # This enables task distribution via Nx Cloud
      # Run this command as early as possible, before dependencies are installed
      # Learn more at https://nx.dev/ci/reference/nx-cloud-cli#npx-nxcloud-startcirun
      # Connect your workspace by running "nx connect" and uncomment this
      - run: npx nx-cloud start-ci-run --distribute-on="3 linux-medium-js" --stop-agents-after="build"
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci --legacy-peer-deps
      - uses: nrwl/nx-set-shas@v4
      # Nx Affected runs only tasks affected by the changes in this PR/commit. Learn more: https://nx.dev/ci/features/affected
      - run: npx nx affected -t lint test build
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
-

## Next Steps

Connect with the rest of the Nx community with these resources:

- [Join the Official Nx Discord Server](https://go.nx.dev/community) to ask questions and find out the latest news about Nx.
- [Follow Nx on Twitter](https://twitter.com/nxdevtools) to stay up to date with Nx news
- [Read our Nx blog](/blog)
- [Subscribe to our Youtube channel](https://www.youtube.com/@nxdevtools) for demos and Nx insights
