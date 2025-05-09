---
type: lesson
title: Add Nx
---

## Smart Monorepo

Nx offers many features, but at its core, it is a task runner. Out of the box, it can cache your tasks and ensure those tasks are run in the correct order. After the initial set up, you can incrementally add on other features that would be helpful in your organization.

### Add Nx

Nx is a build system with built in tooling and advanced CI capabilities. It helps you maintain and scale monorepos,
both locally and on CI. We will explore the features of Nx in this tutorial by adding it to the Gradle workspace above.

To add Nx, run

```shell no-run
npx nx@latest init
```

This command will download the latest version of Nx and help set up your repository to take advantage of it. Nx will
also detect Gradle is used in the repo so it will propose adding the `@nx/gradle` plugin to integrate Gradle with Nx.
Select the plugin and continue with the setup.

Similar to Gradle, Nx can be run with the `nx` or `nx.bat` executables. We will learn about some of the Nx commands in
the following sections.
