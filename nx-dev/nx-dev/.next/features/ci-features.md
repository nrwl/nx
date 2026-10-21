---
title: Continuous Integration (CI) with Nx Cloud
sidebar:
  hidden: true
description: Nx Cloud cuts CI time and cost with remote caching and distributed task execution with dynamic task packing, which fills machines by CPU and memory use.
filter: 'type:Features'
---

{% youtube src="https://www.youtube.com/watch?v=cDBihpB3SbI" title="Nx and Nx Cloud" width="100%" /%}

Nx Cloud makes CI faster and cheaper in two ways:

- [Remote caching](/docs/features/ci-features/remote-cache) skips any task that already ran with the same inputs, in CI or on a developer machine.
- [Distributed task execution](/docs/features/ci-features/distribute-task-execution) spreads the remaining tasks across Nx Agents, and _dynamic task packing_ fills each agent by the CPU and memory its tasks use, so fewer machine-minutes sit idle.

In most workspaces, distribution uses about 50% fewer machine-minutes than remote caching alone.
Teams using Nx Cloud report 30% to 70% faster CI.

## What you get with Nx Cloud on top of Nx Core

|                 | Nx Core                                                                                                    | Nx Cloud                                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Caching         | [Local cache](/docs/features/cache-task-results), per machine                                              | Adds a [remote cache](/docs/features/ci-features/remote-cache) shared across your team and CI                     |
| Task scheduling | Task graph on one machine, [`nx affected`](/docs/features/ci-features/affected) to skip untouched projects | Adds [distribution across agents](/docs/features/ci-features/distribute-task-execution) with dynamic task packing |
| Failing CI      | You read the logs and fix it                                                                               | [Self-healing CI](/docs/features/ci-features/self-healing-ci) proposes a fix on the PR                            |
| Visibility      | Terminal output for the run in front of you                                                                | [Run history, task analytics, and CI observability](/docs/kb/optimize-your-ttg)                                   |

## Connect your workspace to Nx Cloud

Push your workspace to a remote repository, then run:

```shell
npx nx@latest connect
```

Remote caching works as soon as the workspace is connected.
To add distribution and the rest of the pipeline, see [setting up CI](/docs/getting-started/setup-ci).

{% call_to_action title="Connect from your browser" url="https://cloud.nx.app/get-started?utm_source=nx-docs&utm_medium=website&utm_campaign=nx-cloud-signup&utm_content=ci-features" icon="nxcloud" description="Sign in to Nx Cloud and connect your repository without the CLI" /%}

## Why task-based CI costs less

Most CI setups use static partitioning (binning and sharding), assigning work to machines up front, such as one job for tests and another for builds, and each machine runs until its slowest task ends.
Nx Cloud assigns individual tasks as agents free up, using the task graph and each task's past duration, CPU, and memory use.
Agents stay busy, an agent that fails during setup has its work picked up by the others, and adding agents needs no change to how work is split.

[Learn how teams use Nx Cloud](https://nx.dev/blog?filterBy=customer+story) to scale their workspaces.

## Nx Cloud features

{% index_page_cards path="features/ci-features" /%}

## Related guides

{% cardgrid %}

{% linkcard title="CI workflow examples" description="Pipelines for CircleCI, GitLab, Azure Pipelines, Jenkins, and Bitbucket" href="/docs/kb/ci-workflow-examples" /%}

{% linkcard title="GitHub Actions integration" description="Run affected tasks with remote caching and PR insights on GitHub Actions" href="/docs/kb/github-integration" /%}

{% linkcard title="Optimize your time to green" description="Find and fix what slows pull requests down" href="/docs/kb/optimize-your-ttg" /%}

{% linkcard title="Record non-Nx commands" description="Send logs from any CI command to Nx Cloud" href="/docs/kb/record-commands" /%}

{% linkcard title="Google identity provider" description="Sign in to Nx Cloud with Google Workspace" href="/docs/kb/google-auth" /%}

{% /cardgrid %}

## Frequently asked questions

### Is Nx Cloud free?

Yes. Nx Cloud starts on the free Hobby plan, which includes 50,000 credits per month, 5 contributors, and 10 concurrent CI connections, with no credit card.

Nx itself is free and open source too. Task running, the project graph, local caching, `nx affected`, generators, and migrations all work without an Nx Cloud account.

### What happens when I use up my credits?

On the Hobby plan, Nx Cloud features turn off once the monthly credits are gone and turn back on at the next reset.

The Team plan has no such cap, and usage beyond the $29 of included credit is billed at $5.50 per 10,000 credits. See [credit pricing](/docs/reference/nx-cloud/credits-pricing) for what each operation costs.

### Is Nx Cloud cheaper than running CI on GitHub Actions alone?

With 70% of task time served from cache, pipeline times roughly halve and GitHub spend drops 15% to 40%, depending on how many machine-minutes the pipeline uses today. See [GitHub Actions pricing and how to cut your CI bill](/docs/kb/github-actions-pricing) for the rate tables and the break-even math.

### Do unused credits carry over?

No. Your allowance resets at the start of each billing cycle.

### Is there a plan for open source projects?

Yes. Nx Cloud is free for qualifying open source organizations. [Talk to our engineering team](https://nx.dev/contact/engineering) to get set up.

### Can I get a shared cache without Nx Cloud?

Yes. Build your own server against the [remote cache OpenAPI specification](/docs/kb/self-hosted-caching), in any language. You maintain the storage, authentication, and uptime.

### When should I consider Enterprise or self-hosted options?

The [Enterprise plan](https://nx.dev/enterprise) adds SSO and SAML, dedicated support with SLAs, [conformance rules](/docs/enterprise/conformance), [code owners](/docs/enterprise/owners), and cross-repo visibility.

On a [single-tenant instance](/docs/enterprise/single-tenant/overview) or an on-prem install, you choose the region and the infrastructure your cache and run data live on. For what a standard Nx Cloud workspace sends and stores, see the [privacy policy](https://nx.app/privacy).

## Learn more

- [Blog post: Reliable CI: A new execution model fixing both flakiness and slowness](https://nx.dev/blog/reliable-ci-a-new-execution-model-fixing-both-flakiness-and-slowness)
- [Live stream: Unlock the secret of fast CI - Hands-on session](https://www.youtube.com/live/rkLKaqLeDa0)
- [YouTube: 10x Faster e2e Tests](https://www.youtube.com/watch?v=0YxcxIR7QU0)
