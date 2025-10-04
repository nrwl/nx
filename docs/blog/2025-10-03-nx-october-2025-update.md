---

title: Nx 21.5 & 21.6: Smarter AI integration, all-new graph UI, and big new versions of your favorite tools

slug: nx-21-5-21-6-updates

authors: ['Philip Fulcher']

tags: ['nx', 'release']

description: Catch up on the latest Nx updates including AI agent configuration, improved Terminal UI, Vite 7 support, and enhanced testing workflows

---

Time moves fast in the Nx ecosystem! Since the Nx 21 release, we've shipped several updates packed with features that make your monorepo experience even better. Let's walk through the highlights from Nx 21.5 and 21.6.

{% toc /%}

## Configuring AI agents gets even easier

You've got a lot of choices of AI agents, and we want to make sure you get the most out of Nx with them. New workspaces created with `create-nx-workspace` now automatically include AI configuration files that help tools like Cursor and Copilot understand your project structure. But what about existing workspaces? We've got you covered.

Introducing the new `configure-ai-agents` command:

```shell
nx configure-ai-agents
```

This command sets up your workspace with the necessary configuration files so AI assistants can leverage Nx's deep understanding of your monorepo's project relationships, dependencies, and tasks. Your AI coding assistant gets instant access to the bigger picture, moving beyond simple file edits to understand how your entire codebase fits together.

[Learn more about enhancing AI assistants with Nx](/features/enhance-AI)

**Suggested screenshot:** Terminal output showing the `nx configure-ai-agents` command being run, with a before/after view of the generated configuration files in the workspace.

## Terminal UI improvements

![Terminal UI task list interface](/blog/images/placeholder-tui-scrolling.avif)

The Terminal UI introduced in Nx 21 keeps getting better. We've replaced pagination with smooth scrolling in the tasks list, making it easier to navigate through multiple running tasks without the interruption of clicking through pages.

We've also refined the visual experience with improved title styling when panels are focused, better handling of placeholder entries when filtering tasks, and preventing unwanted scrolling when interacting with the task list. These might seem like small tweaks, but they add up to a much more polished experience when you're running continuous tasks or managing complex pipelines.

**Suggested screenshot:** Side-by-side comparison of the old paginated task list vs. the new scrolling interface, highlighting the smoother navigation experience.

## Vite 7 support

Staying current with the JavaScript ecosystem is crucial, and we're excited to announce that `@nx/vite` now supports Vite 7. This allows you to take advantage of the latest Vite features and improvements while maintaining the powerful task orchestration and caching that Nx provides.

Whether you're building React, Vue, or vanilla JavaScript applications, you can now leverage Vite 7's performance improvements in your Nx workspace. Simply upgrade to the latest version of Nx to get started.

[Check out our Vite plugin documentation](/technologies/vite/introduction)

## Enhanced testing workflows

Testing in Nx workspaces just got more powerful with several improvements to how Playwright and Cypress handle atomized tests.

For Playwright users, Nx now automatically infers a task to merge reports from atomized test runs. This means you can split your test suite across multiple machines for faster CI runs, and Nx handles combining the results for you.

Cypress users get similar benefits with new support for inferring atomized tasks for component tests. Plus, the new `e2e-ci` task automatically forwards options to atomized tasks, giving you more control over how your tests run in CI environments.

These improvements make it easier to scale your test suites without sacrificing the detailed reporting you need.

[Learn more about atomizing tasks](/concepts/atomized-tasks)

**Suggested screenshot:** A task graph visualization showing how atomized test tasks run in parallel and then merge results into a single report.

## Angular 20.3 support

We continue to keep pace with the Angular team's releases. Nx 21.6 brings support for Angular 20.3, ensuring you have access to the latest Angular features and improvements in your Nx workspace.

Remember that you can always migrate to the latest version of Nx while maintaining your current Angular version using the `--interactive` flag during migration. This gives you the flexibility to upgrade on your own schedule.

```shell
nx migrate latest --interactive
```

[See our Angular version matrix for compatibility details](/technologies/angular/recipes/angular-nx-version-matrix)

## Task graph supports multiple targets

The task graph visualization now supports viewing multiple targets simultaneously. This enhancement makes it easier to understand complex task pipelines, especially when you're working with continuous tasks that depend on multiple services running in parallel.

You can now see how your frontend `dev` task, backend `serve` task, and any code generation tasks in watch mode all fit together in a single view. This visibility is invaluable when debugging task orchestration or optimizing your development workflows.

**Suggested screenshot:** A task graph showing multiple targets running simultaneously with their dependencies clearly visualized.

## Enhanced graph UI and controls

We've significantly improved the graph experience with a redesigned control panel and interface. The new floating controls panel opens by default, making it easier to discover all the powerful visualization options available to you.

The graph now renders in composite mode by default, which provides two key benefits: it looks cleaner and prevents crashes when visualizing large workspaces. For workspaces with thousands of projects, the virtualized project list ensures smooth performance even at scale.

All graph-related controls are now centralized in one place, with better state synchronization and URL state management. You can easily switch between different layout directions (top-bottom, left-right, and more), toggle between composite and flat views, and filter projects based on what's currently rendered.

The workflow for exploring your graph has been streamlined too. Left-click to select a project and open the details panel, or right-click for quick actions via context menu. When you start tracing dependencies between projects, the UI intelligently shows you a list of traceable projects, so you don't have to hunt through the visualization. Click on edges to navigate between connected projects, making it easier to understand how your workspace fits together.

[Explore the project graph documentation](/concepts/project-graph)

**Suggested screenshot:** The new graph interface showing the floating controls panel with options for layout direction, view modes, and filtering, alongside a project graph with nodes in composite mode.

**Suggested screenshot:** The unified graph UI showing the new control panel with rank direction options.

## Release versioning enhancements

For teams using `nx release`, there's a new option that gives you more control over dependency version ranges. The `preserveMatchingDependencyRanges` option ensures that matching version ranges aren't automatically updated during releases.

This is particularly useful when you have specific version range requirements in your workspace and want to maintain them across releases. It's another example of how Nx gives you the flexibility to adapt release processes to your team's specific needs.

[Learn about configuring Nx release](/recipes/nx-release/updating-version-references)

## TypeScript project improvements

For workspaces using TypeScript project references, we've made several quality-of-life improvements. Duplicate typechecks have been eliminated for buildable libraries, and the `@nx/js/typescript` plugin now detects duplicate project references to help you avoid configuration issues.

We've also added a new environment variable, `NX_PROJECT_ROOT`, to runtime cache inputs. This helps ensure cache accuracy when you're working with projects that depend on their location in the workspace.

## BREAKING CHANGE: Webpack SVGR changes

The `svgr` option has been removed from the `withReact` webpack configuration function. If you're using SVGR in your React applications, you'll need to use the new `withSvgr` composable function instead:

```javascript
const { composePlugins, withNx, withReact, withSvgr } = require('@nx/webpack');

module.exports = composePlugins(withNx(), withReact(), withSvgr(), (config) => {
  // Further customize webpack config
  return config;
});
```

This change provides better composability and makes it easier to opt into SVGR support when you need it. The `@nx/rspack` plugin has also marked SVGR support as deprecated, so if you're using Rspack, plan accordingly.

[See the Webpack plugin documentation for migration guidance](/technologies/webpack/introduction)

## Gradle performance improvements

For Java developers using Gradle, these releases bring significant performance improvements. We've enhanced how Nx determines project dependencies by using project configurations, which results in more accurate dependency graphs and faster task execution.

The `@nx/gradle` plugin now also supports custom test targets, giving you more flexibility in how you structure your Java projects within your Nx workspace.

[Explore the Gradle plugin](/technologies/java/introduction)

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
