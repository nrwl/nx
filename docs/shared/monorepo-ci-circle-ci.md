# Configuring CI Using CircleCI and Nx

Nx is a smart, fast and extensible build system, and it works really well with monorepos. Monorepos provide a lot of advantages:

- Everything at that current commit works together. Changes can be verified across all affected parts of the organization.
- Easy to split code into composable modules
- Easier dependency management
- One toolchain setup
- Code editors and IDEs are "workspace" aware
- Consistent developer experience
- And more ...

But they come with their own technical challenges. The more code you add into your repository, the slower the CI gets. Adding Nx to your CI pipeline makes this more efficient.

## Setting up CircleCI

The `CircleCI` can track the last successful run on `main` branch and use this as a reference point for the `BASE`. The `Nx Orb` provides convenient implementation of this functionality which you can drop into you existing CI config.
To understand why knowing the last successful build is important for the affected command, check out the [in-depth explanation at Orb's docs](https://github.com/nrwl/nx-orb#background).

Below is an example of a Circle CI setup for an Nx workspace only building and testing what is affected. For more details on how the orb is used, head over to the [official docs](https://circleci.com/developer/orbs/orb/nrwl/nx).

```yaml
version: 2.1
orbs:
  nx: nrwl/nx@1.4.0
jobs:
  main:
    docker:
      - image: cimg/node:lts-browsers
    steps:
      - checkout
      - run: npm ci
      - nx/set-shas

      - run: npx nx workspace-lint
      - run: npx nx format:check
      - run: npx nx affected --base=$NX_BASE --head=$NX_HEAD --target=lint --parallel=3
      - run: npx nx affected --base=$NX_BASE --head=$NX_HEAD --target=test --parallel=3 --ci --code-coverage
      - run: npx nx affected --base=$NX_BASE --head=$NX_HEAD --target=build --parallel=3
workflows:
  build:
    jobs:
      - main
```

The `pr` and `main` jobs implement the CI workflow.

### Using CircleCI on private repository

To use the [Nx Orb](https://github.com/nrwl/nx-orb) with a private repository on your main branch, you need to grant the orb access to your CircleCI API. You can do this by creating an environment variable called `CIRCLE_API_TOKEN` in the context or the project.

> Note: It should be a user token, not project token.

<div class="nx-cloud-section">

## Distributed CI with Nx Cloud

A computation cache is created on your local machine to make the developer experience faster. This allows you to not waste time re-building, re-testing, re-linting, or any number of other actions you might take on code that hasn't changed. Because the cache is stored locally, you are the only member of your team that can take advantage of these instant commands. You can manage and share this cache manually.

Nx Cloud allows this cache to be shared across your entire organization, meaning that any cacheable operation completed on your workspace only needs to be run once. Nx Cloud also allows you to distribute your CI across multiple machines to make sure the CI is fast even for very large repos.

In order to use distributed task execution, we need to start agents and set the `NX_CLOUD_DISTRIBUTED_EXECUTION` flag to `true`. Once all tasks are finished, we must not forget to cleanup used agents.

```yaml
version: 2.1
orbs:
  nx: nrwl/nx@1.4.0
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
    environment:
      NX_CLOUD_DISTRIBUTED_EXECUTION: 'true'
    steps:
      - checkout
      - run: npm ci
      - nx/set-shas
      - run: npx nx-cloud start-ci-run

      - run: npx nx-cloud record -- npx nx workspace-lint
      - run: npx nx-cloud record -- npx nx format:check
      - run: npx nx affected --base=$NX_BASE --head=$NX_HEAD --target=lint --parallel=3
      - run: npx nx affected --base=$NX_BASE --head=$NX_HEAD --target=test --parallel=3 --ci --code-coverage
      - run: npx nx affected --base=$NX_BASE --head=$NX_HEAD --target=build --parallel=3

      - run: npx nx-cloud stop-all-agents
          when: always
workflows:
  build:
    jobs:
      - agent:
          matrix:
            parameters:
              ordinal: [1, 2, 3]
      - main
```

You can also use our [ci-workflow generator](https://nx.dev/packages/workspace/generators/ci-workflow) to generate the configuration file.

Learn more about [configuring your CI](/nx-cloud/set-up/set-up-dte#cicd-examples) environment using Nx Cloud with [Distributed Caching](/nx-cloud/set-up/set-up-caching) and [Distributed Task Execution](/nx-cloud/set-up/set-up-dte) in the Nx Cloud docs.

</div>
