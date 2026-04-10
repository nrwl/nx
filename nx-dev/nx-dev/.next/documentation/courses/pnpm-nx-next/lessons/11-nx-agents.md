---
title: 'Speed Up CI by Running Tasks in Parallel on Different Machines'
videoUrl: 'https://youtu.be/lO_p4tA6IZI'
duration: '2:08'
---

While remote caching is powerful, it may not be enough when core packages change frequently, invalidating the cache for large portions of your workspace.

Nx Cloud comes with a built-in feature called [Nx Agents](/ci/features/distribute-task-execution) that allows to automatically distribute tasks across multiple machines.

In this lesson we're going to update the existing CI configuration to enable Nx Agents. Which mostly can be done by adding the following line:

```plaintext
nx-cloud start-ci-run --distribute-on="5 linux-medium-js"
```

## Relevant Links

- [Distribute Task Execution](/ci/features/distribute-task-execution)
