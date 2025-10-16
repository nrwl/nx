---
title: 'Nx Highlights: Smarter AI integration, all-new graph UI, and big new versions of your favorite tools'
slug: nx-highlights-oct-2025
cover_image: /blog/images/2025-10-10/header.avif
authors: ['Philip Fulcher']
tags: ['nx', 'release']
description: 'Catch up on the latest Nx highlights including AI agent configuration, improved Terminal UI, Vite 7 support, and enhanced testing workflows'
---

Time moves fast in the Nx ecosystem! Since the Nx 21 release, we've shipped several updates packed with features that make your monorepo experience even better. Let's walk through the highlights from the last month.

{% toc /%}

## A quick note on versions

21.5.0 and 21.6.0 were both published containing malware as part of the [S1ngularity attack](/blog/s1ngularity-postmortem). The compromised versions were removed from npm, and we skipped publishing those versions again to reduce confusion. You can safely start using 21.5.1 and greater for 21.5 and 21.6.1 and greater for 21.6.

## Configuring AI agents gets even easier

{% youtube src="https://www.youtube.com/watch?v=8gdvIz2r_QM" title="How To Set Up AI Agents in Nx Super Fast!" /%}

![Screenshot showing the output of the `configure-ai-agents` command](/blog/images/2025-10-10/configure-ai-agents.avif)

You've got a lot of choices of AI agents, and we want to make sure you get the most out of Nx with them. New workspaces created with `create-nx-workspace` now automatically include AI configuration files that help tools like Cursor and Copilot understand your project structure. But what about existing workspaces? We've got you covered.

Introducing the new `configure-ai-agents` command:

```shell
nx configure-ai-agents
```

This command [sets up your workspace](/docs/getting-started/ai-setup#automatic-ai-setup) with the necessary configuration files so AI assistants can leverage Nx's deep understanding of your monorepo's project relationships, dependencies, and tasks. Your AI coding assistant gets instant access to the bigger picture, moving beyond simple file edits to understand how your entire codebase fits together.

[Learn more about enhancing AI assistants with Nx](/features/enhance-AI)

## Enhanced graph UI and controls

![Screenshot of the new graph ui](/blog/images/2025-10-10/new-graph.avif)

We've significantly improved the graph experience with a redesigned control panel and interface. The new floating controls panel makes it easier to discover all the visualization options available to you. All graph-related controls are now centralized in one place, with better state synchronization and URL state management. You can easily switch between different layout directions (top-bottom, left-right, and more), toggle between composite and flat views, and filter projects based on what's currently rendered.

The graph renders in composite mode by default, which provides two key benefits: it looks cleaner and prevents crashes when visualizing large workspaces. For workspaces with thousands of projects, the composite mode makes the graph usable again!

The workflow for exploring your graph has been streamlined too. Left-click to select a project and open the details panel. When you start tracing dependencies between projects, the UI intelligently shows you a list of traceable projects, so you don't have to hunt through the visualization. Click on edges to navigate between connected projects, making it easier to understand how your workspace fits together.

[Explore the project graph documentation](/features/explore-graph)

## Terminal UI improvements

![Terminal UI task list interface](/blog/images/2025-10-10/tui.avif)

The Terminal UI introduced in Nx 21 keeps getting better. We've replaced pagination with smooth scrolling in the tasks list, making it easier to navigate through multiple running tasks without navigating pages.

We've also refined the visual experience with improved title styling when panels are focused, better handling of placeholder entries when filtering tasks, and preventing unwanted scrolling when interacting with the task list. These are small tweaks, but they add up to a much more polished experience when you're running continuous tasks or managing complex pipelines.

## Merging atomized Playwright test results

Atomized tests help lower your [Time to Green](/docs/guides/nx-cloud/optimize-your-ttg) by running more in parallel during CI, but they do come with one downside: your test logs are now split over multiple task results. To simplify this, Nx can now merge the results of atomized tests so you get the best of both worlds.

For [Playwright users](/technologies/test-tools/playwright/recipes/merge-atomized-outputs), Nx now automatically infers a new task (`e2e-ci--merge-reports`) to merge reports from atomized test runs. This means you can split your test suite across multiple machines for faster CI runs, and Nx handles combining the results for you.

These improvements make it easier to scale your test suites without sacrificing the detailed reporting you need. We're working on guidance for other testing tools that provide atomized tests, stay tuned for more.

[Learn more about atomizing tasks](/ci/features/split-e2e-tasks)

## **BREAKING CHANGE:** Webpack SVGR changes

The `svgr` option has been removed from the `withReact` webpack configuration function. If you're using SVGR in your React applications, you'll need to use the new `withSvgr` composable function instead:

```javascript
const { composePlugins, withNx, withReact, withSvgr } = require('@nx/webpack');

module.exports = composePlugins(withNx(), withReact(), withSvgr(), (config) => {
  // Further customize webpack config
  return config;
});
```

This change provides better composability and makes it easier to opt into SVGR support when you need it. The `@nx/rspack` plugin has also marked SVGR support as deprecated, so if you're using Rspack, plan accordingly.

## Angular 20.3 support

Nx 21.6.1 brings support for Angular 20.3, ensuring you have access to the latest Angular features and improvements in your Nx workspace.

Remember that you can always migrate to the latest version of Nx while maintaining your current Angular version using the `--interactive` flag during migration. This gives you the flexibility to upgrade on your own schedule.

```shell
nx migrate latest --interactive
```

[See our Angular version matrix for compatibility details](/technologies/angular/recipes/angular-nx-version-matrix)

## Vite 7 support

Staying current with the JavaScript ecosystem is crucial, and we're excited to announce that `@nx/vite` now supports Vite 7. This allows you to take advantage of the latest Vite features and improvements while maintaining the task orchestration and caching that Nx provides.

Whether you're building React, Vue, or vanilla JavaScript applications, you can now leverage Vite 7's performance improvements in your Nx workspace. Simply upgrade to the latest version of Nx to get started.

[Check out our Vite plugin documentation](/technologies/build-tools/vite/introduction)

## Gradle performance improvements

For Java developers using Gradle, these releases bring significant performance improvements. We've enhanced how Nx determines project dependencies by using project configurations, which results in more accurate dependency graphs and faster task execution.

The `@nx/gradle` plugin now also supports custom test targets, giving you more flexibility in how you structure your Java projects within your Nx workspace.

[Explore the Gradle plugin](/technologies/java/introduction)

## Nx 22 coming soon

This might seem like a lot already, but the best is yet to come: Nx 22 is releasing soon! 22.0 will mostly be a stability release, focused on removing previously deprecated items. But 22.1 and beyond promises big expansion to our backend technology support while also making TypeScript better than ever. You won't want to miss it, make sure you're [plugged into our community](/community) to catch all the news!

## Update today

As always, updating to the latest version of Nx is straightforward:

```shell
nx migrate latest
```

After updating your dependencies, run any necessary migrations:

```shell
nx migrate --run-migrations
```

Or use the [Migrate UI in Nx Console](/recipes/nx-console/console-migrate-ui) for a more visual migration experience.

## What's next

These updates set the stage for even more improvements coming to Nx. Keep an eye on our [socials](/community) and [YouTube channel](https://www.youtube.com/@nxdevtools) for what's coming next.

Learn more:

- 🧠 [Nx AI Docs](/features/enhance-AI)
- 🌩️ [Nx Cloud](/nx-cloud)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 👩‍💻 [Nx Console GitHub](https://github.com/nrwl/nx-console)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
