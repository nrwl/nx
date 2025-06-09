---
title: Module Federation with Server-Side Rendering
description: Learn how to set up Module Federation with Server-Side Rendering (SSR) for Angular and React applications using Nx generators.
---

# Setup Module Federation with SSR for Angular and React

This guide will walk you through creating a Module Federated setup with Server Side Rendering (SSR) for Angular and React using Nx and its generators.

## Steps

### Create an empty workspace

Run the following command with the options listed to create an empty workspace.

```{% command="npx create-nx-workspace@latest myorg --preset=apps" path="~" %}

NX   Let's create a new workspace [https://nx.dev/getting-started/intro]

✔ Which CI provider would you like to use? · skip
✔ Would you like remote caching to make your build faster? · skip
```

{% card title="Opting into Nx Cloud" description="You will also be prompted whether to add Nx Cloud to your workspace. We won't address this in this recipe, but you can see the introduction to Nx Cloud for more details." url="/ci/intro/ci-with-nx" /%}

### Install your framework plugin

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/angular` or `@nx/react` versions that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

{% tabs %}

{% tab label="Angular" %}

```{% command="nx add @nx/angular" path="~/myorg" %}

```

{% /tab %}

{% tab label="React" %}

```{% command="nx add @nx/react" path="~/myorg" %}

```

{% /tab %}

{% /tabs %}

### Generating a host and multiple remotes with SSR

We will generate the apps required for a storefront application.  
We will need the following applications:

- Store - _host application_
- Product - _remote application_
- Checkout - _remote application_

Nx allows you to do this with a single command:

{% tabs %}

{% tab label="Angular" %}

```{% command="npx nx g @nx/angular:host apps/store --ssr --remotes=product,checkout" path="~/myorg" %}

```

{% /tab %}

{% tab label="React" %}

```{% command="npx nx g @nx/react:host apps/store --ssr --remotes=product,checkout" path="~/myorg" %}

```

{% /tab %}

{% /tabs %}

This will generate three applications, set up with SSR and Module Federation.

### Serving the store application

When using Module Federation, we want to serve the host application along with the remote applications so that everything works as expected.

To do this, run:

{% tabs %}

{% tab label="Angular" %}

```{% command="npx nx serve-ssr store" path="~/myorg" %}

```

{% /tab %}

{% tab label="React" %}

```{% command="npx nx serve store" path="~/myorg" %}

```

{% /tab %}

{% /tabs %}

This will run all three application servers but only the `store` will be watching for file changes. If you make a change to one of the remote applications (`checkout` or `product`) the changes will not be hot reloaded.

### Serving the store application with file watching for checkout

If working on a remote application, we can still serve it via the host application and have it watch for changes.

To serve the `store` application and watch for changes on the `checkout` application run:

{% tabs %}

{% tab label="Angular" %}

```{% command="npx nx serve-ssr store --devRemotes=checkout" path="~/myorg" %}

```

{% /tab %}

{% tab label="React" %}

```{% command="npx nx serve store --devRemotes=checkout" path="~/myorg" %}

```

{% /tab %}

{% /tabs %}

### Additional Resources

To learn more about Module Federation, we have some resources you might find useful:

- [Concepts: Nx Module Federation Technical Overview](/technologies/module-federation/concepts/nx-module-federation-technical-overview)
- [Guide: Faster Builds with Module Federation](/technologies/module-federation/concepts/faster-builds-with-module-federation)
- [Video: Speed up your Angular serve and build times with Module Federation and Nx](https://www.youtube.com/watch?v=JkcaGzhRjkc)
