# Why Nx Cloud?

{% youtube
src="https://youtu.be/4VI-q943J3o"
title="Fast CI for monorepos"
width="100%" /%}

If CI feels challenging to you, **it might not be your fault**. It's a fundamental issue with how the current, traditional CI execution model works. Nx Cloud adopts a new **task-based** CI model which allows you to overcome both the slowness and unreliability of the current VM-based CI model. _(Dive deeper into the task based CI execution model [in this blog post](https://blog.nrwl.io/reliable-ci-a-new-execution-model-fixing-both-flakiness-and-slowness-6849fd4b4037))_

Nx Cloud addresses critical aspects of CI/CD, including:

- **speed** - 30% - 70% faster CI (based on reports from our clients)
- **cost** - 40% - 75% reduction in CI costs (observed on the Nx OSS monorepo)
- **reliability** - by automatically identifying flaky tasks (e2e tests in particular) and re-running them

## How?

Nx Cloud follows a task-based CI model which is **not just fast but also robust**. Instead of statically assigning work to machines (as in a traditional CI model), you can imagine a **pile of tasks which get picked up automatically** by agents on the Nx Cloud infrastructure. There's **no static assignment, agents coordinate the work by themselves**. If an agent fails during the setup phase, other agents will pick up its work. If more work needs to be done, more agents will be started to still guarantee a fast execution, if less work is needed, fewer agents will be started to save resources.

All this is possible because Nx Cloud directly integrates with Nx and has knowledge about the project structure and tasks as well as dependencies among them.

Read more about individual features of Nx Cloud in the [features section](/ci/features).

## Integrate Nx Cloud into my CI setup

Ready to experience fast CI? Read the [connect to Nx Cloud](/ci/intro/connect-to-cloud) page for more details.

## Learn more

- [Blog post: Reliable CI: A new execution model fixing both flakiness and slowness](https://blog.nrwl.io/reliable-ci-a-new-execution-model-fixing-both-flakiness-and-slowness-6849fd4b4037?source=friends_link&sk=6747bb77c92772a5f885a61127cb5c0b)
- [Live stream: Unlock the secret of fast CI - Hands-on session](https://www.youtube.com/live/rkLKaqLeDa0)
- [Webinar: Nx Agents Walkthrough: Effortlessly Fast CI Built for Monorepos](https://go.nx.dev/march-webinar?utm_source=nx_cloud&utm_medium=nxdocs&utm_campaign=nx_agents&utm_id=devrel)
- [Youtube: 10x Faster e2e Tests](https://www.youtube.com/watch?v=0YxcxIR7QU0)
