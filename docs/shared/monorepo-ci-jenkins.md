# Distributed CI Using Jenkins

Nx is a set of smart and extensible build framework, and it works well with monorepos. Monorepos provide a lot of advantages:

- Everything at that current commit works together. Changes can be verified across all affected parts of the organization.
- Easy to split code into composable modules
- Easier dependency management
- One toolchain setup
- Code editors and IDEs are "workspace" aware
- Consistent developer experience
- ...

However, they come with their own technical challenges. The more code you add into your repository, the slower the CI gets.

## Example Workspace

[This repo](https://github.com/nrwl/nx-jenkins-build) is an example Nx Workspace. It has two applications. Each app has 15 libraries, each of which consists of 30 components. The two applications also share code.

If you run `nx dep-graph`, you will see something like this:

![dependency-graph](/shared/ci-graph.png)

### CI Provider

This example will use Jenkins. An [azure pipelines example](https://github.com/nrwl/nx-azure-build) is here, but it should not be too hard to implement the same setup on other platforms.

## Baseline

Most projects that don't use Nx end up building, testing, and linting every single library and application in the repository. The easiest way to implement it with Nx is to do something like this:

```groovy
node {
  withEnv(["HOME=${workspace}"]) {
    docker.image('node:latest').inside('--tmpfs /.config') {
      stage("Prepare") {
        checkout scm
        sh 'yarn install'
      }

      stage("Test") {
        sh 'yarn nx run-many --target=test --all'
      }

      stage("Lint") {
        sh 'yarn nx run-many --target=lint --all'
      }

      stage("Build") {
        sh 'yarn nx run-many --target=build --all --prod'
      }
    }
  }
}
```

This will retest, relint, rebuild every project. Doing this for this repository takes about 45 minutes (note that most enterprise monorepos are significantly larger, so in those cases we are talking about many hours.)

The easiest way to make your CI faster is to do less work, and Nx is great at that.

## Building Only What is Affected

Nx knows what is affected by your PR, so it doesn't have to test/build/lint everything. Say the PR only touches `ng-lib9`. If you run `nx affected:dep-graph`, you will see something like this:

![dependency-graph one library affected](/shared/ci-graph-one-affected.png)

If you update `azure-pipelines.yml` to use `nx affected` instead of `nx run-many`:

```groovy
node {
  withEnv(["HOME=${workspace}"]) {
    docker.image('node:latest').inside('--tmpfs /.config') {
      stage("Prepare") {
        checkout scm
        sh 'yarn install'
      }

      stage("Test") {
        sh 'yarn nx affected --target=test --base= origin/main'
      }

      stage("Lint") {
        sh 'yarn nx affected --target=lint --base= origin/main'
      }

      stage("Build") {
        sh 'yarn nx affected --target=build --base= origin/main --prod'
      }
    }
  }
}
```

the CI time will go down from 45 minutes to 8 minutes.

This is a good result. It helps to lower the average CI time, but doesn't help with the worst case scenario. Some PR are going to affect a large portion of the repo.

![dependency-graph everything affected](/shared/ci-graph-everything-affected.png)

You could make it faster by running the commands in parallel:

```groovy
node {
  withEnv(["HOME=${workspace}"]) {
    docker.image('node:latest').inside('--tmpfs /.config') {
      stage("Prepare") {
        checkout scm
        sh 'yarn install'
      }

      stage("Test") {
        sh 'yarn nx affected --target=test --base= origin/main --parallel'
      }

      stage("Lint") {
        sh 'yarn nx affected --target=lint --base= origin/main --parallel'
      }

      stage("Build") {
        sh 'yarn nx affected --target=build --base= origin/main --prod --parallel'
      }
    }
  }
}
```

This helps, but it still has a ceiling. At some point, this won't be enough. A single agent is simply insufficient. You need to distribute CI across a grid of machines.

## Distributed CI with Nx Cloud

A computation cache is created on your local machine to make the developer experience faster. This allows you to not waste time re-building, re-testing, re-linting, or any number of other actions you might take on code that hasn’t changed. Because the cache is stored locally, you are the only member of your team that can take advantage of these instant commands.

Nx Cloud allows this cache to be shared across your entire organization, meaning that any cacheable operation completed on your workspace only needs to be run once.

Learn more about [configuring your CI](https://nx.app/docs/configuring-ci) environment using Nx Cloud with [Distributed Caching](https://nx.app/docs/distributed-caching) and [Distributed Task Execution](https://nx.app/docs/distributed-execution) in the Nx Cloud docs.

## Distributed CI with Binning

To distribute you need to split your job into multiple jobs.

```

                          / lint1
Prepare Distributed Tasks - lint2
                          - lint3
                          - test1
                          ....
                          \ build3

```

### Distributed Setup

```groovy
def distributedTasks = [:]

stage("Building Distributed Tasks") {
  jsTask {
    checkout scm
    sh 'yarn install'

    distributedTasks << distributed('test', 3)
    distributedTasks << distributed('lint', 3)
    distributedTasks << distributed('build', 3)
  }
}

stage("Run Distributed Tasks") {
  parallel distributedTasks
}

def jsTask(Closure cl) {
  node {
    withEnv(["HOME=${workspace}"]) {
      docker.image('node:latest').inside('--tmpfs /.config', cl)
    }
  }
}

def distributed(String target, int bins) {
  def jobs = splitJobs(target, bins)
  def tasks = [:]

  jobs.eachWithIndex { jobRun, i ->
    def list = jobRun.join(',')
    def title = "${target} - ${i}"

    tasks[title] = {
      jsTask {
        stage(title) {
          checkout scm
          sh 'yarn install'
          sh "npx nx run-many --target=${target} --projects=${list} --parallel"
        }
      }
    }
  }

  return tasks
}

def splitJobs(String target, int bins) {
  def String baseSha = env.CHANGE_ID ? ' origin/main' : ' origin/main~1'
  def String raw
  raw = sh(script: "npx nx print-affected --base=${baseSha} --target=${target}", returnStdout: true)
  def data = readJSON(text: raw)

  def tasks = data['tasks'].collect { it['target']['project'] }

  if (tasks.size() == 0) {
    return tasks
  }

  // this has to happen because Math.ceil is not allowed by jenkins sandbox (╯°□°）╯︵ ┻━┻
  def c = sh(script: "echo \$(( ${tasks.size()} / ${bins} ))", returnStdout: true).toInteger()
  def split = tasks.collate(c)

  return split
}

```

Let's step through it:

To run jobs in parallel with jenkins, we need to construct a map of `string -> closure` where `closure` contains the code we want to be running
in parallel. The goal of the `distributed` function is to build a compatible map. It starts by figuring out what jobs need to be run, and
splitting them into bins via `splitJobs`.

Looking at `splitJobs`, the following defines the base sha Nx uses to execute affected commands.

```groovy
  def String baseSha = env.CHANGE_ID ? ' origin/main' : ' origin/main~1'
```

Jenkins will only have a CHANGE_ID if it is a PR.

If it is a PR, Nx sees what has changed compared to ` origin/main`. If it's main, Nx sees what has changed compared to the previous commit (this can be made more robust by remembering the last successful main run, which can be done by labeling the commit).

The following prints information about affected project that have the needed target. `print-affected` doesn't run any targets, just prints information about them.

```groovy
def String raw
jsTask { raw = sh(script: "npx nx print-affected --base=${baseSha} --target=${target}", returnStdout: true) }
def data = readJSON(text: raw)
```

We split the jobs into bins with `collate`.

Once we have our lists of jobs, we can go back to the `distributed` method. We loop over the list of split jobs for our target,
and construct the map that jenkins requires to parallelize our jobs.

```groovy
def tasks = [:]

jobs.eachWithIndex { jobRun, i ->
jsTask { echo 'loop' }

def list = jobRun.join(',')
def title = "${target} - ${i}"

tasks[title] = {
  jsTask {
    stage(title) {
      sh "npx nx run-many --target=${target} --projects=${list} --parallel"
    }
  }
}
}
```

finally, we merge each map of target jobs into a big map, and pass that to `parallel`.

```groovy
stage("Building Distributed Tasks") {
  jsTask {
    checkout scm
    sh 'yarn install'

    distributedTasks << distributed('test', 3)
    distributedTasks << distributed('lint', 3)
    distributedTasks << distributed('build', 3)
  }
}

```

### Improvements

With these changes, rebuild/retesting/relinting everything takes only 7 minutes. The average CI time is even faster. The best part of this is that you can add more agents to your pool when needed, so the worst-case scenario CI time will always be under 15 minutes regardless of how big the repo is.

## Summary

1. Rebuilding/retesting/relinting everything on every code change doesn't scale. **In this example it takes 45 minutes.**
2. Nx lets you rebuild only what is affected, which drastically improves the average CI time, but it doesn't address the worst-case scenario.
3. Nx helps you run multiple targets in parallel on the same machine.
4. Nx provides `print-affected` and `run-many` which make implemented distributed CI simple. **In this example the time went down from 45 minutes to only 7**
