# Angular Nx Tutorial - Step 9: Using the Depedency Graph

<iframe width="560" height="315" src="https://www.youtube.com/embed/8fr2RukmfW0" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe>

An Nx workspace can contain dozens or hundreds of applications and libraries. As a codebase grows, it becomes more difficult to understand how they depend on each other and the implications of making a particular change.

Previously, some senior architect would create an ad-hoc dependency diagram and upload it to a corporate wiki. The diagram is not correct even on Day 1 and gets more and more out of sync with every passing day.

With Nx, you can do better than that.

Run the command to see the dependency graph for your workspace.

```sh
npx nx dep-graph
```

## What's Next

- Continue to [Step 10: Using Computation Caching](/angular-tutorial/10-computation-caching)
