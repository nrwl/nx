# Setup Module Federation with SSR for Angular and React

This guide will walk you through creating a Module Federated setup with Server Side Rendering (SSR) for Angular and React using Nx and its generators.

## Steps

### Create an empty workspace

Run the following command with the options listed to create an empty workspace.

```{% command="npx create-nx-workspace@latest" path="~" %}

 >  NX   Let's create a new workspace [https://nx.dev/getting-started/intro]

✔ Where would you like to create your workspace? · myorg
✔ Which stack do you want to use? · none
✔ Package-based or integrated? · integrated
✔ Enable distributed caching to make your CI faster · Yes
```

{% card title="Opting into Nx Cloud" description="You will also be prompted whether to add Nx Cloud to your workspace. We won't address this in this recipe, but you can see the introduction to Nx Cloud for more details." url="/nx-cloud/intro/what-is-nx-cloud" /%}

### Install your framework plugin

{% tabs %}

{% tab label="Angular" %}

```{% command="npm install --save-dev @nx/angular" path="~/myorg" %}

```

{% /tab %}

{% tab label="React" %}

```{% command="npm install --save-dev @nx/react" path="~/myorg" %}

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

```{% command="npx nx g @nx/angular:host store --ssr --remotes=product,checkout" path="~/myorg" %}

```

{% /tab %}

{% tab label="React" %}

```{% command="npx nx g @nx/react:host store --ssr --remotes=product,checkout" path="~/myorg" %}

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

- [Guide: Faster Builds with Module Federation](/recipes/module-federation/faster-builds)
- [Video: Speed up your Angular serve and build times with Module Federation and Nx](https://www.youtube.com/watch?v=JkcaGzhRjkc)
