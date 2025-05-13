---
type: lesson
title: Create a CI Workflow
---

## Create a CI Workflow

Use the following command to generate a CI workflow file.

```shell no-run
npx nx generate ci-workflow --ci=github
```

This generator creates a `.github/workflows/ci.yml` file that contains a CI pipeline that will run the `lint`, `test`, `build` and `e2e` tasks for projects that are affected by any given PR. If you would like to also distribute tasks across multiple machines to ensure fast and reliable CI runs, uncomment the `nx-cloud start-ci-run` line and have the `nx affected` line run the `e2e-ci` task instead of `e2e`.

The key lines in the CI pipeline are:

```yml title=".github/workflows/ci.yml" {21-24,38-39}
name: CI

on:
  push:
    branches:
      - main
  pull_request:

permissions:
  actions: read
  contents: read

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          filter: tree:0

      # This enables task distribution via Nx Cloud
      # Run this command as early as possible, before dependencies are installed
      # Learn more at https://nx.dev/ci/reference/nx-cloud-cli#npx-nxcloud-startcirun
      # Uncomment this line to enable task distribution
      # - run: npx nx-cloud start-ci-run --distribute-on="3 linux-medium-jvm" --stop-agents-after="build"

      - name: Set up JDK 21 for x64
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
          architecture: x64

      - name: Setup Gradle
        uses: gradle/gradle-build-action@v2

      - uses: nrwl/nx-set-shas@v4

      # Nx Affected runs only tasks affected by the changes in this PR/commit. Learn more: https://nx.dev/ci/features/affected
      - run: ./nx affected -t test build
```
