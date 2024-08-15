# Connect to Nx Cloud

Nx Cloud directly integrates with your existing CI setup.

![Nx Cloud Overview](/shared/images/nx-cloud/nx-cloud-overview.webp)

Here's how you get set up.

## Step 1: Connect your workspace to Nx Cloud

To connect your workspace, **push it to GitHub** (or your respective source control provider) and then run:

```shell
npx nx connect
```

## Step 2: Configure your CI script

If you have CI set up already, configure [distribution with Nx Agents](/ci/features/distribute-task-execution) as follows:

```yml
- name: Start CI run
  run: 'npx nx-cloud start-ci-run --distribute-on="8 linux-medium-js"'
```

Alternatively you can generate the CI configuration using:

```shell
npx nx g ci-workflow
```

Or, check out our [recipes for the various CI providers](/ci/recipes/set-up).

## Step 3: Run your Nx commands as usual

```yml
- run: npx nx-cloud record -- node tools/custom-script.js
- run: npx nx affected -t lint test build e2e-ci
```

All these commands are automatically picked up by Nx Cloud, split up into smaller tasks and distributed across the specified number of machines. Nx Cloud works with Nx tasks automatically, or you can [record non-Nx commands with `nx-cloud record`](/ci/recipes/other/record-commands).

## Step 4: All results are played back automatically

Nx Cloud automatically plays back all results to your CI system, as if distribution never happened. You can continue doing post-processing on the results, like uploading test reports, deploying artifacts etc.
