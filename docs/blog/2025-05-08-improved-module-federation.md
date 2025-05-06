---
title: 'New and Improved Module Federation Experience with Nx'
slug: improved-module-federation
authors: ['Colum Ferry']
tags: ['nx', 'module-federation']
cover_image: /blog/images/2025-05-08/module-federation.avif
description: 'Nx 21 introduces native support for Module Federation with Inferred Tasks and Continuous Tasks, enabling streamlined Rspack configs and seamless multi-app serving for improved developer experience.'
---

Nx 21 saw the introduction of many new and exciting features. [Continuous Tasks](/reference/project-configuration#continuous) was one such feature that I found particularly exciting because of what it could mean for the Developer Experience (DX) with Module Federation.

However, before even being able to contemplate that, a different feature needed to be completed. The ability to use Module Federation with Nx’s [Inferred Tasks](/concepts/inferred-tasks).

## Inferred Tasks with Module Federation

We have introduced three new [Rspack](https://rspack.dev) Plugins for Module Federation that can be used with Nx.

- [NxModuleFederationPlugin](/nx-api/module-federation/documents/nx-module-federation-plugin)
  - Gathers information from the Nx Workspace to correctly configure `rspack.ModuleFederationPlugin`
- [NxModuleFederationDevServerPlugin](/nx-api/module-federation/documents/nx-module-federation-dev-server-plugin)
  - Used to handle the static-serving of non-dev remotes for CSR applications
- [NxModuleFederationSSRDevServerPlugin](/nx-api/module-federation/documents/nx-module-federation-dev-server-plugin#server-side-rendering)
  - Used to handle the static-serving of non-dev remotes for SSR applications

These are true Rspack Plugins that should be added to the `plugins: []` of an `rspack.config` file.

Their intention is to replace `withModuleFederation` helpers and `module-federation-dev-server` executors we used to provide the Nx Module Federation Experience previously.

With these plugins, we can now set up a very standard `rspack.config` file that can be used with the `@nx/rspack/plugin` Inference Plugin - or you could even just run `rspack build` or `rspack serve`

Not only does this mean that the config files that we create for your Module Federation projects are now compliant with the underlying tooling, but it enabled us to take full advantage of Continuous Tasks

## Continuous Tasks with Module Federation

This is where things get interesting. Continuous Tasks in Nx allows for tasks to depend on tasks that may not end. The Nx Module Federation Experience has always relied on the serving of multiple applications.

Previously, you would run `nx serve shell --devRemotes=remote1` where `shell` is your host application and `remote1` is the remote application that you or a feature team would be currently working on to allow for HMR with `remote1`.

Under the hood this would start up the `webpack-dev-server` for both `shell` and `remote1` .

However, it always felt _slightly_ strange for individual contributors on feature teams to be told they cannot not run “their” application by simply running `nx serve remote1` .

Well, now they can!

With Continuous Tasks and the new `NxModuleFederationDevServer` plugins, we can generate remote applications that `dependsOn["shell:serve"]` .

Running `nx serve remote1` will serve **both** `remote1` and `shell` !

The `NxModuleFederationDevServer` plugin for the `shell` application will check which remotes are already running and simply ignore them - serving only the remotes that are not already served.

## Getting Started with the New Nx Module Federation Experience

### 1. Create a new Nx Workspace

```{% command=”npx create-nx-workspace@latest myorg” path=”~/” %}

NX   Let's create a new workspace [[https://nx.dev/getting-started/intro](/getting-started/intro)]

✔ Which stack do you want to use? · none
✔ Would you like to use Prettier for code formatting? · Yes
✔ Which CI provider would you like to use? · skip
✔ Would you like remote caching to make your build faster? · skip

NX   Creating your v21.0.0 workspace.

✔ Installing dependencies with npm
✔ Successfully created the workspace: myorg.

NX   Welcome to the Nx community! 👋

🌟 Star Nx on GitHub: [https://github.com/nrwl/nx](https://github.com/nrwl/nx)
📢 Stay up to date on X: [https://x.com/nxdevtools](https://x.com/nxdevtools)
💬 Discuss Nx on Discord: [https://go.nx.dev/community](https://go.nx.dev/community)

```

### 2. Add the `@nx/react` Plugin

```{% command=”npx nx add @nx/react” path=”~/myorg” %}

✔ Installing @nx/react@21.0.0

NX  Generating @nx/react:init

UPDATE package.json
UPDATE nx.json

added 3 packages in 1s

91 packages are looking for funding
run `npm fund` for details
✔ Initializing @nx/react...

NX   Package @nx/react added successfully.

```

### 3. Generate Host and Remote Applications

```{% command=”npx nx g @nx/react:host apps/shell --remotes=remote1,remote2 --bundler=rspack” path=”~/myorg” %}

NX  Generating @nx/react:host

✔ Which stylesheet format would you like to use? · css
✔ Which E2E test runner would you like to use? · none
Fetching @nx/rspack...
Fetching @nx/jest...

UPDATE nx.json
UPDATE package.json
CREATE apps/shell/src/app/app.spec.tsx
CREATE apps/shell/src/assets/.gitkeep
CREATE …

```

### 4. Serve the Remote Application for Development

`npx nx serve remote1`

![Module Federation with Continuous Tasks Output](/blog/images/2025-05-08/module-federation-continuous-tasks.avif)

With the new [Terminal UI](/recipes/running-tasks/terminal-ui) you can very easily see the logs for each application in specific frames also.

## Further Reading

- [Module Federation and Nx](/concepts/module-federation/module-federation-and-nx)
- [Nx Module Federation Technical Overview](/concepts/module-federation/nx-module-federation-technical-overview)
- 🧠 [**Nx Docs**](/getting-started/intro)
- 👩‍💻 [**Nx GitHub**](https://github.com/nrwl/nx)
- 💬 [**Nx Official Discord Server**](https://go.nx.dev/community)
- 📹 [**Nx Youtube Channel**](https://www.youtube.com/@nxdevtools)
