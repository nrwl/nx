# Configuring CI for Nx workspaces

Nx is a smart, fast and extensible build system, and it works really well with monorepos. Monorepos provide a lot of advantages:

- Everything at that current commit works together. Changes can be verified across all affected parts of the organization.
- Easy to split code into composable modules
- Easier dependency management
- One toolchain setup
- Code editors and IDEs are "workspace" aware
- Consistent developer experience
- And more ...

But they come with their own technical challenges. The more code you add into your repository and the more code you have to build/test/lint, the slower the CI gets. There are two ways to look at this time spent. In average time, and worst case scenario time. When configured properly, your average CI is the time it takes a given change to go through the CI process. The worst case scenario time is the time it takes to rebuild every project in your monorepo based on a given change. These are baseline you use to measure how long it takes to process pull requests in your CI/CD environment.

Adding Nx to your CI pipeline makes this more efficient.

Nx provides out-of-the-box implementation of CI workflows for `GitHub`, `Azure` and `CircleCI` during the [creation of the Nx workspace](/cli/create-nx-workspace#ci) or later using the [ci-workflow](/packages/workspace/generators/ci-workflow) generator.

{% nx-cloud-section %}

## Distributed CI with Nx Cloud

A computation cache is created on your local machine to make the developer experience faster. This allows you to not waste time re-building, re-testing, re-linting, or any number of other actions you might take on code that hasn't changed. Because the cache is stored locally, you are the only member of your team that can take advantage of these instant commands. You can manage and share this cache manually.

Nx Cloud allows this cache to be shared across your entire organization, meaning that any cacheable operation completed on your workspace only needs to be run once. Nx Cloud also allows you to distribute your CI across multiple machines to make sure the CI is fast even for very large repos.

In order to use distributed task execution, we need to start agents and set the `NX_CLOUD_DISTRIBUTED_EXECUTION` flag to `true`.
We enable agents to listen for Nx commands using:

```bash
npx nx-cloud start-agent
```

and notify Nx Cloud of the upcoming Nx commands using:

```bash
npx nx-cloud start-ci-run
```

Once all tasks are finished, we must not forget to cleanup used agents:

```bash
npx nx-cloud stop-all-agents
```

Learn more about configuring your CI environment using Nx Cloud with [Distributed Caching](/nx-cloud/set-up/set-up-caching) and [Distributed Task Execution](/nx-cloud/set-up/set-up-dte) in the Nx Cloud docs.

{% /nx-cloud-section %}

## CI provider specific documentation

The following guides cover optimizing your CI/CD environments with affected commands and distributed caching:

- [Setting up CI using Azure Pipelines](/ci/monorepo-ci-azure)
- [Setting up CI using CircleCI](/ci/monorepo-ci-circle-ci)
- [Setting up CI using GitHub Actions](/ci/monorepo-ci-github-actions)
- [Setting up CI using Jenkins](/ci/monorepo-ci-jenkins)
- [Setting up CI using GitLab](/ci/monorepo-ci-gitlab)
- [Setting up CI using Bitbucket](/ci/monorepo-ci-bitbucket)
