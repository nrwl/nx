# Configuring CI Using Jenkins and Nx

Nx is a smart, fast and extensible build system, and it works really well with monorepos. Monorepos provide a lot of advantages:

- Everything at that current commit works together. Changes can be verified across all affected parts of the organization.
- Easy to split code into composable modules
- Easier dependency management
- One toolchain setup
- Code editors and IDEs are "workspace" aware
- Consistent developer experience
- And more ...

But they come with their own technical challenges. The more code you add into your repository, the slower the CI gets. Adding Nx to your CI pipeline makes this more efficient.

## Setting up Jenkins

Below is an example of a Jenkins setup for an Nx workspace only building and testing what is affected.

Unlike `GitHub Actions` and `CircleCI`, you don't have the metadata to help you track the last successful run on `main`. In the example below, the base is set to `HEAD~1`, but a more robust solution would be to tag a SHA in the main job once it succeeds, and then use this tag as a base.

We also have to set `NX_BRANCH` explicitly.

```groovy
pipeline {
    agent none
    environment {
        NX_BRANCH = env.BRANCH_NAME.replace('PR-', '')
    }
    stages {
        stage('Pipeline') {
            parallel {
                stage('Main') {
                    when {
                        branch 'main'
                    }
                    agent any
                    steps {
                        sh "npm install"
                        sh "npx nx-cloud start-ci-run"
                        sh "npx nx affected --base=HEAD~1 --target=build --parallel --max-parallel=3"
                        sh "npx nx affected --base=HEAD~1 --target=test --parallel --max-parallel=2"
                        sh "npx nx-cloud stop-all-agents"
                    }
                }
                stage('PR') {
                    when {
                        not { branch 'main' }
                    }
                    agent any
                    steps {
                        sh "npm install"
                        sh "npx nx-cloud start-ci-run"
                        sh "npx nx affected --base origin/${CHANGE_TARGET} --target=build --parallel --max-parallel=3"
                        sh "npx nx affected --base origin/${CHANGE_TARGET} --target=test --parallel --max-parallel=2"
                        sh "npx nx-cloud stop-all-agents"
                    }
                }
            }
        }
    }
}
```

The `pr` and `main` jobs implement the CI workflow.

## Distributed CI with Nx Cloud

A computation cache is created on your local machine to make the developer experience faster. This allows you to not waste time re-building, re-testing, re-linting, or any number of other actions you might take on code that hasn't changed. Because the cache is stored locally, you are the only member of your team that can take advantage of these instant commands. You can manage and share this cache manually.

Nx Cloud allows this cache to be shared across your entire organization, meaning that any cacheable operation completed on your workspace only needs to be run once. Nx Cloud also allows you to distribute your CI across multiple machines to make sure the CI is fast even for very large repos.

Learn more about [configuring your CI](https://nx.app/docs/configuring-ci) environment using Nx Cloud with [Distributed Caching](https://nx.app/docs/distributed-caching) and [Distributed Task Execution](https://nx.app/docs/distributed-execution) in the Nx Cloud docs.
