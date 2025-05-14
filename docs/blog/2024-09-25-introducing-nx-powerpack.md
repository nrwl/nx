---
title: Introducing Nx Powerpack
slug: introducing-nx-powerpack
authors: [Juri Strumpflohner]
tags: [nx, release]
cover_image: /blog/images/introducing-powerpack/thumbnail.avif
description: Introducing Nx Powerpack, a paid extension suite for enterprise use cases, ensuring Nx remains open source and existing features are free.
---

{% callout type="info" title="Update - March 31st, 2025" %}

Self-hosted caching is now free for everyone. Read more [in our blog post](/blog/custom-runners-and-self-hosted-caching) and in our documentation about [remote caching options with Nx](/remote-cache).

{% /callout %}

Today we're introducing our latest product, **Nx Powerpack**, a suite of paid extensions for Nx, specifically designed around common enterprise needs. Now, before anyone draws the wrong conclusions:

- No, we're **not going to restrict Nx's license**, lock you in, and then harvest. Nx remains MIT licensed and fully open source.
- No, we're **not placing existing features behind a paywall**. Nx Powerpack introduces new features on top of Nx (more about that below).
- Yes, we still **strongly believe in OSS and our community**, and we will keep improving Nx more than ever; if anything, Powerpack will help us fund our OSS work on Nx core and ensure its long-term sustainability.

### What about my open-source repo?

Open source projects can continue to use Nx Cloud for **free** the same way they always have, and they can continue to use Nx with all its features. If you are an open-source maintainer and you want to use Powerpack, you will get a **free license**. Just reach out to us at [powerpack-support@nrwl.io](mailto:powerpack-support@nrwl.io).

So this leaves us with:
![Nx products and their licenses](/blog/images/evolving-nx/nx-products-licenses.avif)

> But why are we releasing Nx Powerpack under a commercial license? Read all about our strategy, the reasoning behind Powerpack and OSS funding in the **blog post from our CEO, Jeff Cross**: [Evolving Nx](/blog/evolving-nx).

But now to the fun, technical part! Nx Powerpack is a bundle that - in this very first release - comes with these major features:

- [Codeowners for monorepos](#codeowners-for-monorepos)
- [Workspace conformance (beta)](#workspace-conformance-beta)

Let's dive in!

## Get an Nx Powerpack License

All Powerpack features require a dedicated commercial license. You can get one here: [Nx Powerpack](/powerpack).

Once you have your license, run the following command

```shell
npx nx register <your-activation-key>
```

## Codeowners for Monorepos

Setting up Codeowners is highly recommended when designing a monorepo. If you're not familiar, Codeowners is a common feature of VCS providers (such as GitHub, GitLab, Bitbucket, etc.), allowing you to enforce specific code reviewers to approve PRs. This functionality is especially important in a monorepo, where you manage multiple projects with multiple teams. You want to ensure the right people are reviewing the code being submitted.

Here's a simple example of a [GitHub CODEOWNERS definition](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners):

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
npx nx add @nx/owners
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

Read all about how to [configure Codeowners for your project in our docs](/nx-enterprise/powerpack/owners).

## Workspace Conformance (Beta)

We're releasing the `@nx/conformance` plugin in an early preview. This new package focuses specifically on the maintainability of your monorepo. It allows you to encode your organization's standards so they can be enforced automatically. In this first version, the workspace conformance package ships with:

- [Enforce Module Boundaries](/nx-api/conformance#enforce-module-boundaries): Similar to the Nx ESLint [Enforce Module Boundaries rule](/features/enforce-module-boundaries), but enforces boundaries on every project dependency, not just those created from TypeScript imports or `package.json` dependencies.
- [Ensure Owners](/nx-api/conformance#ensure-owners): Requires every project to have an owner defined for the `@nx/owners` plugin.

To get started, install the following package:

```shell
npx nx add @nx/conformance
```

This allows you to define conformance rules in your `nx.json`. Here is an example:

```json {% fileName="nx.json" %}
{
    ...
    "conformance": {
        "rules": [
            {
                "rule": "@nx/conformance/enforce-module-boundaries",
                "projects": ["!remix-app-e2e"],
                "options": {}
            },
            {
                "rule": "@nx/conformance/ensure-owners",
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
import { createConformanceRule } from '@nx/conformance';

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

Read all the details on how to [get started with workspace conformance rules in our docs](/nx-enterprise/powerpack/conformance).

## Learn More

- [Nx Docs](/getting-started/intro)
- [X/Twitter](https://twitter.com/nxdevtools) -- [LinkedIn](https://www.linkedin.com/company/nrwl/)
- [Nx GitHub](https://github.com/nrwl/nx)
- [Nx Official Discord Server](https://go.nx.dev/community)
- [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
