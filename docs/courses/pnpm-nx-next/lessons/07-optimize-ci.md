---
title: 'Use Nx Commands on CI'
videoUrl: 'https://youtu.be/ywlilx9-jNk'
duration: '4:43'
---

The Tasker project already uses a CI script on GitHub Actions, but in this lesson, we’ll enhance it by replacing the existing `pnpm --filter` commands with optimized Nx commands for a more efficient CI pipeline.

We’ll cover how to scaffold a new CI configuration with:

```shell
pnpm nx g ci-workflow
```

We’ll also take a quick detour to discuss `namedInputs` in `nx.json`, ensuring the cache invalidates appropriately whenever the CI config is updated.

## Relevant Links

- [Run Only Tasks Affected by a PR](/ci/features/affected)
- [Tutorial: Github Actions with Nx](/ci/intro/tutorials/github-actions#create-a-ci-workflow)
