---
title: 'Run Playwright E2E Tests Faster by Parallelizing Them on CI'
videoUrl: 'https://youtu.be/42XnmzxEXM8'
duration: '5:47'
---

Running e2e tests on CI can be quite a painful experience. You want them to run on each PR to get immediate feedback, but then you don't want to wait for 30 minutes.

In this lesson, we'll optimize the existing Playwright end-to-end tests that currently take up to 20 minutes on CI. We'll leverage the Nx Playwright plugin to automatically split the Playwright tests into individual runs per test, allowing for optimal distribution across Nx agents and significantly improving CI execution time.

![](/courses/pnpm-nx-next/images/e2e-splitting-anim.gif)

## Relevant Links

- [Automatically Split E2E Tasks](/docs/features/ci-features/split-e2e-tasks)
