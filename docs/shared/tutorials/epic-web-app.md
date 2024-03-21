---
title: 'Epic Web App Tutorial'
description: In this tutorial you'll add Nx to an existing NPM workspaces repo
---

# Epic Web App Tutorial

In this tutorial, you'll learn how to add Nx to an app created with the [Epic Stack](https://www.epicweb.dev/epic-stack). You'll see how Nx can provide immediate value with very little configuration and then you can gradually enable more features.

- Add task caching
- Make sure tasks run in the correct order (task pipeline)
- Use the Nx Playwright plugin to enhance the Playwright experience

<!-- ## Final Source Code

Here's the source code of the final result for this tutorial.

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/npm-workspaces" /%} -->

## Starting Repository

To get started, create a new Epic Web app:

```shell
npx create-epic-app@latest epic-web-app
```

The repository contains a default setup for a Remix application with [a lot of other added features](https://www.epicweb.dev/epic-stack). In this tutorial, we'll first examine the validation process which includes linting, typechecking, unit tests and end to end tests. Second we'll improve the three steps in the build process - aggregating ui icons, building the remix application, and building the server for the remix app.

After you've installed dependencies with `npm install`, you can lint, typecheck, unit test and e2e test with a single command:

```shell {% path="~/epic-web-app" %}
npm run validate
```

This should take about 22 seconds to finish.

You can also run the build process with this command:

```shell {% path="~/epic-web-app" %}
npm run build
```

The `build` command runs `build:icons`, then `build:remix` and finally `build:server`.

Now that you have a basic understanding of the repository we're working with, let's see how Nx can help us.

## Add Nx

Nx offers many features, but at its core, it is a task runner. Out of the box, it can cache your tasks and ensure those tasks are run in the correct order. After the initial set up, you can incrementally add on other features that would be helpful in your organization.

To enable Nx in your repository, run a single command:

```shell {% path="~/epic-web-app" %}
npx nx@latest init
```

This command will download the latest version of Nx and help set up your repository to take advantage of it.

First, the script will propose installing some plugins based on the packages that are being used in your repository.

- Deselect all four proposed plugins so that we can explore what Nx provides without any plugins.

Second, the script asks a series of questions to help set up caching for you.

- `Which of the following scripts are cacheable?`
  - Choose `build:icons`, `build:remix`, `build:server`, `lint`, `coverage`, `test:e2e:run`, `typecheck`
- `Does the "build:icons" script create any outputs?`
  - Enter `app/components/ui/icons`
- `Does the "build:remix" script create any outputs?`
  - Enter `build`
- `Does the "build:server" script create any outputs?`
  - Enter `server-build`
- `Does the "lint" script create any outputs?`
  - Enter nothing
- `Does the "coverage" script create any outputs?`
  - Enter nothing
- `Does the "test:e2e:run" script create any outputs?`
  - Enter `playwright-report`
- `Does the "typecheck" script create any outputs?`
  - Enter nothing
- `Would you like remote caching to make your build faster?`
  - Choose `Skip for now`

```text {% command="npx nx@latest init" path="~/epic-web-app" %}
 NX   Recommended Plugins:

Add these Nx plugins to integrate with the tools used in your workspace.

✔ Which plugins would you like to add? · No items were selected

 NX   🐳 Nx initialization

 NX   🧑‍🔧 Please answer the following questions about the scripts found in your package.json in order to generate task runner configuration

✔ Which of the following scripts are cacheable? (Produce the same output given the same input, e.g. build, test and lint usually are, serve and start are not). You can use spacebar to select one or more scripts. · build:icons, build:remix, build:server, lint, coverage, test:e2e:run, typecheck

✔ Does the "build:icons" script create any outputs? If not, leave blank, otherwise provide a path (e.g. dist, lib, build, coverage) · app/components/ui/icons
✔ Does the "build:remix" script create any outputs? If not, leave blank, otherwise provide a path (e.g. dist, lib, build, coverage) · build
✔ Does the "build:server" script create any outputs? If not, leave blank, otherwise provide a path (e.g. dist, lib, build, coverage) · server-build
✔ Does the "lint" script create any outputs? If not, leave blank, otherwise provide a path (e.g. dist, lib, build, coverage) ·
✔ Does the "coverage" script create any outputs? If not, leave blank, otherwise provide a path (e.g. dist, lib, build, coverage) ·
✔ Does the "test:e2e:run" script create any outputs? If not, leave blank, otherwise provide a path (e.g. dist, lib, build, coverage) · playwright-report
✔ Does the "typecheck" script create any outputs? If not, leave blank, otherwise provide a path (e.g. dist, lib, build, coverage) ·
✔ Would you like remote caching to make your build faster? · skip

 ...

 NX   👀 Explore Your Workspace

Run "nx graph" to show the graph of the workspace. It will show tasks that you can run with Nx.
Read this guide on exploring your workspace: https://nx.dev/features/explore-graph
```

## Caching Pre-configured

Nx has been configured to run the tasks we listed in the initialization script. You can run a single task like this:

```shell {% path="~/epic-web-app" %}
npx nx typecheck
```

During the `init` script, Nx also configured caching for these tasks. You can see in the `nx.json` file that the `cache` and `outputs` properties have been set for the tasks that we specified.

```json {% fileName="nx.json" %}
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "targetDefaults": {
    "build:icons": {
      "outputs": ["{projectRoot}/app/components/ui/icons"],
      "cache": true
    },
    "build:remix": {
      "outputs": ["{projectRoot}/build"],
      "cache": true
    },
    "build:server": {
      "outputs": ["{projectRoot}/server-build"],
      "cache": true
    },
    "test:e2e:run": {
      "outputs": ["{projectRoot}/playwright-report"],
      "cache": true
    },
    "lint": {
      "cache": true
    },
    "coverage": {
      "cache": true
    },
    "typecheck": {
      "cache": true
    }
  },
  "defaultBase": "main"
}
```

Try running `typecheck` a second time:

```shell {% path="~/epic-web-app" %}
npx nx typecheck
```

The first time `nx typecheck` was run, it took about 4 seconds - just like running `npm run typecheck`. But the second time you run `nx typecheck`, it completes instantly and displays this message:

```text
Nx read the output from the cache instead of running the command for 1 out of 1 tasks.
```

You can see the same caching behavior working when you run `npx nx lint` or `npx nx test:e2e:run`.

```shell {% path="~/epic-web-app" %}
npx nx lint
npx nx test:e2e:run
```

The initialization script also added `nx exec --` to all the `package.json` scripts that are cacheable. This allows Nx to cache those scripts even if you execute them using `npm run typecheck` or `npm run lint`.

## Use Nx Plugins to Enhance Playwright Tasks with Caching

You may have noticed that `test:e2e:run` created a `playwright-report` folder and a `test-results` folder. But we only specified `playwright-report` in the `outputs` property. Let's examine why this is a problem. Delete the `playwright-report` and `test-results` folders and then re-run `test:e2e:run`.

```shell {% path="~/epic-web-app" %}
npx nx test:e2e:run
```

This replays the task from the cache and it recreates the `playwright-report` folder, but it doesn't recreate the `test-results` folder. We can fix this by updating the settings in the `nx.json` file.

```json {% fileName="nx.json" %}
{
  "targetDefaults": {
    // ...
    "test:e2e:run": {
      "outputs": [
        "{projectRoot}/playwright-report",
        "{projectRoot}/test-results"
      ],
      "cache": true
    }
    // ...
  }
}
```

Now you can delete the `playwright-report` and `test-results` folders and re-run `test:e2e:run` again. This time, both folders will be recreated.

```shell {% path="~/epic-web-app" %}
npx nx test:e2e:run
```

There is still a problem with this set up. The `outputs` property is currently hard-coded in the `nx.json` file. If someone were to set the `outputDir` property in `playwright.config.ts` file, they would need to also update the `outputs` property for `test:run:e2e` to match. This is where [Nx plugins](/concepts/nx-plugins) can help. They directly infer information from the actual tooling configuration files (`playwright.config.ts` in this case).

First, let's delete the `outputs` array from `nx.json` so that we don't override the inferred values from the plugin. Your `nx.json` should look like this:

```json {% fileName="nx.json" %}
{
  "targetDefaults": {
    // ...
    "test:e2e:run": {
      "cache": true
    }
    // ...
  }
}
```

Now let's add the `@nx/playwright` plugin:

```{% command="npx nx add @nx/playwright" path="~/epic-web-app" %}
✔ Installing @nx/playwright...
✔ Initializing @nx/playwright...

 NX   Package @nx/playwright added successfully.
```

The `nx add` command installs the version of the plugin that matches your repo's Nx version and runs that plugin's initialization script. For `@nx/playwright`, the initialization script registers the plugin in the `plugins` array of `nx.json` and updates any `package.json` scripts that execute Vite related tasks. Open the project details view for the app and look at the `e2e` task.

{% callout title="Find your project name" %}
When your app was created by the `create-epic-app` script, it added a unique identifier to the name in `package.json`. Use your project name in the command below, instead of `-7d25`.
{% /callout %}

```shell {% path="~/epic-web-app" %}
npx nx show project epic-web-app-7d25 --web
```

{% project-details title="Project Details View" jsonFile="shared/tutorials/epic-web-pdv.json" %}
{% /project-details %}

If you hover over the settings for the `e2e` task, you can see where those settings come from. The `inputs` and `outputs` are defined by the `@nx/playwright` plugin from the `playwright.config.ts` file.

Now let's change where the results are output to in the `playwright.config.ts` file.

```ts {% fileName="playwright.config.ts" highlightLines=[8] %}
import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

const PORT = process.env.PORT || '3000';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './playwright.local.test-results',
  timeout: 15 * 1000,
  // ...
});
```

Now if you look at the project details view again, you'll see that the `outputs` property for Nx's caching has been updated to stay in sync with the setting in the `playwright.config.ts` file.

You can also add the `@nx/remix`, `@nx/vite` and `@nx/eslint` plugins to see how they infer their respective tasks based on the tooling configuration files.

```shell
npx nx add @nx/remix
npx nx add @nx/vite
npx nx add @nx/eslint
```

## E2E Task Splitting

You may have noticed that the project details view shows individual tasks for each Playwright test file. The `@nx/playwright` plugin [automatically created those tasks](/ci/features/split-e2e-tasks) for you so that they can be run in parallel. This doesn't work locally because starting multiple simultaneous dev servers will cause port conflicts. However, on CI you can automatically parallelize these tasks across multiple machines when using [Nx Agents](/ci/features/distribute-task-execution).

For a full understanding of how Nx can improve your CI pipeline, follow the [GitHub Actions](/ci/intro/tutorials/github-actions) or [Circle CI](/ci/intro/tutorials/circle) tutorial. For this repo, using Nx Agents in CI would look like this:

```yaml {% fileName=".github/workflows/deploy.yml" %}
# ...

- name: ⬇️ Checkout repo
  uses: actions/checkout@v3

- name: Start Nx Agents
  run: npm run nx-cloud start-ci-run \
    --distribute-on="3 linux-medium-js" \
    --stop-agents-after="e2e-ci"

- name: 🏄 Copy test env vars
  run: cp .env.example .env

# ...

- name: 🎭 Playwright tests
  run: npx nx run e2e-ci --parallel=1
```

The key lines in this configuration are:

- `--distribute-on="3 linux-medium-js"`: Distribute the tasks across 3 agent machines.
- `npx nx run e2e-ci --parallel=1`: Run all the `e2e-ci` tasks, but only one at a time on a given machine.

## Configure Build Inputs

During the `init` script, we configured the cache `outputs` for the three tasks in the build process. However, the `inputs` for these tasks are set to the default, which means that the cache will be invalidated whenever any file in the repository is changed. This will guarantee that we don't accidentally use the cache when it shouldn't be used, but the cache isn't as effective as it could be.

The `build:icons` task runs the `other/build-icons.ts` script to process the contents of `other/svg-icons`. So the `inputs` for that task should look like this:

```json {% fileName="nx.json" highlightLines=["5-8"] %}
{
  "targetDefaults": {
    // ...
    "build:icons": {
      "inputs": [
        "{projectRoot}/other/build-icons.ts",
        "{projectRoot}/other/svg-icons/*"
      ],
      "outputs": ["{projectRoot}/app/components/ui/icons"],
      "cache": true
    }
    // ...
  }
}
```

The `build:remix` task uses Vite to compile the code under `/app`. Set the `inputs` for that task like this:

```json {% fileName="nx.json" highlightLines=[5] %}
{
  "targetDefaults": {
    // ...
    "build:remix": {
      "inputs": ["{projectRoot}/vite.config.ts", "{projectRoot}/app/**/*"],
      "outputs": ["{projectRoot}/app/components/ui/icons"],
      "cache": true
    }
    // ...
  }
}
```

The `build:server` task runs the `other/build-server.ts` script to compile the code in the `server` folder. Set the `inputs` for that task like this:

```json {% fileName="nx.json" highlightLines=["5-8"] %}
{
  "targetDefaults": {
    // ...
    "build:server": {
      "inputs": [
        "{projectRoot}/other/build-server",
        "{projectRoot}/server/**/*"
      ],
      "outputs": ["{projectRoot}/app/components/ui/icons"],
      "cache": true
    }
    // ...
  }
}
```

Make sure the cache is primed for all of these tasks by running them once:

```shell {% path="~/epic-web-app" %}
npx nx build:icons
npx nx build:remix
npx nx build:server
```

Now let's make a small change to the `build-server.ts` file:

```ts {% fileName="other/build-server.ts"}
import path from 'path';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';
import fsExtra from 'fs-extra';
import { globSync } from 'glob';

// This comment is added to change the hash value of this file

const pkg = fsExtra.readJsonSync(path.join(process.cwd(), 'package.json'));

// ...
```

If you run `build:icons` and `build:remix`, they should still be cached:

```shell {% path="~/epic-web-app" %}
npx nx build:icons
npx nx build:remix
```

But if you run `build:server`, Nx will recognize that the inputs have changed and re-run the task:

```shell {% path="~/epic-web-app" %}
npx nx build:server
```

Fine-tuning these inputs allow us to better take advantage of the caching mechanism.

## Configure Task Pipelines

It's great that the tasks are efficiently cached, but it is currently the developers job to remember how the tasks depend on each other. A developer needs to know that they need to run `build:icons` before `build:remix` or they won't have the latest version of the icons. The `build` script manually sets up the task pipeline by running `build:icons`, `build:remix` and then `build:server`, but if someone happens to change the order of those scripts in the `package.json` file, the build will start failing for non-obvious reasons.

Nx allows you to define the dependencies of each task in the task's metadata and then Nx will determine the optimal way in which to run those tasks. This means that Nx will ensure that all the dependencies of a task are run first and that any tasks that can be are run in parallel. Let's set up the build task pipeline.

The main dependency that we need to define is that `build:remix` depends on the `build:icons` task. We can define that in the `nx.json` file like this:

```json {% fileName="nx.json" highlightLines=[5] %}
{
  "targetDefaults": {
    // ...
    "build:remix": {
      "dependsOn": ["build:icons"],
      "inputs": ["{projectRoot}/vite.config.ts", "{projectRoot}/app/**/*"],
      "outputs": ["{projectRoot}/app/components/ui/icons"],
      "cache": true
    }
    // ...
  }
}
```

Now when you run `build:remix` the `build:icons` task will be run first:

```shell {% path="~/epic-web-app" %}
npx nx build:remix
```

Let's also update the `build` script. The `build` script itself doesn't do anything. It's only purpose is to trigger other scripts. We'll modify the script to just echo a message in the terminal, and then configure Nx to trigger the other tasks.

First, update the `package.json` file:

```json {% fileName="package.json" highlightLines=[4] %}
{
  "scripts": {
    // ...
    "build": "nx exec -- echo 'Build complete'"
    // ...
  }
}
```

We added the `nx exec --` text so that the task dependencies are executed even if you run the build with `npm run build`.

Next, add an entry for `build` in the `nx.json` file:

```json {% fileName="nx.json" highlightLines=[5] %}
{
  "targetDefaults": {
    // ...
    "build": {
      "dependsOn": ["build:remix", "build:server"]
    }
    // ...
  }
}
```

Note that the `build` task does not need to depend on the `build:icons` task because the `build:remix` task already depends on it. Now run the `build` task.

```shell {% path="~/epic-web-app" %}
npx nx build
```

This will run the `build:server` task in parallel with the `build:icons` and `build:remix` tasks, allowing you to complete the tasks in the fastest time possible will still preserving the task dependency order. As your codebase grows, it becomes increasingly useful to have a tool like Nx keep track of the task dependencies rather than force your developers to keep that knowledge as mental overhead while they're coding.

## Summary

After following this tutorial, the repository is still using all the same tools to run tasks, but now Nx runs those tasks in a smarter way. The tasks are efficiently cached so that there is no repeated work and the cache configuration settings are automatically synced with your tooling configuration files by Nx plugins. Also, any task dependencies are automatically executed whenever needed because we configured task pipelines for the projects.

You can visualize the task graph for the `build` task by running `nx graph` and choosing "Tasks" from the drop down menu in the top left:

```shell
npx nx graph
```

{% graph height="200px" title="Build Task Pipeline" type="task" jsonFile="shared/tutorials/epic-web-build-tasks.json" %}
{% /graph %}

## Setup CI for Your Epic Web App

This tutorial walked you through how Nx can improve the developer experience for local development, but Nx can also make a big difference in CI. Without adequate tooling, CI times tend to grow exponentially with the size of the codebase. Nx helps reduce wasted time in CI with the [`affected` command](/ci/features/affected) and Nx Replay's [remote caching](/ci/features/remote-cache). Nx also [efficiently parallelizes tasks across machines](/ci/concepts/parallelization-distribution) with Nx Agents.

To set up Nx Replay run:

```shell
nx connect
```

And click the link provided. You'll need to follow the instructions on the website to sign up for your account.

Then you can set up your CI with the following command:

```shell
nx generate ci-workflow --ci=github
```

{% callout type="note" title="Choose your CI provider" %}
You can choose `github`, `circleci`, `azure`, `bitbucket-pipelines`, or `gitlab` for the `ci` flag.
{% /callout %}

This will create a default CI configuration that sets up Nx Cloud to [use distributed task execution](/ci/features/distribute-task-execution). This automatically runs all tasks on separate machines in parallel wherever possible, without requiring you to manually coordinate copying the output from one machine to another.

Check out one of these detailed tutorials on setting up CI with Nx:

- [Circle CI with Nx](/ci/intro/tutorials/circle)
- [GitHub Actions with Nx](/ci/intro/tutorials/github-actions)

## Next Steps

Connect with the rest of the Nx community with these resources:

- [Join the Official Nx Discord Server](https://go.nx.dev/community) to ask questions and find out the latest news about Nx.
- [Follow Nx on Twitter](https://twitter.com/nxdevtools) to stay up to date with Nx news
- [Read our Nx blog](https://blog.nrwl.io/)
- [Subscribe to our Youtube channel](https://www.youtube.com/@nxdevtools) for demos and Nx insights
