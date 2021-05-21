# Distributed Builds and Distributed CI

Nx uses computation caching and code change analysis (`affected:*` commands) to limit the number of things that have to be rebuilt and retested. This can drastically reduce the average CI time.

But regardless of how smart Nx is, there will be some large changes affecting the whole codebase. The only way to keep those fast as your repository keeps growing is to build and test them using multiple machines/agents.

The `print-affected` and `run-many` commands can be used to set up your CI to use multiple agents, while still rebuilding and retesting only what is affected.

Please look at the following two examples:

- [Example of setting up distributed Azure build for Nx workspace](https://github.com/nrwl/nx-azure-build)
- [Example of setting up distributed Jenkins build for Nx workspace](https://github.com/nrwl/nx-jenkins-build)

The Azure example is very easy to port to other CI providers (e.g., CircleCI, GitLab).
