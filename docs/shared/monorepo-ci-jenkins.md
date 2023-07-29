# Configuring CI Using Jenkins and Nx

Below is an example of a Jenkins setup for an Nx workspace - building and testing only what is affected.

Unlike `GitHub Actions` and `CircleCI`, you don't have the metadata to help you track the last successful run on `main`. In the example below, the base is set to `HEAD~1` (for push) or branching point (for pull requests), but a more robust solution would be to tag an SHA in the main job once it succeeds and then use this tag as a base. See the [nx-tag-successful-ci-run](https://github.com/nrwl/nx-tag-successful-ci-run) and [nx-set-shas](https://github.com/nrwl/nx-set-shas) (version 1 implements tagging mechanism) repositories for more information.

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
                        sh "npx nx format:check"
                        sh "npx nx affected --base=HEAD~1 -t lint --parallel=3"
                        sh "npx nx affected --base=HEAD~1 -t test --parallel=3"
                        sh "npx nx affected --base=HEAD~1 -t build --parallel=3"
                    }
                }
                stage('PR') {
                    when {
                        not { branch 'main' }
                    }
                    agent any
                    steps {
                        sh "npm ci"
                        sh "npx nx format:check"
                        sh "npx nx affected --base origin/${env.CHANGE_TARGET} -t lint --parallel=3"
                        sh "npx nx affected --base origin/${env.CHANGE_TARGET} -t test --parallel=3 --configuration=ci"
                        sh "npx nx affected --base origin/${env.CHANGE_TARGET} -t build --parallel=3"
                    }
                }
            }
        }
    }
}
```

The `pr` and `main` jobs implement the CI workflow.

{% nx-cloud-section %}

## Distributed CI with Nx Cloud

Read more about [Distributed Task Execution (DTE)](/core-features/distribute-task-execution).

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
                        sh "npx nx-cloud start-ci-run --stop-agents-after='build'"
                        sh "npx nx format:check"
                        sh "npx nx affected --base=HEAD~1 -t lint --parallel=3 & npx nx affected --base=HEAD~1 -t test --parallel=3 --configuration=ci & npx nx affected --base=HEAD~1 -t build --parallel=3"
                    }
                }
                stage('PR') {
                    when {
                        not { branch 'main' }
                    }
                    agent any
                    steps {
                        sh "npm ci"
                        sh "npx nx-cloud start-ci-run --stop-agents-after='build'"
                        sh "npx nx format:check"
                        sh "npx nx affected --base origin/${env.CHANGE_TARGET} -t lint --parallel=3 & npx nx affected --base origin/${env.CHANGE_TARGET} -t test --parallel=3 --configuration=ci & npx nx affected --base origin/${env.CHANGE_TARGET} -t build --parallel=3"
                    }
                }

                # Add as many agent you want
                stage('Agent1') {
                   agent any
                   steps {
                    sh "npm ci"
                    sh "npx nx-cloud start-agent"
                   }
                }
                stage('Agent2') {
                   agent any
                   steps {
                    sh "npm ci"
                    sh "npx nx-cloud start-agent"
                   }
                }
                stage('Agent3') {
                   agent any
                   steps {
                    sh "npm ci"
                    sh "npx nx-cloud start-agent"
                   }
                }
            }
        }
    }
}
```

{% /nx-cloud-section %}
