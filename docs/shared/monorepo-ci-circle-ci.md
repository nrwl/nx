# Configuring CI Using CircleCI and Nx

Nx is a smart and extensible build framework, and it works really well with monorepos. Monorepos provide a lot of advantages:

- Everything at that current commit works together. Changes can be verified across all affected parts of the organization.
- Easy to split code into composable modules
- Easier dependency management
- One toolchain setup
- Code editors and IDEs are "workspace" aware
- Consistent developer experience
- And more ...

But they come with their own technical challenges. The more code you add into your repository, the slower the CI gets. Adding Nx to your CI pipeline makes this more efficient.

## Setting up CircleCI

Below is an example of a Circle CI setup for an Nx workspace only building and testing what is affected.

```yaml
version: 2.1
orbs:
  nx: nrwl/nx@1.0.0
jobs:
  main:
    steps:
      - checkout
      - run: npm install
      - nx/set-shas
      - run: npx nx affected --base=$NX_BASE --target=build --parallel --max-parallel=3
      - run: npx nx affected --base=$NX_BASE --target=test --parallel --max-parallel=2
  pr:
    steps:
      - checkout
      - run: npm install
      - nx/set-shas
      - run: npx nx affected --base=$NX_BASE --target=build --parallel --max-parallel=3
      - run: npx nx affected --base=$NX_BASE --target=test --parallel --max-parallel=2
workflows:
  build:
    jobs:
      - main:
          filters:
            branches:
              only: main
      - pr:
          filters:
            branches:
              ignore: main
```

The `pr` and `main` jobs implement the CI workflow.

## Distributed CI with Nx Cloud

A computation cache is created on your local machine to make the developer experience faster. This allows you to not waste time re-building, re-testing, re-linting, or any number of other actions you might take on code that hasn't changed. Because the cache is stored locally, you are the only member of your team that can take advantage of these instant commands. You can manage and share this cache manually.

Nx Cloud allows this cache to be shared across your entire organization, meaning that any cacheable operation completed on your workspace only needs to be run once. Nx Cloud also allows you to distribute your CI across multiple machines to make sure the CI is fast even for very large repos.

Learn more about [configuring your CI](https://nx.app/docs/configuring-ci) environment using Nx Cloud with [Distributed Caching](https://nx.app/docs/distributed-caching) and [Distributed Task Execution](https://nx.app/docs/distributed-execution) in the Nx Cloud docs.
