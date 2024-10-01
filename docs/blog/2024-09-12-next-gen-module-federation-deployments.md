---
title: Next-Gen Module Federation Deployments with Nx and Zephyr Cloud
slug: next-gen-module-federation-deployment
authors: ['Colum Ferry']
tags: [nx, module federation, rspack, zephyr cloud]
cover_image: /blog/images/2024-09-12/next-gen-module-federation-deployments.png
published: true
---

Nx has supported Module Federation for a long time now and its popularity is seeing year-on-year increase. It has proven
to be the defacto solution for modern Micro Frontends and Nx has embraced this and helped developers scaffold projects
that use Module Federation; offering the most scalable and the most developer friendly experience to do so.
However, we have always taken a step back when it came to the final piece of the puzzle: **Deployment**.

Micro Frontends are, by their very nature, more complex to deploy. You are no longer deploying one build artifact but
rather, many build artifacts that could even be on different release cadences from each other. And yet, we still expect
the final application that our users interact with to be stable.

There are so many approaches to deployments - think Kubernetes, Storage Buckets with DNS, EC2 instances etc - that it
has always been difficult for us to recommend a solution. That was until [Zephyr Cloud](https://www.zephyr-cloud.io/)
entered the game.

Zephyr Cloud is a "bring your own cloud" deployment platform with best-in-class support for module federation projects
that integrates right into your application build, providing seamless deployments without having to learn any new
commands.
With features such as:

- Auto-deployment on build
- Live Preview link generation
- Version rollback and roll-forward
- Micro Frontend dependency management
- A Chrome Extension to manage environments
- Support for a wide range of Cloud Platforms (such as [Cloudflare](https://www.cloudflare.com/en-gb/)
  and [Netlify](https://www.netlify.com/))
- A beautiful UI to visualize your deployments

And so much more, Zephyr Cloud really is one of the best deployment solutions available.

{% callout type="note" title="Zephyr Cloud Features" %}
You can learn more about the full feature set that Zephyr Cloud
offers [here](https://docs.zephyr-cloud.io/#main-features).
{% /callout %}

I myself, Colum Ferry, after having been allowed to experiment with it in its infancy back in February 2024 said

> Zephyr Cloud is the Micro Frontend orchestration tool you never knew you needed.
> What they have built will change the deployments for the better.
> Think of the disruption k8s caused. Zephyr Cloud will do the same for the Micro Frontend world.
>
> _Reference: [Linkedin](https://www.linkedin.com/posts/colum-ferry-3a36a9169_zephyr-cloud-is-the-micro-frontend-orchestration-activity-7183207192991289344-6mSR)_

And I stand by that statement.

Therefore, in this article I'll show you how to set up React Module Federation with Nx and Rspack and how to integrate
it with Zephyr Cloud for deployment.

## Step 1: Set Up the Nx Workspace

We'll start by creating an empty Nx workspace:

```{% command="npx create-nx-workspace myorg" path="~" %}
NX   Let's create a new workspace [https://nx.dev/getting-started/intro]

✔ Which stack do you want to use? · none
✔ Package-based monorepo, integrated monorepo, or standalone project? · integrated
✔ Which CI provider would you like to use? · github

 NX   Creating your v19.7.0 workspace.

✔ Installing dependencies with npm
✔ Successfully created the workspace: myorg.
✔ Nx Cloud has been set up successfully
✔ CI workflow has been generated successfully

```

Next, we'll want to navigate into our new workspace:

```shell
cd myorg
```

And finally, we'll add the [`@nx/react`](/nx-api/react) plugin to our workspace.

```shell
npx nx add @nx/react
```

## Step 2: Scaffold the Module Federation Projects

Now that we have the `@nx/react` package installed, we have access to all the generators it offers. We'll use the `host`
generator now to scaffold out Module Federation projects.

{% callout type="note" title="Generating host applications" %}
If you'd like a more indepth recipe for scaffolding `host` and `remote` generators you can take a look through
our [Module Federation Recipes](/recipes/module-federation).
{% /callout %}

```{% command="npx nx g @nx/react:host apps/shell --remotes=remote1 --bundler=rspack" path="~/myorg" %}
 NX  Generating @nx/react:host

✔ Which stylesheet format would you like to use? · css
✔ Which E2E test runner would you like to use? · playwright
Fetching prettier...
Fetching @nx/rspack...
Fetching @nx/playwright...
Fetching @nx/jest...

// REMOVED FOR BREVITY

 NX   👀 View Details of shell

Run "nx show project shell" to view details about this project.

 NX   👀 View Details of remote1
Run "nx show project remote1" to view details about this project.
```

With that, two applications will be added to our workspace `shell` and `remote` as well as their counterpart e2e
projects.

{% callout type="note" title="Running tasks" %}
These projects contain all the usual tasks you would expect to see with a Nx project such as `build`, `serve`, `test`,
`lint`.
You can learn more about Running Tasks in Nx [here](/features/run-tasks).
{% /callout %}

We specified `--bundler=rspack` indicating that the applications should be built with [Rspack](https://rspack.dev/).  
_This support has been newly added to Nx since Nx 19.7.0._

You'll note the `shell/rspack.config.ts` file. It's contents should match the following:

```ts {% fileName="shell/rspack.config.ts" %}
import { composePlugins, withNx, withReact } from '@nx/rspack';
import {
  withModuleFederation,
  ModuleFederationConfig,
} from '@nx/rspack/module-federation';

import baseConfig from './module-federation.config';

const config: ModuleFederationConfig = {
  ...baseConfig,
};

// Nx plugins for rspack to build config object from Nx options and context.
/**
 * DTS Plugin is disabled in Nx Workspaces as Nx already provides Typing support for Module Federation
 * The DTS Plugin can be enabled by setting dts: true
 * Learn more about the DTS Plugin here: https://module-federation.io/configure/dts.html
 */
export default composePlugins(
  withNx(),
  withReact(),
  withModuleFederation(config, { dts: false })
);
```

If you have experience with our `webpack` Module Federation support, you'll note that this file is very similar to the
`webpack.config.ts` files we would have generated. The only real difference is that the imports point to `@nx/rspack`.

{% callout type="note" title="Module Federation 2.0" %}
Module Federation is still under active development, however, all new development is being included in Rspack as well as
the `@module-federation/enhanced` package.

Module Federation 2.0 brings new features such
as [Federation Runtime](https://module-federation.io/guide/basic/runtime.html)
and [Runtime Plugins](https://module-federation.io/plugin/dev/index.html).
These are significant advancements which offer a vast range of capabilities to Module Federation projects.

Nx itself has employed this strategy to solve a long-standing issue with shared workspace libraries wherein there was
the possibility that a shared library would be served from a static remote. This in turn would prevent HMR updates to
the library from being reflected in the locally served application.
You can learn more about the
`NxRuntimeLibraryControlPlugin` [here](/concepts/module-federation/nx-module-federation-technical-overview).
{% /callout %}

## Step 4: Building and Serving

To build all the applications in the workspace, run the following:

```{% command="npx nx run-many -t build" path="~/myorg" %}

   ✔  nx run remote1:build:production (2s)
   ✔  nx run shell:build:production (526ms)

———————————————————————————————————————————————————————————————————————————————————————

 NX   Successfully ran target build for 2 projects (3s)
```

This will build the applications with Rspack. You can observe the build artifacts in the `dist/` folder.

To serve the Module Federation setup, we recommend only serving the `host` application.

{% callout type="note" title="Serving all Module Federation Projects" %}

Nx purpose-built a `serve` executor for Module Federation Projects. This executor will find all the `remote`
applications that the `host` depends on and serves them, either statically or with HMR/Live Reloading.

Serving statically means that we can reuse the build artifacts for the `remotes` for a faster dev-server startup time
that is scalable. Combined with Nx caching, this works well to ensure a great developer experience.

You can learn more about how this works in
our [Nx Module Federation Technical Overview](/concepts/module-federation/nx-module-federation-technical-overview#what-happens-when-you-serve-your-host)
document.

{% /callout %}

Run the following command to serve the `host` application with the `remote` served statically:

```{% command="npx nx serve shell" path="~/myorg" %}
> nx run shell:serve


 NX  Starting module federation dev-server for shell with 1 remotes


 NX  Building 1 static remotes...


 NX  Built 1 static remotes


 NX  Starting static remotes proxies...


 NX  Static remotes proxies started successfully

[ Module Federation Manifest Plugin ]: Manifest will use absolute path resolution via its host at runtime, reason: publicPath='auto'
<i> [webpack-dev-server] Project is running at:
<i> [webpack-dev-server] Loopback: http://localhost:4200/, http://[::1]:4200/
<i> [webpack-dev-server] 404s will fallback to '/index.html'
●  ━━━━━━━━━━━━━━━━━━━━━━━━━ (70%) sealing after module optimization                    [ Module Federation Manifest Plugin ] Manifest Link: {auto}/mf-manifest.json
●  ━━━━━━━━━━━━━━━━━━━━━━━━━ (98%) emitting emit                                        Starting up http-server, serving dist

http-server version: 14.1.1

http-server settings:
CORS: true
Cache: -1 seconds
Connection Timeout: 120 seconds
Directory Listings: visible
AutoIndex: visible
Serve GZIP Files: false
Serve Brotli Files: false
Default File Extension: none

Available on:
  http://localhost:4202
Hit CTRL-C to stop the server


 NX  Server ready at http://localhost:4200
```

If you navigate to `http://localhost:4200` your application will render and you'll be able to navigate between the
`host` and the `remote`.

## Step 4: Deployment

Granted what we have currently is not something you'd likely see in a production application, we'll use it as is to
demonstrate deployment with Zephyr Cloud.

{% callout type="note" title="Zephyr Cloud Nx Recipe" %}

Zephyr Cloud also has a recipe that you can follow to set up Nx React Module Federation with Zephyr
Cloud [here](https://docs.zephyr-cloud.io/recipes/react-rspack-nx).

{% /callout %}

I'll break this section into sub-steps to make it easier to follow.

### Step 1: Add `package.json` and First Commit

First, we need to add `package.json` files to our `shell` and `remote1` projects. This is used by Zephyr Cloud to
determine the name and version of the projects for deployment.

Create the following files:

{% tabs %}
{% tab label="shell/package.json" %}

```json {% fileName="shell/package.json" %}
{
  "name": "shell",
  "version": "0.0.0"
}
```

{% /tab %}
{% tab label="remote1/package.json" %}

```json {% fileName="remote1/package.json" %}
{
  "name": "remote1",
  "version": "0.0.0"
}
```

{% /tab %}
{% /tabs %}

Once this is done, add all staged files and create a git commit.

```shell
git add .
git commit -m "initial commit"
```

### Step 2: Create a GitHub Repository

Next, we need to add a GitHub repository. It can be public or private, it will not affect the deployments by Zephyr
Cloud.

{% callout type="note" title="Why is this needed?" %}
Behind the scene, Zephyr Cloud will map your git configuration (remote origin url, organization or username, repository
name and branch) to deploy your application. Without this step the deployment will fail.
{% /callout %}

If you don't already have the [GitHub CLI](https://cli.github.com/) installed, I would highly recommend it.

You can then run the following to create your GitHub Repository from your terminal:

```{% command="gh repo create" path="~/myorg" %}
? What would you like to do? Push an existing local repository to GitHub
? Path to local repository .
? Repository name nx-zephyr-cloud-example
? Repository owner Coly010
? Description Example of Nx React Rspack Module Federation with Zephyr Cloud
? Visibility Private
✓ Created repository Coly010/nx-zephyr-cloud-example on GitHub
  https://github.com/Coly010/nx-zephyr-cloud-example
? Add a remote? Yes
? What should the new remote be called? origin
✓ Added remote https://github.com/Coly010/nx-zephyr-cloud-example.git
? Would you like to push commits from the current branch to "origin"? Yes
```

### Step 3: Add Zephyr Cloud

To add Zephyr Cloud itself, we need to install their `zephyr-webpack-plugin`.

{% callout type="note" title="Rspack and Webpack Interop" %}
The plugin is indeed written for Webpack, however, one of the big advantages of Rspack is the interoperability it offers
for the Webpack Ecosystem.
You can learn more about this compatability [here](https://rspack.dev/guide/compatibility/plugin).
{% /callout %}

Run the following to install the plugin:

```shell
npm install zephyr-webpack-plugin
```

Now that the plugin has been installed in our workspace, we need to update the `rspack.config.ts` files to use it.
This is a very simple two line change:

```ts
import { withZephyr } from 'zephyr-webpack-plugin';

export default composePlugins(
  ...,
  withZephyr()
)
```

You'll need to make these updates to the following files:

- `shell/rspack.config.ts`
- `shell/rspack.config.prod.ts`
- `remote1/rspack.config.ts`

For example, your `shell/rspack.config.ts` file should now match the following:

```ts {% fileName="shell/rspack.config.ts" %}
import { composePlugins, withNx, withReact } from '@nx/rspack';
import {
  withModuleFederation,
  ModuleFederationConfig,
} from '@nx/rspack/module-federation';
import { withZephyr } from 'zephyr-webpack-plugin';

import baseConfig from './module-federation.config';

const config: ModuleFederationConfig = {
  ...baseConfig,
};

// Nx plugins for rspack to build config object from Nx options and context.
/**
 * DTS Plugin is disabled in Nx Workspaces as Nx already provides Typing support for Module Federation
 * The DTS Plugin can be enabled by setting dts: true
 * Learn more about the DTS Plugin here: https://module-federation.io/configure/dts.html
 */
export default composePlugins(
  withNx(),
  withReact(),
  withModuleFederation(config, { dts: false }),
  withZephyr()
);
```

### Step 4: First Deployment

With all the `rspack.config.ts` files updated, getting your first deployment is as simple as running:

```{% command="npx nx run-many -t build --verbose" path="~/myorg" %}
> nx run remote1:build:production
...

 ZEPHYR   Opening browser for authentication...
 ZEPHYR   Hi colum_nrwl_io!
 ZEPHYR   remote1.nx-zephyr-cloud-example.coly010#6
 ZEPHYR
 ZEPHYR   Uploaded local snapshot in 152ms
 ZEPHYR   (12/12 assets uploaded in 235ms, 332.55kb)
 ZEPHYR   Deployed to Zephyr's edge in 352ms.
 ZEPHYR
 ZEPHYR   https://colum_nrwl_io_6-remote1-nx-zephyr-cloud-example-c-e7ab3d770-ze.zephyrcloud.app

...
Rspack 1.0.4 compiled with 1 warning in 3.91 s

> nx run shell:build:production
...

 ZEPHYR   Hi colum_nrwl_io!
 ZEPHYR   shell.nx-zephyr-cloud-example.coly010#7
 ZEPHYR
 ZEPHYR   Uploaded local snapshot in 165ms
 ZEPHYR   (10/10 assets uploaded in 202ms, 326.42kb)
 ZEPHYR   Deployed to Zephyr's edge in 248ms.
 ZEPHYR
 ZEPHYR   https://colum_nrwl_io_7-shell-nx-zephyr-cloud-example-col-04ccb4027-ze.zephyrcloud.app

...
Rspack 1.0.4 compiled with 1 warning in 1.29 s
```

At this point, a page will likely be opened in your browser where you can create your Zephyr Cloud account and
authenticate the CLI to allow it to deploy the applications to your account.

You'll note that the output from this is not the same as the output we received earlier when we ran
`npx nx run-many -t build`.
In particular, the most recent set of logs contains the URLs of the deployed application (_Note: your URL should be
different_):

```{% command="npx nx run-many -t build --verbose" path="~/myorg" %}
> nx run remote1:build:production
...
 ZEPHYR   https://colum_nrwl_io_6-remote1-nx-zephyr-cloud-example-c-e7ab3d770-ze.zephyrcloud.app


> nx run shell:build:production
...
 ZEPHYR   https://colum_nrwl_io_7-shell-nx-zephyr-cloud-example-col-04ccb4027-ze.zephyrcloud.app
```

Zephyr Cloud deployed our applications _during_ the build process!

With Zephyr Cloud, it really is _that_ easy to deploy your Module Federation Projects.

You can then visit the [Zephyr Cloud Dashboard](https://app.zephyr-cloud.io/) where you can get a more visual insight
into your deployed projects.

## Conclusion

Deploying Micro Frontend applications has always been a complex task, especially when it comes to managing multiple
build artifacts and maintaining stability. However, with Nx's continued support for Module Federation and the
integration of Zephyr Cloud, developers now have access to a streamlined, scalable solution that simplifies the
deployment process significantly.  
Zephyr Cloud's unique features, such as auto-deployment, live preview links, and seamless rollback capabilities, make it
an invaluable tool for Micro Frontend orchestration. By following the steps outlined in this guide, you can effortlessly
set up your Nx workspace, scaffold Module Federation projects, and leverage Zephyr Cloud for quick, hassle-free
deployments.

For more information about Zephyr Cloud I highly recommend checking out their [docs](https://docs.zephyr-cloud.io/).

## Learn More

- [Nx on CI](/ci)
- [Task Distribution with Nx Agents](/ci/features/distribute-task-execution)
- [Automated e2e Test Splitting](/ci/features/split-e2e-tasks)
- [X/Twitter](https://twitter.com/nxdevtools) -- [LinkedIn](https://www.linkedin.com/company/nrwl/)
- [Nx Official Discord Server](https://go.nx.dev/community)
- [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
