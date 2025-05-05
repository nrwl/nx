---
type: lesson
title: Create a Task Pipeline
focus: /nx.json
---

# Create a Task Pipeline

<!-- {% video-link link="https://youtu.be/ZA9K4iT3ANc?t=450" /%} -->

You may have noticed in the `packages/zoo/package.json` file, there is a `serve` script that expects the `build` task to already have created the `dist` folder. Let's set up a task pipeline that will guarantee that the project's `build` task has been run.

```solution:/nx.json title="nx.json" {4-6} collapse={2,7-14}

```

The `serve` target's `dependsOn` line makes Nx run the `build` task for the current project before running the current project's `build` task.

Now `nx serve` will run the `build` task before running the `serve` task.

```shell
nx serve zoo
```
