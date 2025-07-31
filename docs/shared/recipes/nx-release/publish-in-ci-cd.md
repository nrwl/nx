---
title: Publish in CI/CD
description: Learn how to configure Nx Release to automate your package publishing process in CI/CD pipelines across different ecosystems including npm, Docker, and Rust.
---

# Publish in CI/CD

Nx Release makes it easy to move your publishing process into your CI/CD pipeline across different package ecosystems.

## General Concepts

### Automatically Skip Publishing Locally

When running `nx release`, after the version updates and changelog generation, you will be prompted with the following question:

```{% command="nx release" %}
...
? Do you want to publish these versions? (y/N) ›
```

To move publishing into an automated pipeline, you will want to skip publishing when running `nx release` locally. To do this automatically, use the `--skip-publish` flag:

```{% command="nx release --skip-publish" %}
...

Skipped publishing packages.
```

### Use the Publish Subcommand

Nx Release provides a publishing subcommand that performs just the publishing step. Use this in your CI/CD pipeline to publish the packages.

```{% command="nx release publish" %}
NX   Running target nx-release-publish for 3 projects:

- pkg-1
- pkg-2
- pkg-3

...
```

## Publishing NPM Packages

### Example NPM Publish Output

```{% command="nx release publish" %}
NX   Running target nx-release-publish for 3 projects:

- pkg-1
- pkg-2
- pkg-3

—————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

> nx run pkg-1:nx-release-publish


📦  @myorg/pkg-1@0.0.2
=== Tarball Contents ===

233B README.md
277B package.json
53B  src/index.ts
61B  src/lib/pkg-1.ts
=== Tarball Details ===
name:          @myorg/pkg-1
version:       0.0.2
filename:      testorg-pkg-1-0.0.2.tgz
package size:  531 B
unpacked size: 624 B
shasum:        {shasum}
integrity:     {integrity}
total files:   12

Published to https://registry.npmjs.org with tag "latest"

> nx run pkg-2:nx-release-publish


📦  @myorg/pkg-2@0.0.2
=== Tarball Contents ===

233B README.md
277B package.json
53B  src/index.ts
61B  src/lib/pkg-2.ts
=== Tarball Details ===
name:          @myorg/pkg-2
version:       0.0.2
filename:      testorg-pkg-2-0.0.2.tgz
package size:  531 B
unpacked size: 624 B
shasum:        {shasum}
integrity:     {integrity}
total files:   12

Published to https://registry.npmjs.org with tag "latest"

> nx run pkg-3:nx-release-publish


📦  @myorg/pkg-3@0.0.2
=== Tarball Contents ===

233B README.md
277B package.json
53B  src/index.ts
61B  src/lib/pkg-3.ts
=== Tarball Details ===
name:          @myorg/pkg-3
version:       0.0.2
filename:      testorg-pkg-3-0.0.2.tgz
package size:  531 B
unpacked size: 624 B
shasum:        {shasum}
integrity:     {integrity}
total files:   12

Published to https://registry.npmjs.org with tag "latest"

—————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

NX   Successfully ran target nx-release-publish for 3 projects
```

### NPM Publishing in GitHub Actions

A common way to automate publishing NPM packages is via GitHub Actions. An example of a publish workflow is as follows:

```yaml
# ./.github/workflows/publish.yml
name: Publish

on:
  push:
    tags:
      - v*.*.*

jobs:
  test:
    name: Publish
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write # needed for provenance data generation
    timeout-minutes: 10
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          filter: tree:0

      - name: Install Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org/

      - name: Install dependencies
        run: npm install
        shell: bash

      - name: Print Environment Info
        run: npx nx report
        shell: bash

      - name: Publish packages
        run: npx nx release publish
        shell: bash
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_ACCESS_TOKEN }}
          NPM_CONFIG_PROVENANCE: true
```

This workflow will install node, install npm dependencies, then run `nx release publish` to publish the packages. It will run on every push to the repository that creates a tag that matches the pattern `v*.*.*`. A release process using this workflow is as follows:

1. Run `nx release --skip-publish` locally. This will create a commit with the version and changelog updates, then create a tag for the new version.
2. Push the changes (including the new tag) to the remote repository with `git push && git push --tags`.
3. The publish workflow will automatically trigger and publish the packages to the npm registry.

### Configure the NODE_AUTH_TOKEN

The `NODE_AUTH_TOKEN` environment variable is needed to authenticate with the npm registry. In the above workflow, it is passed into the Publish packages step via a [GitHub Secret](https://docs.github.com/en/actions/reference/encrypted-secrets).

#### Generate a NODE_AUTH_TOKEN for NPM

To generate the correct `NODE_AUTH_TOKEN` for the npmJS registry specifically, first login to [https://www.npmjs.com/](https://www.npmjs.com/). Select your profile icon, then navigate to "Access Tokens". Generate a new Granular Access Token. Ensure that the token has read and write access to both the packages you are publishing and their organization (if applicable). Copy the generated token and add it as a secret to your GitHub repository.

#### Add the NODE_AUTH_TOKEN to GitHub Secrets

To add the token as a secret to your GitHub repository, navigate to your repository, then select "Settings" > "Secrets and Variables" > "Actions". Add a new Repository Secret with the name `NPM_ACCESS_TOKEN` and the value of the token you generated in the previous step.

Note: The `NPM_ACCESS_TOKEN` name is not important other than that it matches the usage in the workflow:

```yaml
- name: Publish packages
  run: npx nx release publish
  shell: bash
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_ACCESS_TOKEN }}
    NPM_CONFIG_PROVENANCE: true
```

### NPM Provenance

To verify your packages with [npm provenance](https://docs.npmjs.com/generating-provenance-statements), set the `NPM_CONFIG_PROVENANCE` environment variable to `true` in the step where `nx release publish` is performed. The workflow will also need the `id-token: write` permission to generate the provenance data:

```yaml
jobs:
  test:
    name: Publish
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write # needed for provenance data generation
```

```yaml
- name: Publish packages
  run: npx nx release publish
  shell: bash
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_ACCESS_TOKEN }}
    NPM_CONFIG_PROVENANCE: true
```

## Publishing Docker Images (Experimental)

{% callout type="warning" title="Experimental Feature" %}
Docker support in Nx is currently experimental and may undergo breaking changes without following semantic versioning.
{% /callout %}

{% callout type="info" title="Nx Cloud Agents Compatibility" %}
Docker operations in `nx release` are currently supported in standard CI/CD environments like GitHub Actions, GitLab CI, and Jenkins.

For Nx Cloud Agents compatibility, please contact [Nx Enterprise support](/contact/sales) to explore available options for your team.
{% /callout %}

When using Nx Release with Docker images, the publishing process differs from npm packages.

Docker images are built with the `npx nx run-many -t docker:build` command, which is the default for [`preVersionCommand`](/recipes/nx-release/build-before-versioning#build-before-docker-versioning) in `nx.json`.

You may also run the build command manually before running `nx release`. After the images are built, they are tagged during the versioning phase, then pushed to a registry during the publish phase.

### Docker Registry Authentication

Before publishing Docker images, ensure you're authenticated with your Docker registry:

```yaml {% fileName=".github/workflows/publish.yml" %}
- name: Login to Docker Hub
  uses: docker/login-action@v2
  with:
    username: ${{ secrets.DOCKER_USERNAME }}
    password: ${{ secrets.DOCKER_TOKEN }}

- name: Build and tag Docker images
  run: npx nx release version --dockerVersionScheme=production

- name: Publish Docker images
  run: npx nx release publish
```

For changelogs, you can run `npx nx release changelog <version>` locally with the new version from the pipeline. For example, if the new version is `2501.01.be49ad6` you would run `npx nx release changelog 2501.01.be49ad6`. This will create or update the `CHANGELOG.md` files in your projects.

### Using Different Registries

Configure alternative registries in your `nx.json`:

```jsonc {% fileName="nx.json" %}
{
  "release": {
    "docker": {
      "registryUrl": "ghcr.io" // GitHub Container Registry
    }
  }
}
```

### Example GitHub Actions Workflow for Docker

```yaml {% fileName=".github/workflows/docker-publish.yml" %}
name: Docker Publish

on:
  push:
    branches: [main]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      - name: Build applications
        run: npx nx run-many -t build

      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_TOKEN }}

      - name: Build and tag Docker images
        run: npx nx release version --dockerVersionScheme=production

      - name: Publish Docker images
        run: npx nx release publish
```
