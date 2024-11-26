---
title: Monorepos - Why Speed Matters
slug: 'monorepos-why-speed-matters'
authors: ['Katerina Skroumpelou', 'Jeff Cross']
tags: [nx, nxdevtools, speed, ci]
cover_image: '/blog/images/2024-03-20/featured_img.png'
---

In the ever-evolving landscape of software development, efficiency and speed are vital. As projects grow in complexity, developers and teams need tools that can keep up without sacrificing quality or performance.

Nx is a suite of powerful tools designed to optimize your development workflow, which sets the [building blocks for a fast CI](/ci/concepts/building-blocks-fast-ci). Nx is always innovating in many ways to make developers’ lives easier, but this post is exclusively focused on the things Nx has done in the past year to make development faster and faster.

## Why speed matters

The ability to iterate quickly and efficiently is vital for any software project. Speed in the development process offers several critical advantages:

- **Faster feedback loops:** Quick iterations mean immediate feedback, allowing teams to adapt, learn, and improve their work on the fly.
- **Reduced time to market:** Accelerating the development process can significantly cut down the overall time to market, providing a competitive edge which reclaims revenue that would have otherwise been lost.
- **Decreased developer frustration:** [No more waiting for builds and tests to complete](/ci/concepts/reduce-waste). A streamlined workflow keeps morale high and productivity higher.

If you’re using Nx already, you’re already familiar with

- [**Affected**](/ci/features/affected) - identifying and running tasks only on projects impacted by code changes,
- [**Nx Replay**](/ci/features/remote-cache) - our powerful cache and
- [**Nx Agents**](/ci/features/distribute-task-execution) - the concept of [Parallelization and Distribution](/ci/concepts/parallelization-distribution).

But let’s see all the extra things we did this past year to make everything faster.

## Speed at the core

### Rustifying Nx

The Nx daemon has seen significant enhancements, notably through the use of Rust to calculate file hashes behind the scenes. This improvement not only speeds up the start-up times but also optimizes performance even without the daemon, especially on CI environments where the daemon isn't used. The benchmark results at [this repo](https://github.com/vsavkin/large-monorepo) showcase the remarkable speed improvements, making Nx competitive with native code solutions while maintaining the accessibility and flexibility of Node.js. Nx is still Node-first, so contributions are easier and only the most performance-critical parts of Nx are native code.

### Task Hasher and archive file innovations

The introduction of a task hasher written in Rust, alongside the use of an archive file to store workspace file hashes (`.nx/cache`), has significantly reduced the need for repetitive file system accesses. This innovation means that running multiple Nx commands in CI is much faster, as file hashing becomes unnecessary after the initial run.

**The Archive file**

The archive file is a binary file that contains the workspace file hashes with their last modified time. Every time Nx starts (ie, running `nx run project:target`) it gets all the files with their last modified time, and compares it to the archive. If the file exists in the archive, then Nx does not access the file system to read the file to hash (reading individual files is slower than just getting a list of files from a directory). So running multiple nx commands in CI is quick to start because Nx does not need to constantly hash files.

### Nx Replay

![](/blog/images/2024-03-20/bodyimg1.webp)

Nx Replay enables caching and reusing of task results. It’s our well known Nx remote cache! It allows developers to avoid re-running expensive tasks by retrieving the cached results from a remote cache. This significantly improves build and test performance, as well as developer productivity. Nx Replay is also critical to the functioning of Nx Agents, which rely on the remote cache to ensure that the results of a task will be shared with every agent that needs them. By using Nx Replay, developers can optimize their workflows and reduce the time spent waiting for tasks to complete.

With Nx Replay, you can see significant speed improvements in your CI pipelines for modified PRs. What’s also important is that if a task has been executed in CI, a developer running that same task locally can reuse the task result instead of actually running the task. So you will also see improvements locally.

### Nx Agents

![](/blog/images/2024-03-20/bodyimg2.avif)

[Nx Agents](/ci/features/distribute-task-execution) represent the pinnacle of task distribution optimization, ensuring that tasks are executed as efficiently as possible based on the specific requirements of each change. Some features that make up this effort are:

- [Easy integration with existing providers](/ci/recipes/set-up)
  - Distribution is handled on the Nx Cloud infrastructure and all you need is a single line. What’s more, all results are played back to your original CI provider script which triggers the Nx Cloud distribution, so that you can make use of the resulting artifacts
- [Efficient task distribution](/ci/features/dynamic-agents)
  - Save compute resources and reduce costs, minimizing idle time and compute waste
  - Dynamic sizing based on PR size
- [Tusky](https://nx.app/products/tusky) - our AI solution - coming soon
  - You set your desired cost/speed ratio, and you forget about any more configuration. We ensure maximum speed up to limits you set yourself.

You can read more about Nx Agents [here](https://nx.app/products/agents#content).

### Atomizer

The [Atomizer](/ci/features/split-e2e-tasks) splits your Cypress or Playwright e2e tests by file. This significantly enhances granularity for caching, parallel execution, and flaky test identification. This granular approach ensures that individual test results can be cached and only the necessary tests rerun, greatly reducing CI pipeline times and facilitating more accurate flaky test detection.

{% youtube src="https://www.youtube.com/watch?v=0YxcxIR7QU0" /%}

### Addressing flaky tests with test deflaking

Flaky tests can be a significant bottleneck in the CI process. Nx tackles this issue head-on by intelligently [re-running only the flaky tasks](/ci/features/flaky-tasks), rather than the entire pipeline. This approach not only saves time but also provides developers with more confidence in their CI pipeline's reliability.

![](/blog/images/2024-03-20/bodyimg3.avif)

Nx creates a hash of all the inputs for a task whenever it is run. If it encounters a task that fails with a particular set of inputs and then succeeds with those same inputs, Nx knows for a fact that the task is flaky.

## New Nx features that tie in with our core speed improvements

### Module Federation

With the help of Nx and the Module Federation setup that Nx offers, you can split up large Angular apps into smaller “vertical slices”. This can significantly speed up your builds and app startup time. Nx has revolutionized the use of Module Federation, especially in how static remotes are built and served. We make use of Nx’s task orchestration, allowing users to fine tune the number of builds happening in parallel to improve local startup time, manage machine resources better, allow for scaling.

### First-Class Playwright support

With first-class support for Playwright through **`@nx/playwright`**, Nx offers out-of-the-box generators to run Playwright tests efficiently. This integration is especially powerful with features like Atomizer, enhancing the testing process's speed and reliability.

## Conclusion

Nx provides an unparalleled toolkit for developers and teams looking to optimize their development workflows, and we keep making it faster. By intelligently leveraging modern technologies and innovative optimizations, Nx delivers speed, efficiency, and reliability, allowing teams to focus on what matters most: building great software.

---

## Learn more

- [Nx Docs](/getting-started/intro)
- [X / Twitter](https://twitter.com/nxdevtools)
- [LinkedIn](https://www.linkedin.com/company/nrwl)
- [Nx GitHub](https://github.com/nrwl/nx)
- [Nx Community Discord](https://go.nx.dev/community)
- [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- [Speed up your CI](/nx-cloud)
