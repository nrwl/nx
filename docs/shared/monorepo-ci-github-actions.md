# Configuring CI Using GitHub Actions and Nx

Nx is a smart, fast and extensible build system, and it works really well with monorepos. Monorepos provide a lot of advantages:

- Everything at that current commit works together. Changes can be verified across all affected parts of the organization.
- Easy to split code into composable modules
- Easier dependency management
- One toolchain setup
- Code editors and IDEs are "workspace" aware
- Consistent developer experience
- And more ...

But they come with their own technical challenges. The more code you add into your repository, the slower the CI gets.

## Setting GitHub Actions

The `GitHub` can track the last successful run on `main` branch and use this as a reference point for the `BASE`. The `Nx Set SHAs` provides conventient implementation of this functionality which you can drop into you existing CI config.
To understand why knowing the last successful build is important for the affected command, check out the [in-depth explanation at Actions's docs](https://github.com/marketplace/actions/nx-set-shas#background).

Below is an example of a GitHub setup for an Nx workspace only building and testing what is affected. For more details on how the orb is used, head over to the [official docs](https://github.com/marketplace/actions/nx-set-shas).

```yaml
name: CI
on:
  push:
    branches:
      - main
  pull_request:

jobs:
  main:
    runs-on: ubuntu-latest
    if: ${{ github.event_name != 'pull_request' }}
    steps:
      - uses: actions/checkout@v2
        name: Checkout [main]
        with:
          fetch-depth: 0
      - name: Derive appropriate SHAs for base and head for `nx affected` commands
        uses: nrwl/nx-set-shas@v2
      - uses: actions/setup-node@v1
        with:
          node-version: '14'
      - run: npm install
      - run: npx nx affected --target=build --parallel=3
      - run: npx nx affected --target=test --parallel=2
  pr:
    runs-on: ubuntu-latest
    if: ${{ github.event_name == 'pull_request' }}
    steps:
      - uses: actions/checkout@v2
        with:
          ref: ${{ github.event.pull_request.head.ref }}
          fetch-depth: 0
      - name: Derive appropriate SHAs for base and head for `nx affected` commands
        uses: nrwl/nx-set-shas@v2
      - uses: actions/setup-node@v1
        with:
          node-version: '14'
      - run: npm install
      - run: npx nx affected --target=build --parallel=3
      - run: npx nx affected --target=test --parallel=2
```

The `pr` and `main` jobs implement the CI workflow. Setting `timeout-minutes` is needed only if you have very slow tasks.

## Distributed CI with Nx Cloud

A computation cache is created on your local machine to make the developer experience faster. This allows you to not waste time re-building, re-testing, re-linting, or any number of other actions you might take on code that hasn't changed. Because the cache is stored locally, you are the only member of your team that can take advantage of these instant commands. You can manage and share this cache manually.

Nx Cloud allows this cache to be shared across your entire organization, meaning that any cacheable operation completed on your workspace only needs to be run once. Nx Cloud also allows you to distribute your CI across multiple machines to make sure the CI is fast even for very large repos.

Learn more about [configuring your CI](https://nx.app/docs/configuring-ci) environment using Nx Cloud with [Distributed Caching](https://nx.app/docs/distributed-caching) and [Distributed Task Execution](https://nx.app/docs/distributed-execution) in the Nx Cloud docs.
