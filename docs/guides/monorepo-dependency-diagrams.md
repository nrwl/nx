# Analysing & Visualizing Workspaces

To be able to support the monorepo-style development, the tools must know how different projects in your workspace depend on each other. Nx uses advanced code analysis to construct this dependency graph.

You can visualize it by running `npm run dep-graph` or `yarn dep-graph`.

![dependency-graph](./dependency-graph.png)

You can also visualize what is affected by your change, by using the `npm run affected:dep-graph` command.

![dependency-graph-affected](./affected.png)

## Angular Console

Angular Console is the UI for the Angular CLI. Since Nx is just a set of power-ups for the CLI, you can use Angular Console for Nx repositories. In particular, you can use Console to interact with the dependency diagram of the workspace. You can download Angular Console at [angularconsole.com](https://angularconsole.com).
