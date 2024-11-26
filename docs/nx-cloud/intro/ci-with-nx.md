# Continuous Integration with Nx

Implementing an efficient CI setup for monorepos - while crucial - can be challenging and maintenance heavy. That is [not your fault, though](/ci/intro/why-nx-cloud). Nx Cloud comes with a series of features that help make CI for monorepos faster, more reliable and more cost-effective.

## Core Features

- Test only the code that might have been [affected](/ci/features/affected) by a PR
- Never run the same task on the same code twice with [remote caching](/ci/features/remote-cache)
- Efficiently [distribute task execution across multiple machines](/ci/features/distribute-task-execution)
- Quickly troubleshoot errors that occur in CI
- Create a simple but powerful pipeline configuration that easily scales with your codebase

## Try Nx Cloud Yourself!

[Create an account on Nx Cloud](https://cloud.nx.app) and connect your repository.

```shell
npx nx connect
```

## Learn about Nx on CI

{% cards cols="2" lgCols="4" mdCols="4" smCols="2" %}

{% link-card title="What is Nx Cloud?" type="video" url="https://youtu.be/4VI-q943J3o" icon="nxcloud" /%}

{% link-card title="E2E Test Auto-Splitting and Distribution" type="video" url="https://youtu.be/0YxcxIR7QU0" icon="nxagents" /%}

{% link-card title="Circle CI with Nx" type="tutorial" url="/ci/intro/tutorials/circle" icon="circleci" /%}

{% link-card title="GitHub Actions with Nx" type="tutorial" url="/ci/intro/tutorials/github-actions" icon="github" /%}

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
- Join our [Discord Community](https://go.nx.dev/community)
- Subscribe to our [Youtube Channel](https://www.youtube.com/@nxdevtools)
- Follow us on [Twitter](https://twitter.com/nxdevtools)
- Subscribe [to our tech newsletter](https://go.nrwl.io/nx-newsletter)
