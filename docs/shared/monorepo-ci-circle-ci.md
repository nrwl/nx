# Configuring CI Using Circle CI and Nx

Below is an example of an Circle CI setup, building and testing only what is affected.

```yaml {% fileName=".circleci/config.yml" %}
version: 2.1
orbs:
  nx: nrwl/nx@1.5.1
jobs:
  main:
    docker:
      - image: cimg/node:lts-browsers
    steps:
      - checkout
      - run: npx nx-cloud start-ci-run --distribute-on="5 linux-medium-js" --stop-agents-after="build" # this line enables distribution
      - run: npm ci
      - nx/set-shas

      - run: npx nx-cloud record -- nx format:check
      - run: npx nx affected --base=$NX_BASE --head=$NX_HEAD -t lint test build --parallel=3
workflows:
  build:
    jobs:
      - main
```

### Get the Commit of the Last Successful Build

`CircleCI` can track the last successful run on the `main` branch and use this as a reference point for the `BASE`. The `Nx Orb` provides a convenient implementation of this functionality which you can drop into your existing CI config. Specifically, `nx/set-shas` populates the `$NX_BASE` environment variable with the commit SHA of the last successful run.

To understand why knowing the last successful build is important for the affected command, check out the [in-depth explanation in Orb's docs](https://github.com/nrwl/nx-orb#background).

### Using CircleCI in a private repository

To use the [Nx Orb](https://github.com/nrwl/nx-orb) with a private repository on your main branch, you need to grant the orb access to your CircleCI API. You can do this by creating an environment variable called `CIRCLE_API_TOKEN` in the context or the project.

{% callout type="warning" title="Caution" %}
It should be a user token, not the project token.
{% /callout %}
