# React Nx Tutorial - Step 9: Dep Graph

<iframe width="560" height="315" src="https://www.youtube.com/embed/Dr7jI9RYcmY" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe>

An Nx workspace can contain dozens or hundreds of applications and libraries. As a codebase grows, it can be difficult to understand how they depend on each other and the implications of making a particular change.

Previously, some senior architect would create an ad-hoc dependency diagram and upload it to a corporate wiki. The diagram is not correct even on Day 1 and gets more and more out of sync with every passing day.

With Nx, you can do better than that.

Run

```bash
npx nx dep-graph
```

The dependency graph page opens in a new browser window. Click on "Show all projects" to see all the apps and libraries in the workspace.
