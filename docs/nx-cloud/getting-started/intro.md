# Nx Cloud

{% youtube src="https://youtu.be/4VI-q943J3o" title="Fast CI for monorepos" width="100%" /%}

CI is challenging and it's **not be your fault**. It's a fundamental issue with how the current, traditional CI execution model works. Nx Cloud adopts a new **task-based** CI model which allows you to overcome slowness and unreliability of the current VM-based CI model.
_(Dive deeper into the [task based CI execution model](/blog/reliable-ci-a-new-execution-model-fixing-both-flakiness-and-slowness))_

Nx Cloud improves many aspects of the CI/CD process:

- **Speed** - 30% - 70% faster CI (based on reports from our clients)
- **Cost** - 40% - 75% reduction in CI costs (observed on the Nx OSS monorepo)
- **Reliability** - by automatically identifying flaky tasks (e2e tests in particular) and re-running them

{% call-to-action variant="default" title="Recover lost time with Nx Cloud" url="https://cloud.nx.app/get-started?utm_source=nx-dev&utm_medium=nx-cloud_intro&utm_campaign=try-nx-cloud" description="Setup takes less than 2 minutes" /%}

## How Nx Cloud improves CI

In traditional CI models, the work required is statically assigned to CI machines. Statically defining work to machines creates inefficiencies which many teams become familiar with at scale.

Nx Cloud addresses the inefficiencies of traditional CI models by using a **task-based approach to dynamically assign tasks** to agent machines.

CI becomes scaleable, maintainable, and more reliable because Nx Cloud can coordinate the work among the agent machines automatically and act upon individual tasks directly.

For example:

- An agent machine fails in a setup step - Nx Cloud automatically reassigns the work to other agent machines.
- More work needs to run in CI - Add more agent machines, Nx Cloud automatically assigns available work to extra agent machines.
- Known flaky tasks waste CI time on needed reruns - Nx Cloud automatically detects flaky tasks and reruns automatically in the current CI execution.

See Nx Cloud in action with stories from our customers:

{% testimonial
    name="Nicolas Beaussart"
    title="Staff Engineer, Payfit"
    image="https://avatars.githubusercontent.com/u/7281023?v=4" %}
The number of hours we spent optimizing CI before, trying to load balance in CircleCI, the different number of agents that we run ourselves by hand... it was painful and we spent hours and days trying to do that. The main thing with Nx Cloud is that we don't have to think about that.
{% /testimonial %}

[Read more customer stories](/blog?filterBy=customer+story)

## Learn more

- [Nx Cloud features](/ci/features)
- [Blog post: Reliable CI: A new execution model fixing both flakiness and slowness](/blog/reliable-ci-a-new-execution-model-fixing-both-flakiness-and-slowness)
- [Live stream: Unlock the secret of fast CI - Hands-on session](https://www.youtube.com/live/rkLKaqLeDa0)
- [YouTube: 10x Faster e2e Tests](https://www.youtube.com/watch?v=0YxcxIR7QU0)
