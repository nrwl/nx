---
title: 'Nx Cloud Update - Assignment rules come out of beta and more!'
slug: nx-cloud-update-april-2025
authors: ['Philip Fulcher']
tags: ['nx-cloud']
cover_image: /blog/images/2025-04-16/header.avif
description: 'Nx Cloud updates for April 2025 include assignment rules coming out of beta, CIPE filters, flaky retry configuration, and more!'
youtubeUrl: https://youtu.be/kOtJilAMkmU
---

We're rolling out updates to Nx Cloud constantly, so we wanted to bring you up to date with what we've been working on lately.

{% toc /%}

## Assignment Rules come out of beta

In your CI pipeline, you've got some tasks of different sizes. Some tasks are quick, like linting or format checking, but you've got more resource-intensive tasks like building apps or running e2e suites. Your smaller tasks can run on a small agent with fewer CPU cores or less memory, but your larger tasks need a larger agent.

But when you're spreading tasks across multiple agents, it's inefficient to increase the size of all the agents to accommodate your larger tasks. So ideally, you have smaller agents for small tasks and larger agents for your larger tasks. But how do you make sure tasks get assigned to the right agent?

Many CI tools have ways of handling this, but we wanted to make things easier. That's why Nx Cloud now has [Assignment Rules](/ci/reference/assignment-rules). This configuration allows you to control which tasks are assigned to certain agents.

Let's take a look at a quick example for [Nx Agents](/ci/features/distribute-task-execution):

```yaml {% fileName=".nx/workflows/distribution-config.yaml" /%}
# Create five agents using the `linux-medium-js` launch template and five agents using `linux-large-js`
distribute-on:
  default: 5 linux-medium-js, 5 linux-large-js

assignment-rules:
  # for our `app1` projects...
  - projects:
      - app1
    # for targets beginning with "e2e-ci"...
    targets:
      - e2e-ci*
    # and using the `production` configuration
    configurations:
      - production
    # run matching tasks on a `linux-medium-js` agent with parallelism set to 5
    run-on:
      - agent: linux-medium-js
        parallelism: 5

  # for lint and build tasks on any project
  - targets:
      - lint
      - build
    # run matching tasks on a `linux-large-js` agent with parallelism set to 10
    run-on:
      - agent: linux-large-js
        parallelism: 10
```

As you can see, there's a lot of flexibility in the configuration here to fine-tune your agent assignments.

We're so excited about this feature that we've built it to work with both [Agents](/ci/features/distribute-task-execution) and [Manual DTE](/ci/recipes/dte/github-dte). So, no matter how you're distributing tasks using Nx Cloud, you can use this new feature! Be sure to [check the docs](/ci/reference/assignment-rules) for more details.

We're also providing a new UI that tells you exactly what tasks are being run on which agents and the rules impacting them.

![Screenshot of UI showing how assignment rules are affecting tasks](/blog/images/2025-04-16/assignment-rules-viz.avif)

## Find your CIPEs with better filtering

![Screenshot of UI showing filters for CIPEs view](/blog/images/2025-04-16/cipe-filters.avif)

Having trouble finding a CI Pipeline Execution (CIPE)? We've added new filter options for the CIPEs list. You can now filter by committer, branch, or date range. You can even sort by duration to help find your longest CIPEs.

## Control how flaky task retries work with your workspace

![Screenshot of UI showing configuration options for flaky task retries](/blog/images/2025-04-16/flaky-retries.avif)

Flaky retries are great at unblocking your CI pipelines by automatically retrying tasks that Nx Cloud detects as flaky. This means you spend less time re-running CI pipelines when you have a task that passes sometimes and fails other times. You now have more control over this process. You can fine-tune how Nx Cloud retries tasks, specify a time range when flakiness is determined, or even turn it off entirely. This helps optimize when tasks are retried so you can control resource use and CI cost.

## Request access to protected views

![Screenshot of UI showing an option to request access to a protected resource](/blog/images/2025-04-16/request-access.avif)

Access control is important, but it can be time-consuming to give the right access to the right people. Now, users can request access with a simple button click, and an admin will be alerted to adjust their access. This automated process saves your team time by not having to send another email or submit a support ticket for access.

## Nx Agents supports custom GitHub domains

![Screenshot of UI showing how to use a custom GitHub URL for Nx Agents](/blog/images/2025-04-16/github-url.avif)

Using GitHub Enterprise and having a custom URL? Nx Agents now works with these custom domains, check for the option to override your domain during setup.

{% call-to-action title="Not using Nx Cloud yet?" url="https://cloud.nx.app/get-started/?utm_source=nx-dev" icon="nxcloud" description="Get started now for free!" /%}

---

## Learn more

- [Nx Cloud Docs](/ci)
- [Nx Docs](/getting-started/intro)
- [X/Twitter](https://twitter.com/nxdevtools)
- [LinkedIn](https://www.linkedin.com/company/nrwl/)
- [Nx GitHub](https://github.com/nrwl/nx)
- [Nx Official Discord Server](https://go.nx.dev/community)
- [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- [Speed up your CI](/nx-cloud)
