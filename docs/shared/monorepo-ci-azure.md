# Distributed CI Using Azure Pipelines

Nx is a set of smart and extensible build framework, and it works really well with monorepos. Monorepos provide a lot of advantages:

- Everything at that current commit works together. Changes can be verified across all affected parts of the organization.
- Easy to split code into composable modules
- Easier dependency management
- One toolchain setup
- Code editors and IDEs are "workspace" aware
- Consistent developer experience
- ...

But they come with their own technical challenges. The more code you add into your repository, the slower the CI gets.

## Example Workspace

[This repo](https://github.com/nrwl/nx-azure-build) is an example Nx Workspace. It has two applications. Each app has 15 libraries, each of which consists of 30 components. The two applications also share code.

If you run `nx dep-graph`, you will see something like this:

![dependency-graph](/shared/ci-graph.png)

### CI Provider

This example will use Azure Pipelines, but a very similar setup will work with CircleCI, Jenkins, GitLab, etc..

### **To see CI runs click [here](https://dev.azure.com/nrwlio/nx-azure-ci/_build?definitionId=6&_a=summary).**

## Baseline

Most projects that don't use Nx end up building, testing, and linting every single library and application in the repository. The easiest way to implement it with Nx is to do something like this:

```yaml
jobs:
  - job: pr
    pool:
      vmImage: 'ubuntu-latest'
    condition: eq(variables['Build.Reason'], 'PullRequest'))
    steps:
      - script: yarn install
      - script: yarn nx run-many --target=test --all
      - script: yarn nx run-many --target=lint --all
      - script: yarn nx run-many --target=build --all --prod
```

This will retest, relint, rebuild every project. Doing this for this repository takes about 45 minutes (note that most enterprise monorepos are significantly larger, so in those cases we are talking about many hours.)

The easiest way to make your CI faster is to do less work, and Nx is great at that.

## Building Only What is Affected

Nx knows what is affected by your PR, so it doesn't have to test/build/lint everything. Say the PR only touches `ng-lib9`. If you run `nx affected:dep-graph`, you will see something like this:

![dependency-graph one library affected](/shared/ci-graph-one-affected.png)

If you update `azure-pipelines.yml` to use `nx affected` instead of `nx run-many`:

```yaml
jobs:
  - job: pr
    timeoutInMinutes: 120
    pool:
      vmImage: 'ubuntu-latest'
    condition: eq(variables['Build.Reason'], 'PullRequest'))
    steps:
      - script: yarn install
      - script: yarn nx affected --target=test --base=origin/main
      - script: yarn nx affected --target=lint --base=origin/main
      - script: yarn nx affected --target=build --base=origin/main
```

The CI time will go down from 45 minutes to 8 minutes.

This is a good result. It helps to lower the average CI time, but doesn't help with the worst case scenario. Some PR are going to affect a large portion of the repo.

![dependency-graph everything affected](/shared/ci-graph-everything-affected.png)

You could make it faster by running the commands in parallel:

```yaml
jobs:
  - job: pr
    timeoutInMinutes: 120
    pool:
      vmImage: 'ubuntu-latest'
    condition: eq(variables['Build.Reason'], 'PullRequest'))
    steps:
      - script: yarn install
      - script: yarn nx affected --target=build --parallel --max-parallel=3
      - script: yarn nx affected --target=test --parallel --max-parallel=2
```

This helps but it still has a ceiling. At some point, this won't be enough. A single agent is simply insufficient. You need to distribute CI across a grid of machines.

## Distributed CI with Nx Cloud

A computation cache is created on your local machine to make the developer experience faster. This allows you to not waste time re-building, re-testing, re-linting, or any number of other actions you might take on code that hasn’t changed. Since the cache is stored locally, you are the only member of your team that can take advantage of these instant commands.

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

The `distributed_tasks` job figures out what is affected and what needs to run on what agent.

```yaml
jobs:
  - job: distributed_tasks
    pool:
      vmImage: 'ubuntu-latest'
    variables:
      IS_PR: $[ eq(variables['Build.Reason'], 'PullRequest') ]
    steps:
      - template: .azure-pipelines/steps/install-node-modules.yml
      - powershell: echo "##vso[task.setvariable variable=COMMANDS;isOutput=true]$(node ./tools/scripts/calculate-commands.js $(IS_PR))"
        name: setCommands
      - script: echo $(setCommands.COMMANDS)
        name: echoCommands
```

Where `calculate-commands.js` looks like this:

```javascript
const execSync = require('child_process').execSync;
const isMain = process.argv[2] === 'False';
const baseSha = isMain ? 'origin/main~1' : 'origin/main';

// prints an object with keys {lint1: [...], lint2: [...], lint3: [...], test1: [...], .... build3: [...]}
console.log(
  JSON.stringify({
    ...commands('lint'),
    ...commands('test'),
    ...commands('build'),
  })
);

function commands(target) {
  const array = JSON.parse(
    execSync(`npx nx print-affected --base=${baseSha} --target=${target}`)
      .toString()
      .trim()
  ).tasks.map((t) => t.target.project);

  array.sort(() => 0.5 - Math.random());
  const third = Math.floor(array.length / 3);
  const a1 = array.slice(0, third);
  const a2 = array.slice(third, third * 2);
  const a3 = array.slice(third * 2);
  return {
    [target + '1']: a1,
    [target + '2']: a2,
    [target + '3']: a3,
  };
}
```

Let's step through it:

The following defines the base sha Nx uses to execute affected commands.

```javascript
const isMain = process.argv[2] === 'False';
const baseSha = isMain ? 'origin/main~1' : 'origin/main';
```

If it is a PR, Nx sees what has changed compared to `origin/main`. If it's main, Nx sees what has changed compared to the previous commit (this can be made more robust by remembering the last successful main run, which can be done by labeling the commit).

The following prints information about affected project that have the needed target. `print-affected` doesn't run any targets, just prints information about them.

```javascript
execSync(`npx nx print-affected --base=${baseSha} --target=${target}`)
  .toString()
  .trim();
```

The rest of the `commands` splits the list of projects into three groups or bins.

### Other Jobs

Other jobs use the information created by `distributed_tasks` to execute the needed tasks.

```yaml
- job: lint1
  dependsOn: distributed_tasks # this tells lin1 to wait for distributed_tasks to complete
  condition: |
    and(
      succeeded(),
      not(contains(
        dependencies.distributed_tasks.outputs['setCommands.COMMANDS'],
        '"lint1":[]'
      ))
    )
  pool:
    vmImage: 'ubuntu-latest'
  variables:
    COMMANDS: $[ dependencies.distributed_tasks.outputs['setCommands.COMMANDS'] ]
  steps:
    - template: .azure-pipelines/steps/install-node-modules.yml
    - script: node ./tools/scripts/run-many.js '$(COMMANDS)' lint1 lint
```

where `run-many.js`:

```javascript
const execSync = require('child_process').execSync;

const commands = JSON.parse(process.argv[2]);
const projects = commands[process.argv[3]];
const target = process.argv[4];
execSync(
  `yarn nx run-many --target=${target} --projects=${projects.join(
    ','
  )} --parallel`,
  {
    stdio: [0, 1, 2],
  }
);
```

### Artifacts

This example doesn't do anything with the artifacts created by the build, but often you will need to upload/deploy them. There are several ways to handle it.

1. You can create a job per application and then copy the output to the staging area, and then once tests complete unstage the files in a separate job and then deploy them.
2. You can use the outputs property from running `npx nx print-affected --target=build` to stash and unstash files without having a job per app.

```json
{
  "tasks": [
    {
      "id": "react-app:build",
      "overrides": {},
      "target": {
        "project": "react-app",
        "target": "build"
      },
      "command": "npx nx -- build react-app",
      "outputs": [
        "dist/apps/react-app"
      ]
    },
    {
      "id": "ng-app:build",
      "overrides": {},
      "target": {
        "project": "ng-app",
        "target": "build"
      },
      "command": "npx nx -- build ng-app",
      "outputs": [
        "dist/apps/ng-app"
      ]
    }
  ],
  "dependencyGraph": {
    ...
  }
}
```

### Improvements

With these changes, rebuild/retesting/relinting everything takes only 7 minutes. The average CI time is even faster. The best part of this is that you can add more agents to your pool when needed, so the worst-case scenario CI time will always be under 15 minutes regardless of how big the repo is.

### Can We Do Better?

This example uses a fixed agent graph. This setup works without any problems for all CI providers. It also scales well for repo of almost any size. So before doing anything more sophisticated, I'd try this approach. Some CI providers (e.g., Jenkins) allow scaling the number of agents dynamically. The `print-affected` and `run-many` commands can be used to implement those setups as well.

## Summary

1. Rebuilding/retesting/relinting everything on every code change doesn't scale. **In this example it takes 45 minutes.**
2. Nx lets you rebuild only what is affected, which drastically improves the average CI time, but it doesn't address the worst-case scenario.
3. Nx helps you run multiple targets in parallel on the same machine.
4. Nx provides `print-affected` and `run-many` which make implemented distributed CI simple. **In this example the time went down from 45 minutes to only 7**
