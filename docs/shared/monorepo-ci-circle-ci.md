# Configuring CI Using CircleCI and Nx

The `CircleCI` can track the last successful run on the `main` branch and use this as a reference point for the `BASE`. The `Nx Orb` provides a convenient implementation of this functionality which you can drop into your existing CI config.
To understand why knowing the last successful build is important for the affected command, check out the [in-depth explanation in Orb's docs](https://github.com/nrwl/nx-orb#background).

Below is an example of a Circle CI setup for an Nx workspace - building and testing only what is affected. For more details on how the orb is used, head over to the [official docs](https://circleci.com/developer/orbs/orb/nrwl/nx).

```yaml
version: 2.1
orbs:
  nx: nrwl/nx@1.5.1
jobs:
  main:
    docker:
      - image: cimg/node:lts-browsers
    steps:
      - checkout
      - run: npm ci
      - nx/set-shas

      - run: npx nx format:check
      - run: npx nx affected --base=$NX_BASE --head=$NX_HEAD -t lint --parallel=3
      - run: npx nx affected --base=$NX_BASE --head=$NX_HEAD -t test --parallel=3 --configuration=ci
      - run: npx nx affected --base=$NX_BASE --head=$NX_HEAD -t build --parallel=3
workflows:
  build:
    jobs:
      - main
```

The `pr` and `main` jobs implement the CI workflow.

### Using CircleCI on the private repository

To use the [Nx Orb](https://github.com/nrwl/nx-orb) with a private repository on your main branch, you need to grant the orb access to your CircleCI API. You can do this by creating an environment variable called `CIRCLE_API_TOKEN` in the context or the project.

{% callout type="warning" title="Caution" %}
It should be a user token, not the project token.
{% /callout %}

{% nx-cloud-section %}

## Distributed CI with Nx Cloud

Read more about [Distributed Task Execution (DTE)](/core-features/distribute-task-execution).

```yaml
version: 2.1
orbs:
  nx: nrwl/nx@1.5.1
jobs:
  agent:
    docker:
      - image: cimg/node:lts-browsers
    parameters:
      ordinal:
        type: integer
    steps:
      - checkout
      - run: npm ci
      - run:
          command: npx nx-cloud start-agent
          no_output_timeout: 60m
  main:
    docker:
      - image: cimg/node:lts-browsers
    steps:
      - checkout
      - run: npm ci
      - nx/set-shas
      - run: npx nx-cloud start-ci-run --stop-agents-after="build"

      - run: npx nx-cloud record -- npx nx format:check
      - run: npx nx affected --base=$NX_BASE --head=$NX_HEAD -t lint --parallel=3 & npx nx affected --base=$NX_BASE --head=$NX_HEAD -t test --parallel=3 --configuration=ci & npx nx affected --base=$NX_BASE --head=$NX_HEAD -t build --parallel=3
workflows:
  build:
    jobs:
      - agent:
          matrix:
            parameters:
              ordinal: [1, 2, 3]
      - main
```

You can also use our [ci-workflow generator](/packages/workspace/generators/ci-workflow) to generate the configuration file.

{% /nx-cloud-section %}
