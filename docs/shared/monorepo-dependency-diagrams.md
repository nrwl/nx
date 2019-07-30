# Analyzing & Visualizing Workspaces

To be able to support the monorepo-style development, the tools must know how different projects in your workspace depend on each other. Nx uses advanced code analysis to construct this dependency graph.

You can visualize it by running `nx dep-graph`.

![dependency-graph](/shared/dependency-graph.png)

You can also visualize what is affected by your change, by using the `nx affected:dep-graph` command.

![dependency-graph-affected](/shared/affected.png)
