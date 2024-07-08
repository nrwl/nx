# Connect to Nx Cloud

Nx Cloud directly integrates with your existing CI setup.

![Nx Cloud Overview](/shared/images/nx-cloud/nx-cloud-overview.webp)

In a nutshell, here's how this works:

**Step 1: Connect your workspace to Nx Cloud**

This can be done by signing up on [nx.app](https://nx.app) and then connecting to your git repository.

```shell
npx nx connect
```

**Step 2: Your CI script triggers Nx Cloud**

```yml
- name: Start CI run
  run: 'npx nx-cloud start-ci-run --distribute-on="8 linux-medium-js"'
```

Let us generate the workflow file for you, if you don't already have one.

```shell
npx nx g ci-workflow
```

Or, check out our [recipes for the various CI providers](/ci/recipes/set-up).

**Step 3: Run your Nx commands as usual**

```yml
- run: npx nx-cloud record -- nx format:check
- run: npx nx affected -t lint test build
- run: npx nx affected -t e2e-ci --parallel 1
```

All these commands are automatically picked up by Nx Cloud, split up into smaller tasks and distributed across the specified number of machines.

**Step 4: All results are played back automatically**

Nx Cloud automatically plays back all results to your CI system, as if distribution never happened. You can continue doing post-processing on the results, like uploading test reports, deploying artifacts etc.
