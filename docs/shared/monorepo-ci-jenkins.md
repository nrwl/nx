# Configuring CI Using Jenkins and Nx

Below is an example of a Jenkins setup for an Nx workspace only building and testing what is affected.

Unlike `GitHub Actions` and `CircleCI`, you don't have the metadata to help you track the last successful run on `main`. In the example below, the base is set to `HEAD~1` (for push) or branching point (for pull requests), but a more robust solution would be to tag a SHA in the main job once it succeeds, and then use this tag as a base. See the [nx-tag-successful-ci-run](https://github.com/nrwl/nx-tag-successful-ci-run) and [nx-set-shas](https://github.com/nrwl/nx-set-shas) (version 1 implements tagging mechanism) repos for more information.

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
                        sh "npm ci"
                        sh "npx nx workspace-lint"
                        sh "npx nx format:check"
                        sh "npx nx affected --base=HEAD~1 --target=lint --parallel=3"
                        sh "npx nx affected --base=HEAD~1 --target=test --parallel=3"
                        sh "npx nx affected --base=HEAD~1 --target=build --parallel=3"
                    }
                }
                stage('PR') {
                    when {
                        not { branch 'main' }
                    }
                    agent any
                    steps {
                        sh "npm ci"
                        sh "npx nx workspace-lint"
                        sh "npx nx format:check"
                        sh "npx nx affected --base origin/${env.CHANGE_TARGET} --target=lint --parallel=3"
                        sh "npx nx affected --base origin/${env.CHANGE_TARGET} --target=test --parallel=3 --ci  --code-coverage"
                        sh "npx nx affected --base origin/${env.CHANGE_TARGET} --target=build --parallel=3"
                    }
                }
            }
        }
    }
}
```

The `pr` and `main` jobs implement the CI workflow.

<div class="nx-cloud-section">

## Distributed CI with Nx Cloud

In order to use distributed task execution, we need to start agents and set the `NX_CLOUD_DISTRIBUTED_EXECUTION` flag to `true`.

Read more about the [Distributed CI setup with Nx Cloud](/using-nx/ci-overview#distributed-ci-with-nx-cloud).

```groovy
pipeline {
    agent none
    environment {
        NX_BRANCH = env.BRANCH_NAME.replace('PR-', '')
        NX_CLOUD_DISTRIBUTED_EXECUTION = true
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
                        sh "npm ci"
                        sh "npx nx-cloud start-ci-run"
                        sh "npx nx workspace-lint"
                        sh "npx nx format:check"
                        sh "npx nx affected --base=HEAD~1 --target=lint --parallel=3"
                        sh "npx nx affected --base=HEAD~1 --target=test --parallel=3 --ci --code-coverage"
                        sh "npx nx affected --base=HEAD~1 --target=build --parallel=3"
                        sh "npx nx-cloud stop-all-agents"
                    }
                }
                stage('PR') {
                    when {
                        not { branch 'main' }
                    }
                    agent any
                    steps {
                        sh "npm ci"
                        sh "npx nx-cloud start-ci-run"
                        sh "npx nx workspace-lint"
                        sh "npx nx format:check"
                        sh "npx nx affected --base origin/${env.CHANGE_TARGET} --target=lint --parallel=3"
                        sh "npx nx affected --base origin/${env.CHANGE_TARGET} --target=test --parallel=3 --ci --code-coverage"
                        sh "npx nx affected --base origin/${env.CHANGE_TARGET} --target=build --parallel=3"
                        sh "npx nx-cloud stop-all-agents"
                    }
                }
            }
        }
    }
}
```

</div>
