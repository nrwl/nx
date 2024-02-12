[Express](https://expressjs.com/) is a mature, minimal, and an open source web framework for making web applications and
apis.

## Create a New Workspace

To create a new workspace with a pre-created Express app, run the following command:

```shell
 npx create-nx-workspace --preset=express
```

## Setting Up @nx/express

### Installation

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/express` version that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

In any Nx workspace, you can install `@nx/express` by running the following command:

{% tabs %}
{% tab label="Nx 18+" %}

```shell {% skipRescope=true %}
nx add @nx/express
```

This will install the correct version of `@nx/express`.

{% /tab %}
{% tab label="Nx < 18" %}

Install the `@nx/express` package with your package manager.

```shell
npm add -D @nx/express
```

{% /tab %}
{% /tabs %}

## Recipes

- [Add an Express Application to Your Workspace](/showcase/example-repos/add-express)
- [Set Up Application Proxies](/recipes/node/application-proxies)
- [Wait For Tasks To Finish](/recipes/node/wait-for-tasks)
