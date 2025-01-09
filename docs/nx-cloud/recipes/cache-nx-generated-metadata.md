# Speed up your CI by caching Nx generated metadata

Nx generates metadata files—referred to as workspace data—on initialization, which it uses to intelligently run commands and integrate with plugins. Large monorepos often contain numerous projects with complex relationships, making metadata generation more time-consuming.

Updating existing workspace data is faster than creating it from scratch. To avoid regenerating this data for each CI run, Nx Cloud supports workspace data caching. By caching workspace data from previous runs and reusing it in future runs, we can reduce the time needed to prepare the workspace.

## How does it work?

When in a CI context, Nx Cloud will automatically cache the contents of your workspace data and upload it to our remote cache.
This data will only be uploaded when you run CI on your workspaces default branch.

To leverage your cached workspace data, you can use the following command while authenticated with `read-write` access:

```bash
npx nx-cloud get-workspace-data
```

This will download your cached workspace data to your workspace.

## What does this look like in practice?

The following is an example of a CI configuration that uses the `get-workspace-data` command to download the workspace data:

```yaml
name: Nx Cloud - CI
on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npx nx-cloud@latest start-ci-run

      # Invoke this command before your first nx command
      - run: npx nx-cloud get-workspace-data
      - run: npx nx affected
```
