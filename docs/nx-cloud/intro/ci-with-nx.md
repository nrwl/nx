# Continuous Integration with Nx

Implementing an efficient CI setup for monorepos - while crucial - can be challenging and maintenance heavy. That is [not your fault, though](/ci/intro/why-nx-cloud). Nx Cloud comes with a series of features that help make CI for monorepos faster, more reliable and more cost-effective.

## How Can Nx Improve Your CI Pipeline?

The benefits of Nx are not restricted to local development. Nx Cloud helps scale your project on CI by making it simple to create and maintain a pipeline that [eliminates wasted time](/ci/concepts/reduce-waste) and [efficiently parallelizes work](/ci/concepts/parallelization-distribution).

Your CI pipeline with Nx can:

- Run only tasks [affected](/ci/features/affected) by that PR
- [Share the task cache](/ci/features/remote-cache) to dramatically speed up your PRs (Nx Replay)
- [Distribute task execution](/ci/features/distribute-task-execution) across multiple agent machines (Nx Agents)
- Automatically [split long e2e tasks](/ci/features/split-e2e-tasks) into smaller tasks (Atomizer)
- Identify and Re-run [Flaky Tasks](/ci/features/flaky-tasks)

## Try Nx Cloud Yourself!

[Create an account on Nx Cloud](https://cloud.nx.app) and connect your repository.

```shell
npx nx@latest connect
```

## Learn about Nx on CI

{% cards cols="2" lgCols="4" mdCols="4" smCols="2" %}

{% link-card title="What is Nx Cloud?" type="video" url="https://youtu.be/4VI-q943J3o" icon="nxcloud" /%}

{% link-card title="E2E Test Auto-Splitting and Distribution" type="video" url="https://youtu.be/0YxcxIR7QU0" icon="nxagents" /%}

{% link-card title="Circle CI with Nx" type="tutorial" url="/ci/recipes/set-up/monorepo-ci-circle-ci" icon="circleci" /%}

{% link-card title="GitHub Actions with Nx" type="tutorial" url="/ci/recipes/set-up/monorepo-ci-github-actions" icon="github" /%}

{% /cards %}

## Ready? Get Started With Your Provider

Not interested in a tutorial but you want to jump right in? Run the following command

```shell
npx nx g ci-workflow
```

...or choose from our CI recipes with copy & pasteable code:

{% cards cols="3" lgCols="6" mdCols="6" smCols="5"  %}

{% link-card title="GitHub Actions" url="/ci/recipes/set-up/monorepo-ci-github-actions" icon="github" appearance="small" /%}
{% link-card title="Circle CI" url="/ci/recipes/set-up/monorepo-ci-circle-ci" icon="circleci" appearance="small" /%}
{% link-card title="GitLab" url="/ci/recipes/set-up/monorepo-ci-gitlab" icon="gitlab" appearance="small" /%}
{% link-card title="Azure Pipelines" url="/ci/recipes/set-up/monorepo-ci-azure" icon="azure" appearance="small" /%}
{% link-card title="Bitbucket Pipelines" url="/ci/recipes/set-up/monorepo-ci-bitbucket-pipelines" icon="bitbucket" appearance="small" /%}
{% link-card title="Jenkins" url="/ci/recipes/set-up/monorepo-ci-jenkins" icon="jenkins" appearance="small" /%}

{% /cards %}

## Need help? Reach out!

Connect on our channels and with the Nx Community to ask questions, get help and keep up to date with the latest news.

- Reach out for [Enterprise Support](/enterprise)
- ⭐️ [Star us on GitHub](https://github.com/nrwl/nx) to show your support and stay updated on new releases!
- Join our [Discord Community](https://go.nx.dev/community)
- Subscribe to our [Youtube Channel](https://www.youtube.com/@nxdevtools)
- Follow us on [Twitter](https://twitter.com/nxdevtools)
- Subscribe [to our tech newsletter](https://go.nrwl.io/nx-newsletter)
