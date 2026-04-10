---
title: Introducing Nx Powerpack
slug: introducing-nx-powerpack
authors: [Juri Strumpflohner]
tags: [nx, release]
cover_image: /blog/images/introducing-powerpack/thumbnail.png
youtubeUrl: https://youtu.be/KZ0nh2lj8zE
---

Today we're introducing our latest product, **Nx Powerpack**, a suite of paid extensions for Nx, specifically designed around common enterprise needs. Now, before anyone draws the wrong conclusions:

- No, we’re **not going to restrict Nx’s license**, lock you in, and then harvest. Nx remains MIT licensed and fully open source.
- No, we’re **not placing existing features behind a paywall**. Nx Powerpack introduces new features on top of Nx (more about that below).
- Yes, we still **strongly believe in OSS and our community**, and we will keep improving Nx more than ever; if anything, Powerpack will help us fund our OSS work on Nx core and ensure its long-term sustainability.

### What about my open-source repo ?

Open source projects can continue to use Nx Cloud for **free** the same way they always have, and they can continue to use Nx with all its features. If you are an open-source maintainer and you want to use Powerpack, you will get a **free license**. Just reach out to us at [powerpack-support@nrwl.io](mailto:powerpack-support@nrwl.io).

So this leaves us with:
![Nx products and their licenses](/blog/images/evolving-nx/nx-products-licenses.avif)

> But why are we releasing Nx Powerpack under a commercial license? Read all about our strategy, the reasoning behind Powerpack and OSS funding in the **blog post from our CEO, Jeff Cross**: [Evolving Nx](/blog/evolving-nx).

But now to the fun, technical part! Nx Powerpack is a bundle that - in this very first release - comes with three major features:

- [Codeowners for monorepos](#codeowners-for-monorepos)
- [Self-hosted cache storage](#selfhosted-cache-storage)
- [Workspace conformance (beta)](#workspace-conformance-beta)

Let’s dive in!

## Get an Nx Powerpack License

All Powerpack features require a dedicated commercial license. You can get one here: [Nx Powerpack](/powerpack).

Once you have your license, run the following command

```shell
npx nx activate-powerpack <your-license>
```

## Codeowners for Monorepos

Setting up Codeowners is highly recommended when designing a monorepo. If you’re not familiar, Codeowners is a common feature of VCS providers (such as GitHub, GitLab, Bitbucket, etc.), allowing you to enforce specific code reviewers to approve PRs. This functionality is especially important in a monorepo, where you manage multiple projects with multiple teams. You want to ensure the right people are reviewing the code being submitted.

Here’s a simple example of a [GitHub CODEOWNERS definition](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners):

```plain {% fileName=".github/CODEOWNERS" %}
/docs/ @doc-owner
/apps/orders   @orders-team
/apps/products   @products-team
/libs/orders/** @orders-team
/libs/products/** @products-team
/libs/shared/** @infra-team
```

One of the downsides of how codeowners works on today's VCS providers is that **they are folder-based**. That requires you to map your project paths to your codeowner files and keep maintaining that as you change your monorepo structure. And **this is exactly what we're going to automate**.

In a monorepo you reason based on projects. That's what you pass to your [Nx run commands](/features/run-tasks), what you see on the [project graph](/features/explore-graph) and also where owners should be defined. To get started install the Codeowners Powerpack plugin:

```shell
npx nx add @nx/powerpack-owners
```

This will allow you to define an owners section in your `nx.json` where you can define owners at the project level or even leverage project tags. Here's a small example:

```json {% fileName="nx.json" %}
{
    ...
    "owners": {
        "format": "github",
        "patterns": [
            {
                "description": "CI configuration",
                "owners": ["@devops"],
                "files": [".github/workflows/**"]
            },
            {
                "description": "Order team",
                "owners": ["@team-orders"],
                "projects": ["tag:scope:orders"]
            },
            {
                "description": "Product team",
                "owners": ["@team-products"],
                "projects": ["tag:scope:products"]
            },
            {
                "description": "Design team",
                "owners": ["@team-design"],
                "projects": ["tag:scope:design-system"]
            }
        ]
    },
  ...
}
```

A dedicated `nx sync` command automatically synchronizes these definitions to a `CODEOWNERS` file that matches your VCS provider:

```{% fileName=".github/CODEOWNERS" %}

# CI configuration
.github/workflows/** @devops

# Design team
/libs/shared/ui/angular/form-controls/ @team-design

# Design team
/libs/shared/ui/react/form-controls/ @team-design

# Product team
/libs/products/feat-product-detail/ @team-products

# Order team
/libs/orders/feat-current-orders/ @team-orders

...
```

Read all about how to [configure Codeowners for your project in our docs](/features/powerpack/owners).

## Self-hosted Cache Storage

A continuous effort on our Nx core is to improve speed. Last year, we began **rewriting performance-critical parts of Nx into Rust**, and more core components are being rewritten. As part of this effort, we also changed how we manage local cache, moving from a **file-based to a database-based approach**. In addition to small performance gains from reduced I/O, this opens up many opportunities for improving local cache handling, such as keeping only relevant cache based on usage, more easily controlling maximum cache size, and optimizing task orchestration by running failed tasks earlier.

As part of this new approach we're also going to [deprecate custom task runners](/deprecated/custom-task-runners) in Nx 20. I bring this up because it might affect users that relied on 3rd party tools that hooked into the task runners API.

To fill in on the custom task runner API we're providing a new Powerpack plugin that allows you to use S3 or a network drive as your storing mechanism for your Nx cache.

Here's an example of how to get started with [Amazon S3](https://aws.amazon.com/s3) based remote caching. First add the Powerpack plugin:

```shell
npx nx add @nx/powerpack-s3-cache
```

This will update your `nx.json` to add the new `cache` section.

```json {% fileName="nx.json" %}
{
    ...
    "s3": {
        "bucket": "your-s3-bucket-name",
        "region": "us-east-1"
    }
}
```

To then leverage the S3 powered remote cache on CI, [follow the official AWS documentation](https://github.com/aws-actions/configure-aws-credentials). Here's a short example snippet using OIDC to authenticate with AWS on GitHub Actions:

```yaml {% fileName=".github/workflows/ci.yml" %}
name: CI
...
permissions:
  id-token: write
  ...

env:
  NX_DB_CACHE: true

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
        ...

      - name: 'Configure AWS Credentials'
        uses: aws-actions/configure-aws-credentials@v4.0.2
        with:
          role-to-assume: arn:aws:iam::123456789123:role/GhAIBucketUserRole
          aws-region: us-east-1

        ...

      - run: pnpm exec nx affected -t lint test build
```

Similarly you can **set up network file based caching** using the `nx add @nx/powerpack-shared-fs-cache` package and by setting the `cacheDirectory` path in your `nx.json`.

Read all about how to [set up S3 or network drive based caching for your Nx workspace in our docs](/features/powerpack/custom-caching).

## Workspace Conformance (Beta)

We're releasing the `@nx/powerpack-conformance` plugin in an early preview. This new package focuses specifically on the maintainability of your monorepo. It allows you to encode your organization's standards so they can be enforced automatically. In this first version, the workspace conformance package ships with:

- [Enforce Module Boundaries](/nx-api/powerpack-conformance#enforce-module-boundaries): Similar to the Nx ESLint [Enforce Module Boundaries rule](https://nx-dev-git-docs-powerpack-nrwl.vercel.app/features/enforce-module-boundaries), but enforces boundaries on every project dependency, not just those created from TypeScript imports or `package.json` dependencies.
- [Ensure Owners](/nx-api/powerpack-conformance#ensure-owners): Requires every project to have an owner defined for the `@nx/powerpack-owners` plugin.

To get started, install the following package:

```shell
npx nx add @nx/powerpack-conformance
```

This allows you to define conformance rules in your `nx.json`. Here is an example:

```json {% fileName="nx.json" %}
{
    ...
    "conformance": {
        "rules": [
            {
                "rule": "@nx/powerpack-conformance/enforce-module-boundaries",
                "projects": ["!remix-app-e2e"],
                "options": {}
            },
            {
                "rule": "@nx/powerpack-conformance/ensure-owners",
                "projects": ["!remix-app-e2e"]
            },
            {
                "rule": "./tools/local-conformance-rule.ts"
            }
        ]
    }
}
```

You can also define rules locally, as shown in the example above, which are simple TypeScript files:

```ts
import { createConformanceRule } from '@nx/powerpack-conformance';

const rule = createConformanceRule({
  name: 'local-conformance-rule-example',
  category: 'security',
  reporter: 'project-reporter',
  implementation: async (context) => {
    return {
      severity: 'low',
      details: {
        violations: [],
      },
    };
  },
});

export default rule;
```

You can then run `nx conformance` to execute the conformance checks:

![Screenshot of the conformance check output](/blog/images/introducing-powerpack/conformance-check.avif)

In this first preview release, you'll only be able to run workspace conformance rules on a single workspace. In future iterations, you **will be able to connect it to your existing Nx Cloud organization**, allowing you to upload conformance rules and run them across connected workspaces.

Read all the details on how to [get started with workspace conformance rules in our docs](/features/powerpack/conformance).

## Learn More

- [Nx Docs](/getting-started/intro)
- [X/Twitter](https://twitter.com/nxdevtools) -- [LinkedIn](https://www.linkedin.com/company/nrwl/)
- [Nx GitHub](https://github.com/nrwl/nx)
- [Nx Official Discord Server](https://go.nx.dev/community)
- [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
