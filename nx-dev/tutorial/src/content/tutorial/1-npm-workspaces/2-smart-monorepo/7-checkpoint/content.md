---
type: lesson
title: Checkpoint
previews:
  - {
      port: 4211,
      title: 'Nx Graph',
      pathname: 'tasks/serve?projects=%40tuskdesign%2Fzoo',
    }
---

## Checkpoint

At this point, the repository is still using all the same tools to run tasks, but now Nx runs those tasks in a smarter way. The tasks are efficiently cached so that there is no repeated work and the cache configuration settings are automatically synced with your tooling configuration files by Nx plugins. Also, any task dependencies are automatically executed whenever needed because we configured task pipelines for the projects.

Open up the task graph for `zoo` app's `serve` task again to see the changes.

```shell {% path="~/tuskydesigns" %}
npx nx run @tuskdesign/zoo:serve --graph
```
