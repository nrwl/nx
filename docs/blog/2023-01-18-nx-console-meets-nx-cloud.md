---
title: 'Nx Console meets Nx Cloud'
slug: 'nx-console-meets-nx-cloud'
authors: ['Max Kless']
cover_image: '/blog/images/2023-01-18/1*Mkqkadhkk7DydWvPg5L0bA.png'
tags: [nx]
---

We just released Nx Console 17.28.0 and it comes with a huge new feature: Nx Cloud Integration, right in VSCode! 🎉

In case you’re not sure what it does, Nx Cloud takes your Nx workspace to the next level with awesome features like:

- **Remote Caching** — share your Nx cache with your coworkers and CI agents. By using Nx Cloud, you can be sure that no computation is done twice — throughout your company.
- **Distributed Task Execution** — the most important feature for truly scaling up repositories. Nx already knows about your project graph and what tasks depend on each other. With Nx Cloud, you can leverage this knowledge to distribute tasks smartly across multiple agents while making sure that everything is run in the correct sequence. This can speed up your CI times by orders of magnitude!
- **VCS \[version control system\]** **Integration** — see the results of your CI runs right on your pull request! Nx Cloud can talk to GitHub and other version control systems in real-time, giving you an overview of successes and failures as they happen.

And the best part? It’s free! You won’t pay anything for the first 500 hours of computation time saved per month. If you exceed 500 hours of computation saved, you can buy more; in the worst case, caching stops until the next month. For open-source projects, it’s free even beyond that. 😍

Head over to [http://nx.dev/nx-cloud](/nx-cloud) to learn more.

**Prefer a video walkthrough? Here we go**

{% youtube src="https://www.youtube.com/watch?v=WfWmK1x52HE" /%}

## Show me the new features already!

Now that we’re caught up, let’s look at how Nx Console will make connecting to and working with Nx Cloud even easier.

To follow along, ensure you have installed the latest Nx Console version:  
[Nx Console — Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=nrwl.angular-console)

In the Nx sidebar, you will see a new Nx Cloud section.

![](/blog/images/2023-01-18/1*JHNQd88EKmPVfnWBRqSidQ.avif)

If your workspace is not using Nx Cloud, click the “Set up Nx Cloud” button to set up the cloud runner automatically.

You will see that some changes happen in your `nx.json`:

```
"default": {
- "runner": "nx/tasks-runners/default",
+ "runner": "@nrwl/nx-cloud",
  "options": {
+   "accessToken": "NDM2MmU2YmUtNDFl…ifHJlYWQtd3JpdGU=",
    "cacheableOperations": [
      "build",
      "lint",
      "test",
      "e2e"
    ],
   }
 }
```

**That’s it. You can now use Remote Caching and Distributed Task Execution (DTE). 🎉**

## Running your first task

Let’s try it out! Select a task to run and see the results in the run list. You can get an even more detailed breakdown in the Nx Cloud web app.

![](/blog/images/2023-01-18/1*hFG4lqGwEYV3imSFATeKog.avif)

If you rerun the same task, you can see that the time it took to complete is under a second. This is because of Nx’s [advanced computation caching](/features/cache-task-results). Whenever a task is executed, Nx caches it. If the task has been run before, it just restores the result from the cache. By default, this cache is local to your own workstation. However, with Nx Cloud, you can distribute and share it between machines.

![](/blog/images/2023-01-18/1*kMKh30ojVJC-hSkZA5c46A.avif)

To see it in action, push your newly created access token and have a coworker (or CI pipeline) run a task on their machine. If you execute that same task again, it will be pulled from the cache just like it did locally! 🔮

![](/blog/images/2023-01-18/1*DkuIHQ6engBhAyhN1TTUGQ.avif)

To learn more about Nx Cloud access tokens, head over to the docs: [Access Tokens Documentation](/ci/recipes/security/access-tokens).

## Claiming your workspace

If you’ve just started using Nx Cloud, you will probably see this message prompting you to claim your workspace:

![](/blog/images/2023-01-18/1*vNRM1u3J5dixcXjoJWkHLQ.avif)

Out of the box, Nx Cloud works without the need to register. It is, however, highly recommended to create an account and associate it with your workspace. This process is called _claiming your workspace_ and has become much easier with Nx Console! After claiming, you can take full control of your cloud workspace, manage access restrictions and other settings.

Just click on ‘Login and claim your workspace’ to be redirected to the browser where you can sign in to Nx Cloud or create an account. After successful authentication, you will come back to VSCode, where you can select one of your organizations and connect your workspace to it.

From now on, Nx Console will be able to make authenticated requests to the cloud API, so even if you choose to make your workspace private, logged-in users that are authorized to access it can do so.

## Distributed Task Execution

Distributed Task Execution (DTE) becomes very important as your workspace grows. With Nx, powerful features like [computation caching](http://√) and [affected analysis](/ci/features/affected) help you drastically cut down your CI times. Most of the time, large parts of your codebase will not need to be rebuilt and retested. However, we also have to consider the worst-case-scenarios. Let’s say you do change a core lib that everything in your monorepo depends on. This could mean hundreds or even thousands of projects needing to be rebuilt and retested, which would mean hours of CI time. This is obviously very impractical and you should consider solutions that allow you to parallelize all this work and keep worst-case CI times at a reasonable level. [There are different approaches to achieving this](/ci/concepts/parallelization-distribution) but it’s hard to get right and not something most teams want to spend engineering resources on.

![](/blog/images/2023-01-18/1*EZhpRG2t-vp8Y7pGNnuRpA.avif)

Distributed Task Execution with Nx Cloud solves this issue — it allows you to optimally parallelize tasks without thinking about their interdependencies or agent management. You don’t have to use it immediately, but it’s useful if you want to keep your CI times low even as your workspace grows. 🚀

DTE is available for all Nx Cloud workspaces with minimal setup. If you see a yellow DTE status in Nx Console, that just means you haven’t used it yet. [Check out the docs](/ci/features/distribute-task-execution) to [learn more about the motivation for DTE](/ci/concepts/parallelization-distribution) and [how to test it out in your workspace](/ci/features/distribute-task-execution).

![](/blog/images/2023-01-18/1*T-GAMsmUCVVeO2ZCGuO3WA.avif)

## VCS Integration

Nx Cloud isn’t just great for its remote caching and DTE features, it also generates readable and searchable reports for any executed tasks — whether it be 10 or 10.000. In a monorepo, your CI pipelines will seldom run just a single task. It’s more common to have commands like `nx affected — -target=build` which amounts to “rebuild everything that changed”. This could potentially be dozens, hundreds or thousands of tasks. If something goes wrong, combing through thousands upon thousands of lines of logs quickly becomes tedious. So having a nicely structured, per-target view that you can filter and sort while still preserving all terminal styling is incredibly useful!

![](/blog/images/2023-01-18/1*i-eyF1ED2_mBkB1A_4piqg.avif)

To take advantage of this valuable information without changing your development workflow, use the Nx Cloud integration for your favourite platform: Github, GitLab or Bitbucket Cloud. You can see the results of your cloud runs in a PR comment with an overview of failed tasks and links to easily readable outputs. No more scrolling through endless logs until you find what you need!

![](/blog/images/2023-01-18/1*UPAL-352xTPsm-Pf_7sROw.avif)

To set it up, just click on the button in the Nx Console cloud view and follow the prompts in your browser. Read more in the [full guide on connecting your workspace to](/ci/recipes/set-up/monorepo-ci-github-actions) VCS.

## Learn more

- 🧠 [Nx Docs](/getting-started/intro)
- 👩‍💻 [Nx GitHub](<[https://github.com/nrwl/nx](https://github.com/nrwl/nx)>)
- 🎮 [Nx Console GitHub](<[https://github.com/nrwl/nx-console](https://github.com/nrwl/nx-console)>)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](<[https://www.youtube.com/@nxdevtools](https://www.youtube.com/@nxdevtools)>)
