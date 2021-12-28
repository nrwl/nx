# Configuring CI Using Bitbucket Pipelines and Nx

Nx is a smart, fast and extensible build system, and it works really well with monorepos. Monorepos provide a lot of advantages:

- Everything at that current commit works together. Changes can be verified across all affected parts of the organization.
- Easy to split code into composable modules
- Easier dependency management
- One toolchain setup
- Code editors and IDEs are "workspace" aware
- Consistent developer experience
- And more ...

But they come with their own technical challenges. The more code you add into your repository, the slower the CI gets.

## Setting Bitbucket Pipelines

Below is an example of a Bitbucket Pipeline setup for an Nx workspace only building and testing what is affected.

```yaml
...

pipelines:
  pull-requests:
    '**':
      - step:
          name: "Build and test affected apps on Pull Requests"
          caches: # optional
          - node
          script: 
            - npm i
            - npx nx affected --target=build --base=origin/master --head=HEAD --parallel  --max-parallel=3
            - npx nx affected --target=test --base=origin/master --head=HEAD --parallel --max-parallel=2

  branches:
    main:
      - step:
        name: "Build and test affected apps on 'main' branch changes"
          caches: # optional
          - node
          script:
            - npm i
            - npx nx affected --target=build --base=HEAD~1 --parallel  --max-parallel=3
            - npx nx affected --target=test --base=HEAD~1 --parallel --max-parallel=2
```

The `pull-requests` and `main` jobs implement the CI workflow.

## Distributed CI with Nx Cloud

A computation cache is created on your local machine to make the developer experience faster. This allows you to not waste time re-building, re-testing, re-linting, or any number of other actions you might take on code that hasn't changed. Because the cache is stored locally, you are the only member of your team that can take advantage of these instant commands. You can manage and share this cache manually.

Nx Cloud allows this cache to be shared across your entire organization, meaning that any cacheable operation completed on your workspace only needs to be run once. Nx Cloud also allows you to distribute your CI across multiple machines to make sure the CI is fast even for very large repos.

Learn more about [configuring your CI](https://nx.app/docs/configuring-ci) environment using Nx Cloud with [Distributed Caching](https://nx.app/docs/distributed-caching) and [Distributed Task Execution](https://nx.app/docs/distributed-execution) in the Nx Cloud docs.

