# Custom Distributed Task Execution on Jenkins

Using [Nx Agents](/ci/features/distribute-task-execution) is the easiest way to distribute task execution, but it your organization may not be able to use hosted Nx Agents. With an [enterprise license](/enterprise), you can set up distributed task execution on your own CI provider using the recipe below.

## Distribute Tasks Across Custom Agents on Jenkins

Run agents directly on Jenkins with the workflow below:

```groovy
pipeline {
    agent none
    environment {
        NX_BRANCH = env.BRANCH_NAME.replace('PR-', '')
        NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT = 3
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
                        sh "npx nx-cloud start-ci-run --distribute-on='manual' --stop-agents-after='e2e-ci'"
                        sh "npx nx-cloud record -- nx format:check"
                        sh "npx nx affected --base=HEAD~1 -t lint,test,build,e2e-ci --configuration=ci --parallel=2"
                    }
                }
                stage('PR') {
                    when {
                        not { branch 'main' }
                    }
                    agent any
                    steps {
                        sh "npm ci"
                        sh "npx nx-cloud start-ci-run --distribute-on='manual' --stop-agents-after='e2e-ci'"
                        sh "npx nx-cloud record -- nx format:check"
                        sh "npx nx affected --base origin/${env.CHANGE_TARGET} -t lint,test,build,e2e-ci --parallel=2 --configuration=ci"
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
