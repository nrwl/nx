# Module Federation and Nx

Module Federation is a technique that allows developers to share code and resources across multiple applications. It has become more popular in recent years since the addition of the [ModuleFederationPlugin](https://webpack.js.org/plugins/module-federation-plugin/) in [Webpack](https://webpack.js.org).

An increasing number of enterprise applications have started to adopt Module Federation to help them develop and scale their applications quickly, while reducing some overhead in sharing code between teams.

Nx added out-of-the-box support for Module Federation with Webpack to make it more approachable, less complex and leverage some unique benefits that can only be realised in a monorepo.

## What is Module Federation?

Module Federation is a method in which code can be split into smaller deployable modules that can be shared and consumed at runtime between applications.  
This method allows for the development of Micro Frontends which can reduce coordination between teams and allow for a faster development cycle with each team adhering to its own release cadence.

{% callout type="warning" title="Release Cadences" %}
Although teams can adhere to their own release cadence, some changes should still be coordinated with teams, such as package upgrades, as this can lead to an incompatibility and unexpected behaviour between the applications within the Module Federation Architecture.

For example, upgrading Angular or React to the latest version should be coordinated to prevent any issues where different versions are loaded at runtime, causing unexpected behaviour.
{% /callout %}

In order to achieve this, Module Federation introduces three terms for the applications that make up the Module Federation architecture; `host`, `remote` and `federated modules`.

### What is a Remote?

A `remote` is an application that exposes a federated module that can be fetched over the network at runtime. The federated module can be any valid JavaScript module, and therefore grows to include things such as a React Component, an Angular Routing File, a plain old JavaScript object (POJO) and more.

{% callout type="note" title="Creating a Remote" %}

Follow our [How to Create a Remote Application Recipe](/recipes/module-federation/create-a-remote) to learn more.

{% /callout %}

### What is a Host?

A `host` is an application that consumes federated modules from `remote` applications at runtime.

When you write your host application, you import the module from your remote as though it was part of the build, but at build time, Webpack is aware that this module will only exist at runtime, and only after it has made a network request to the corresponding remote application to fetch the JS bundle.

The federated module will then be executed as though it was always part of the `host` application.

{% callout type="note" title="Creating a Host" %}

Follow our [How to Create a Host Application Recipe](/recipes/module-federation/create-a-host) to learn more.

{% /callout %}

### What is a Federated Module?

A `federated module` is any valid JavaScript module that is exposed by a `remote` application with the aim that it will be consumed by a `host` application.

This means that React Components, Angular Components, Services, Application State, Functions, UI Components and more can be shared between applications and updated without the need to redeploy everything.

{% callout type="note" title="Federating a Module" %}

Follow our [How to Federate a Module Recipe](/recipes/module-federation/federate-a-module) to learn more.

{% /callout %}

### Common Pitfalls

Module Federation is not without its complexity, especially if you choose to use it to enable independent deployments where independent `remotes` are deployed on different release cadences. Some of the pitfalls you might encounter are listed below:

#### Increased Bundle Size

Module Federation allows you to share third-party packages across `remotes` and `hosts`, which can be essential in cases such as `react`, `react-dom` and `@angular/*` packages. This means that when you load a `federated module` from a `remote`, Webpack does not need to re-download a copy of these packages. Instead, the `federated module` uses the already loaded packages.

However, when third-party packages are shared between `remotes` and `hosts`, Webpack is unable to perform efficient tree-shaking on those packages as it is unaware of exactly what code will be used by any of the remotes. This can lead to an increased bundle size for some third-party packages.

A solution to help mitigate the impact of this is to only share exactly what is necessary between `remotes` and `hosts`.

#### Managing Versions

Module Federation also supports the ability to manage the versions of third-party packages that are compatible across `remotes` and `hosts`. This support ensures that each `federated module` works with a version of the package it was intended to use, but it can also add some overhead on ensuring that the package versions remain up to date.

Versioned packages and libraries can cause further issues if they store internal state or use a Singleton to manage a single instance across your application. If a `remote` is deployed with a new version of the package or library, there is the possibility that your `federated module` will download a new copy of that package if your `host` does not have the same version it is expecting.

Having multiple versions of a package would then break the package's Singleton nature as there will now be multiple instances of it running.

{% callout type="note" title="Managing Versions" %}

Follow our [Manage Library Versions Guide](/concepts/module-federation/manage-library-versions-with-module-federation) to learn more.

{% /callout %}

## Nx Support for Module Federation

Nx offers out-of-the-box support for Module Federation with React and Angular. There are a number of features that can assist you when developing a Module Federation architecture for your application, such as:

- Generators - to aid in scaffolding `remotes`, `hosts` and `federated modules`
- Executors - to aid in building your applications with Module Federation and for great DX when developing locally
- Type Safety - allowing for type-safety between `hosts` and `remotes` to catch issues early and to take advantage of autocompletion in IDEs
- Versioning of Libraries - to aid in preventing some common issues regarding incompatible package versions being used by `federated modules`
- Scaling DX - techniques to ensure a smooth DX regardless of the number of remotes in the workspace

## Use Cases

Nx has identified some common use cases that have made developers reach for Module Federation. They are Faster Builds and Independent Deployability.

### Faster Builds

As Module Federation allows you to split your application into smaller deployable chunks that are only required at runtime, you can take advantage of this to reduce the build times of your application.

You can run the builds of multiple smaller applications in parallel and deploy all of them together, maintaining a single release cadence and coordination across teams but benefiting with reduced build times locally for developers and in CI.

If you add [Nx Cloud](https://nx.app) to your Nx Workspace, then you can even get cache hits from some of the builds from other team members and CI, reducing the build time further.

{% callout type="note" title="Faster Builds with Module Federation" %}

Follow our [Faster Builds with Module Federation Guide](/concepts/module-federation/faster-builds-with-module-federation) to learn more.

{% /callout %}

### Independent Deployability

Independent Deployability is the concept where individual teams within an organization deploy their work on their own release cadence, regardless of other teams, allowing for more team autonomy. This can be achieved with Module Federation and becomes more and more appealing as the organization and application grows.

With Module Federation, each team can own a `remote` that can be deployed when needed, and it will be consumed by the `host` application as expected, allowing for updates to that `remote` to be made without the need to redeploy everything.  
This lends itself to more of a Micro Frontend approach.

{% callout type="note" title="Micro Frontend Architecture" %}

Follow our [Micro Frontend Architecture Guide](/concepts/module-federation/micro-frontend-architecture) to learn more.

{% /callout %}

You can also check out our example repository for Independent Deployability with Module Federation and Nx below:

{% github-repository url="https://github.com/jaysoo/module-federation-example/tree/main" /%}
