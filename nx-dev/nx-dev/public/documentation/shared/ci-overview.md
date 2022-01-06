# Continous Integration Setup with Monorepos and Nx

Monorepos provide a lot of advantages:

- Everything at that current commit works together. Changes can be verified across all affected parts of the organization.
- Easy to split code into composable modules
- Easier dependency management
- One toolchain setup
- Code editors and IDEs are "workspace" aware
- Consistent developer experience
- And more ...

But they come with their own technical challenges. The more code you add into your repository and the more code you have to build/test/lint, the slower the CI gets. There are two ways to look at this time spent. In average time, and worst case scenario time. When configured properly, your average CI is the time it takes a given change to go through the CI process. The worst case scenario time is the time it takes to rebuild every project in your monorepo based on a given change. These are baseline you use to measure how long it takes to process pull requests in your CI/CD environment.

The following guides cover optimizing your CI/CD environments with affected commands and distributed caching:

- [Setting up CI using GitHub Actions](/ci/monorepo-ci-github-actions)
- [Setting up CI using CircleCI](/ci/monorepo-ci-circle-ci)
- [Setting up CI using Azure Pipelines](/ci/monorepo-ci-azure)
- [Setting up CI using Jenkins](/ci/monorepo-ci-jenkins)
