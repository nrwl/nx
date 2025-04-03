---
title: 'Cacheable Operations'
description: 'Learn about the transition from cacheableOperations array to the cache property in Nx 17 for defining which tasks are cacheable.'
---

# cacheableOperations

In Nx < 17, the way to define which tasks were cacheable was to add the task name to the `cacheableOperations` array in `nx.json`. This way of defining cacheable tasks required all tasks named `test` to be either cacheable or not cacheable.

In Nx 17, use the `cache` property in `targetDefaults` or individual target definitions in the project level configuration.
