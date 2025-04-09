---
type: lesson
title: About Nx Cloud
---

## Fast CI ⚡

:::info
Make sure you have completed the previous sections of this tutorial before starting this one. If you want a clean starting point, you can download the tutorial code here:

<div class="my-5"><DownloadButton client:load></DownloadButton></div>
:::

So far in this tutorial you've seen how Nx improves the local development experience, but the biggest difference Nx makes is in CI. As repositories get bigger, making sure that the CI is fast, reliable and maintainable can get very challenging. Nx provides a solution.

- Nx reduces wasted time in CI with the [`affected` command](/ci/features/affected).
- Nx Replay's [remote caching](/ci/features/remote-cache) will reuse task artifacts from different CI executions making sure you will never run the same computation twice.
- Nx Agents [efficiently distribute tasks across machines](/ci/features/distribute-task-execution) ensuring constant CI time regardless of the repository size. The right number of machines is allocated for each PR to ensure good performance without wasting compute.
- Nx Atomizer [automatically splits](/ci/features/split-e2e-tasks) large e2e tests to distribute them across machines. Nx can also automatically [identify and rerun flaky e2e tests](/ci/features/flaky-tasks).
