# Continuous Integration with Nx

When implemented well, continuous integration (CI) allows a team of developers to efficiently make changes to a codebase with the confidence that they haven't broken existing functionality. When implemented poorly, CI slows down the team by adding obstacles to deploying code without actually providing any confidence that the code is correct.

## Core Features

- Test only the code that might have been [affected](/concepts/affected) by a PR
- Improve the average CI time with [remote caching](/core-features/remote-cache)
- Improve the worst case CI time with [distributed task execution](/core-features/distribute-task-execution)
- Quickly troubleshoot errors that occur in CI
- Create a simple but powerful pipeline configuration that easily scales with your codebase

## Try Nx Cloud Yourself!

```shell
npx nx connect
```

## Learn about Nx on CI

{% cards cols="2" lgCols="6" mdCols="4" smCols="2" %}

{% link-card title="What is Nx Cloud?" type="video" url="https://youtu.be/NZF0ZJpgaJM" icon="nxcloud" /%}

{% link-card title="Nx Cloud 3.0 - What is new?" type="video" url="https://youtu.be/cG2hEI5L3qI?si=xVnSLMU2VN1UAEpJ" icon="nxcloud" /%}

{% link-card title="Nx in 10 minutes!" type="video" url="https://youtu.be/-_4WMl-Fn0w" icon="nx" /%}
{% link-card title="More On Youtube" type="video" url="https://www.youtube.com/@nxdevtools" icon="youtube" /%}

{% /cards %}

## Ready? Get Started With Your Provider

Run the following command

```shell
npx nx g ci-workflow
```

...or choose from our guides below:

{% cards cols="3" lgCols="8" mdCols="6" smCols="5"  %}

{% link-card title="GitHub Actions" url="/nx-cloud/recipes/set-up/monorepo-ci-github-actions" icon="github" appearance="small" /%}
{% link-card title="Circle CI" url="/nx-cloud/recipes/set-up/monorepo-ci-circle-ci" icon="circleci" appearance="small" /%}
{% link-card title="GitLab" url="/nx-cloud/recipes/set-up/monorepo-ci-gitlab" icon="gitlab" appearance="small" /%}
{% link-card title="Azure Pipelines" url="/nx-cloud/recipes/set-up/monorepo-ci-azure" icon="azure" appearance="small" /%}
{% link-card title="Bitbucket Pipelines" url="/nx-cloud/recipes/set-up/monorepo-ci-bitbucket-pipelines" icon="bitbucket" appearance="small" /%}
{% link-card title="Jenkins" url="/nx-cloud/recipes/set-up/monorepo-ci-jenkins" icon="jenkins" appearance="small" /%}

{% /cards %}

## Need help? Reach out!

Connect on our channels and with the Nx Community to ask questions, get help and keep up to date with the latest news.

- Reach out for [Enterprise Support](https://nx.app/enterprise)
- Join our [Discord Community](https://go.nx.dev/community)
- Subscribe to our [Youtube Channel](https://www.youtube.com/@nxdevtools)
- Follow us on [Twitter](https://twitter.com/nxdevtools)
- Subscribe [to our tech newsletter](https://go.nrwl.io/nx-newsletter)
