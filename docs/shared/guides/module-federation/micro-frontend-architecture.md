# Micro Frontend Architecture

Since version 14, Nx provides out-of-the-box [Module Federation](/module-federation/faster-builds) support to both React
and Angular. The Micro Frontend (MFE) architecture builds on top of Module Federation by providing _independent deployability_.

If you have not read the [Module Federation guide](/module-federation/faster-builds) yet, we recommend that you read it
before continuing with this MFE guide.

## When should I use micro frontend architecture?

We recommend MFE for teams that require applications to be deployed independently. It is important to consider the cost
of MFEs and decide whether it makes sense for your own teams.

- Version mismatches where applications are deployed with different versions of shared libraries, which can lead to
  incompatibility issues.
- Independent deployments can lead to unexpected errors, such as any host-level changes to orchestration/coordination
  logic that breaks compatibility with remotes.

If you are looking at optimizing builds and do not need independent deployments, we recommend reading our guide on
[Faster Builds with Module Federation](/module-federation/faster-builds).

If you need to use MFEs, keep reading, and we'll examine the architecture and strategies to deal with shared libraries and
deployments.

## Architectural overview

With MFE architecture, a large application is split into:

1. A single **Host** application that references external...
2. **Remote** applications, which handle a single domain or feature.

In a normal Module Federation setup, we [recommend setting up implicit dependencies](/module-federation/faster-builds#architectural-overview)
from the host application to remote applications. However, in an MFE architecture you _do not_ want these dependencies
to exist between host and remotes.

For example, if you have a `shell` host application, with three remotes -- `about`, `cart`, `shop` -- and a shared
`ui-button` library, then your project graph might look something like this.

![MFE setup with independent projects](/shared/guides/module-federation/mfe-dep-graph.png)

Keeping the applications independent allows them to be deployed on different cadences, which is the whole point of MFEs.

## Generating applications

The generator for MFEs is the same as with basic Module Federation. You can use `nx g host` to create a new host
application, and `nx g remote` for remote applications.

```bash
# React
nx g @nrwl/react:host shell --remotes=shop,cart
nx g @nrwl/react:remote about --host=shell

#a Angular
nx g @nrwl/angular:host shell --remotes=shop,cart
nx g @nrwl/angular:remote about --host=shell
```

That is! You can now run `nx serve shell` to develop on the `shell` application, while keeping all remotes static. To
develop on one or more remote applications, pass the `--devRemotes` option.

e.g. `nx serve shell --devRemotes=cart,shop`.

## Deployment strategies

How applications are deployed depends on the teams and organizational requirements. There are two approaches:

1. À la carte deployments - Each application is deployed according to a release schedule, and can have different cadences.
2. Affected deployments - When changes are merged, use Nx to test and deploy the affected applications automatically.

Often times, teams mix both approach so deployments to staging (or other shared environments) are automatic. Then,
promotion from staging to production occurs on a set cadence (e.g. weekly releases). It is also recommended to agree on
a process to handle changes to core libraries (i.e. ones that are shared between applications). Since the core changes
affect all applications, it also blocks all other releases, thus should not occur too frequently.

You may also choose to fully automate deployments, even to production. This type of pipeline requires good end-to-end
testing to provide higher confidence that the applications behave correctly. You will also need good rollback mechanisms
in case of a bad deployment.

## Shared libraries

Since deployments with MFEs are not atomic, there is a chance that shared libraries -- both external (npm) and workspace --
between the host and remotes are mismatched. The default the Nx setup configures all libraries as singletons, which requires
that all affected applications be deployed for any given changeset, and makes à la carte deployments riskier.

There are mitigation strategies that can minimize mismatch errors. One such strategy is to share as little as possible
between applications.

For example, you can create a base configuration file that only shares core libraries that _have_ to be shared.

```javascript
// module-federation.config.js

// Core libraries such as react, angular, redux, ngrx, etc. must be
// singletons. Otherwise the applications will not work together.
const coreLibraries = new Set([
  'react',
  'react-dom',
  'react-router-dom',
  // A workspace library for a publish/subscribe
  // system of communication.
  '@acme/pub-sub',
]);

module.exports = {
  // Share core libraries, and avoid everything else
  shared: (libraryName, defaultConfig) => {
    if (coreLibraries.has(libraryName)) {
      return defaultConfig;
    }

    // Returning false means the library is not shared.
    return false;
  },
};
```

Then, in the `shell` and remote applications, you can extend from the base configuration.

```javascript
// apps/shell/module-federation.config.js
const baseConfig = require('../../module-federation.config');

module.exports = {
  ...baseConfig,
  name: 'shell',
  remotes: ['shop', 'cart', 'about'],
};
```

**Note:** You can return any configuration [object that webpack's Module Federation supports](https://webpack.js.org/plugins/module-federation-plugin/#sharing-hints).

There are downsides to not sharing a library (such as increasing network traffic due to duplication), so consider what
you share carefully. If you are not sure, then start with a small set of core libraries, and expand it as needed.

## Strategic collaboration over micro frontend anarchy

[Micro frontend anarchy](https://www.thoughtworks.com/en-ca/radar/techniques/micro-frontend-anarchy) refers to an MFE
setup that mixes a range of competing technologies together. For example, using Angular in some applications, and React
in another. Although it is possible to do this mixing with MFEs, we recommend choosing strategic collaboration instead.

Teams should agree upon a set of adopted technologies, such as UI/backend framework, styling solutions (CSS vs CSS-in-JS),
etc. Standardizing technologies enable developers to collaborate across teams more easily, since there is consistency
in each vertical. The only time mixing competing technologies make sense is as a part of a deliberate transition strategy,
such as migrating from React to Vue, for example.

## Summary

While Module Federation enables faster builds by vertically slicing your application into smaller ones, the
MFE architecture layers _independent deployments_ on top of federation. Teams should only choose MFEs
if they want to deploy their host and remotes on different cadences.

Teams should consider a process for changes to core libraries that require deploying all applications. These types of
changes should occur infrequently as to not disrupt other releases for bug fixes or new features.

Since deployments are not atomic, there can be cases of mismatched libraries between the host and remotes. We recommend
that teams deploy their applications whenever changes to a shared library affects them. You can further mitigate mismatch
issues by minimizing the amount of libraries you share (using the `shared` configuration option in
`module-federation.config.js`).

Teams should also avoid MFE anarchy, where competing technologies are mixed together. Instead, teams should agree upon
the adopted technologies, which allows easier collaboration across teams.
