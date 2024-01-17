# Configuring CI Using Jenkins and Nx

There are two general approaches to setting up CI with Nx - using a single job or distributing tasks across multiple jobs. For smaller repositories, a single job is faster and cheaper, but once a full CI run starts taking 10 to 15 minutes, using multiple jobs becomes the better option. Nx Cloud's distributed task execution allows you to keep the CI pipeline fast as you scale. As the repository grows, all you need to do is add more agents.

## Process Only Affected Projects With One Job on Jenkins

Below is an example of an Jenkins setup that runs on a single job, building and testing only what is affected. This uses the [`nx affected` command](/ci/features/affected) to run the tasks only for the projects that were affected by that PR.

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
                        sh "npx nx-cloud record -- nx format:check"
                        sh "npx nx affected --base=HEAD~1 -t lint,test,build --parallel=3"
                    }
                }
                stage('PR') {
                    when {
                        not { branch 'main' }
                    }
                    agent any
                    steps {
                        sh "npm ci"
                        sh "npx nx-cloud record -- nx format:check"
                        sh "npx nx affected --base origin/${env.CHANGE_TARGET} -t lint,test,build --parallel=3"
                    }
                }
            }
        }
    }
}
```

### Get the Commit of the Last Successful Build

Unlike `GitHub Actions` and `CircleCI`, you don't have the metadata to help you track the last successful run on `main`. In the example below, the base is set to `HEAD~1` (for push) or branching point (for pull requests), but a more robust solution would be to tag an SHA in the main job once it succeeds and then use this tag as a base. See the [nx-tag-successful-ci-run](https://github.com/nrwl/nx-tag-successful-ci-run) and [nx-set-shas](https://github.com/nrwl/nx-set-shas) (version 1 implements tagging mechanism) repositories for more information.

We also have to set `NX_BRANCH` explicitly.

## Distribute Tasks Across Agents on Jenkins

To set up [Distributed Task Execution (DTE)](/ci/features/distribute-task-execution), you can copy and paste the workflow below:

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
                        sh "npx nx-cloud record -- nx format:check"
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
                        sh "npx nx-cloud record -- nx format:check"
                        sh "npx nx affected --base origin/${env.CHANGE_TARGET} -t lint --parallel=2 & npx nx affected --base origin/${env.CHANGE_TARGET} -t test --parallel=2 --configuration=ci & npx nx affected --base origin/${env.CHANGE_TARGET} -t build --parallel=2"
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

This configuration is setting up two types of jobs - a main job and three agent jobs.

The main job tells Nx Cloud to use DTE and then runs normal Nx commands as if this were a single pipeline set up. Once the commands are done, it notifies Nx Cloud to stop the agent jobs.

The agent jobs set up the repo and then wait for Nx Cloud to assign them tasks.

{% callout type="warning" title="Two Types of Parallelization" %}
The agents and the `--parallel` flag both parallelize tasks, but in different ways. The way this workflow is written, there will be 3 agents running tasks and each agent will try to run 2 tasks at once. If a particular CI run only has 2 tasks, only one agent will be used.
{% /callout %}
