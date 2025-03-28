---
title: 'Vattenfall changes the math on concurrent PRs with Nx Agents'
slug: nx-agents-changes-the-math
authors: [Philip Fulcher]
tags: ['customer story']
cover_image: /blog/images/2025-02-12/header.avif
description: 'Vattenfall solves their CI runner limitation using Nx Cloud, improving from 4 concurrent PRs to 100.'
metrics:
  - value: '4→100'
    label: 'concurrent PRs on CI'
  - value: '44%'
    label: 'reduction in CI runtimes'
  - value: '> 1 year'
    label: 'of computation saved every 30 days'
---

[Vattenfall](https://group.vattenfall.com/), a world leader in energy production, has been rapidly expanding their IT organization over the past few years – exponentially growing both their development teams and their codebase. As more developers joined and modular frontends proliferated, what started as a performant CI pipeline began showing signs of strain. The increasing complexity of their applications and test suites, combined with their commitment to maintaining high quality standards, created unprecedented demands on their CI infrastructure. Their CI provider had a limit of 100 CI runners in a pool, combined with a limit of one pool. If a single runner per PR would be enough, this would lead to 100 concurrent PRs. More than enough for most teams. However, their workspace needed 25+ runners to complete in a timely manner. This resulted in only four concurrent PRs available, slowing down their team immensely and blocking important work from making it through CI.

## Hitting the limits of CI providers

It's typical for some limits to be imposed by your CI provider. You may have a set number of persistent runners that can't be increased. Even if you have ephemeral runners, you likely have a limit on how many of those runners can be active at a time. These limits might be driven by cost control or technical limitations by the provider, but they all mean the same thing: **the number of concurrent PRs you can run is limited by your number of runners**.

In a world where each PR needs one runner for CI, you can have one concurrent PR running for each runner you have. But a single runner per PR just doesn’t scale. Instead, you’ll need to distribute tasks across multiple runners.

Now you're in a balancing act of how many runners can be assigned to a PR so that it completes faster vs how many PRs can be run at the same time. Your number of concurrent PRs becomes your available runners divided by the number of runners for each PR.

![Formula for calcuating number of concurrent PRs: "Available Runners" divided by "Runners per PR" equals "Concurrent PRs".](/blog/images/2025-02-12/previous-formula.avif)

## Nx Agents unlocks concurrency

Working with our [Nx Enterprise](/enterprise) team, Vattenfall was able to unblock their team with Nx Agents enabling **more concurrent PR runs**. Not only that, but Nx Agents **lowered PR runtimes by 44%** and unlocked other features and tools that had been limited by their number of runners.

Nx Agents makes it quick and easy to enable task distribution in your PR runs without consuming CI runners. How?

When using Nx Agents, the tasks for your PR are now completed by Nx Agents rather than your CI runners. Your CI runner starts, runs your configured Nx commands to collect the tasks that need to be completed, and sends them to Nx Cloud. From there, Nx Agents are spun up and complete the work for each task to report back to the CI runner.

![Illustration showing Nx Agents pulling a task to complete.](/blog/images/2025-02-12/agents.avif)

This reduces our concurrency calculation to be 1:1 with our number of runners while still reaping the benefits of parallelism across multiple agents.

![Modified Formula for calcuating number of concurrent PRs: "Runners per PR" is scratched out and replaced by "Nx Cloud" leaving "Available Runners" equals "Concurrent PRs".](/blog/images/2025-02-12/new-formula.avif)

## From 4 concurrent PRs to 100

So, how did Nx Agents help with the concurrent PR runs problem Vattenfall was facing? Our Nx Enterprise team was able to [trial Agents](/enterprise/trial) with them, quickly resulting in huge benefits for their team. They were able to re-enable that 100 PR concurrency by distributing all work to Nx Agents. Their limited pool of 100 runners was again able to handle 100 concurrent PRs, while still retaining the benefits of distributing tasks across Nx Agents. Nx Agents will continue to scale, adding more agents as needed to keep PR runtimes within reason. Concurrent PR runs will continue to match their number of CI runners no matter how many agents they need to distribute tasks.

![Graph showing pipeline improvements before and after Nx Agents. CI pipeline times (in minutes) improve from 70 moinutes to less than 10 minutes. Concurrent PRs improve from 4 to 100.](/blog/images/2025-02-12/pipeline-improvements.avif)

## Unlocking more than just concurrent PR runs

What else did Vattenfall unlock with more concurrent PR runs?

### Reduced CI runtimes by 44%

This increase in concurrent PRs is a big win in and of itself, but it also resulted in faster CI run times. Average CI runtimes went from 39 minutes to 22 minutes, a **44% improvement**. Not only are there more PRs running concurrently, they're running faster.

### Enabling flaky test detection to avoid PR re-runs

Using Nx Agents has also enabled flaky task retries for them, reducing the number of times that PRs have to be re-run. Tasks that fail only sometimes and only in certain environments are called "flaky tasks." They are enormously time-consuming to identify and debug. **Nx Cloud can reliably detect flaky tasks and automatically schedule them to be re-run on a different agent**. By re-running flaky tasks until they pass, Nx Cloud ensures that the PR run completes the first time and doesn’t have to be re-run just to get a flaky task to pass.

### Unlocking RenovateBot

RenovateBot helps automate dependency updates by creating pull requests when dependencies need to be updated. Previously, this PR would have consumed more CI runners and would have been yet another blocker on their team for making progress. They had to prioritize the runners for PRs created by engineers rather than allow RenovateBot to run. With the increased concurrency allowed by Nx Agents, they are now able to run RenovateBot on a regular basis.

{% testimonial
name="Martijn van der Meij"
title="Solution Designer, Vattenfall"
image="/documentation/blog/images/2025-02-12/martijn.avif" %}
Other engineers in other business units are seeing the advantage of Nx, and their managers are talking to our managers about copying the way we work. **They're saying "Nx is solving this problem we didn't even know we had"**
{% /testimonial %}

## What could Nx Agents unlock for you?

What's blocking you from getting your products to market fast? Let our team figure it out for you! With Nx Enterprise, you receive expert guidance from day one, ensuring your setup is optimized for maximum efficiency. Whether you're starting fresh, migrating, or scaling your developer platform, we'll work with you to tailor the perfect solution for your team.

{% call-to-action title="Get a Free Trial of Nx Enterprise" url="/enterprise" icon="nxcloud" description="Learn more about our enterprise offerings or request a free trial of Nx Enterprise" %}

{% /call-to-action %}
