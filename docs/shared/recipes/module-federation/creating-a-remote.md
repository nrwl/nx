---
title: Creating a Module Federation Remote
description: Learn how to generate and configure a remote application for Module Federation in React and Angular using Nx generators.
---

# Creating a Remote

In the concept of Module Federation a `remote` is the term given to an application that exposes modules that can be
shared to and consumed by host applications.  
This is the key difference between a `remote` and `host`.

- A `remote` exposes modules that can be consumed
- A `host` consumes exposed modules

**Nx** includes first-class support for helping you to scaffold a Module Federation Architecture for your React and
Angular application(s).

## Generating a Remote

To generate a remote application in your workspace, cd into the right folder and run the following command:

{% tabs %}
{% tab label="React" %}

```{% command="nx g @nx/react:remote --name=myremote" %}
NX  Generating @nx/react:remote

CREATE apps/react/myremote/src/app/app.spec.tsx
CREATE apps/react/myremote/src/assets/.gitkeep
CREATE apps/react/myremote/src/environments/environment.prod.ts
CREATE apps/react/myremote/src/environments/environment.ts
CREATE apps/react/myremote/src/favicon.ico
CREATE apps/react/myremote/src/index.html
CREATE apps/react/myremote/tsconfig.app.json
CREATE apps/react/myremote/rspack.config.ts
CREATE apps/react/myremote/.babelrc
CREATE apps/react/myremote/src/app/nx-welcome.tsx
CREATE apps/react/myremote/src/app/app.module.css
CREATE apps/react/myremote/src/app/app.tsx
CREATE apps/react/myremote/src/styles.css
CREATE apps/react/myremote/tsconfig.json
CREATE apps/react/myremote/project.json
CREATE apps/react/myremote/.eslintrc.json
CREATE apps/react/myremote/jest.config.ts
CREATE apps/react/myremote/tsconfig.spec.json
CREATE apps/react/myremote/src/bootstrap.tsx
CREATE apps/react/myremote/module-federation.config.ts
CREATE apps/react/myremote/src/main.ts
CREATE apps/react/myremote/src/remote-entry.ts
UPDATE tsconfig.base.json
```

{% /tab %}
{% tab label="Angular" %}

```{% command="nx g @nx/angular:remote apps/angular/myremote" %}
NX Generating @nx/angular:host

CREATE apps/angular/myremote/project.json
CREATE apps/angular/myremote/src/assets/.gitkeep
CREATE apps/angular/myremote/src/favicon.ico
CREATE apps/angular/myremote/src/index.html
CREATE apps/angular/myremote/src/styles.css
CREATE apps/angular/myremote/tsconfig.app.json
CREATE apps/angular/myremote/tsconfig.json
CREATE apps/angular/myremote/src/app/app.ts
CREATE apps/angular/myremote/src/app/app.routes.ts
CREATE apps/angular/myremote/src/main.ts
CREATE apps/angular/myremote/.eslintrc.json
CREATE apps/angular/myremote/jest.config.ts
CREATE apps/angular/myremote/src/test-setup.ts
CREATE apps/angular/myremote/tsconfig.spec.json
CREATE apps/angular/myremote/src/app/remote-entry/entry.ts
CREATE apps/angular/myremote/src/app/remote-entry/entry.routes.ts
CREATE apps/angular/myremote/src/app/remote-entry/nx-welcome.ts
CREATE apps/angular/myremote/module-federation.config.ts
CREATE apps/angular/myremote/webpack.config.ts
CREATE apps/angular/myremote/webpack.prod.config.ts
CREATE apps/angular/myremote/src/bootstrap.ts
UPDATE tsconfig.base.json
```

{% /tab %}
{% /tabs %}

After the `remote` application is generated, you can then update your host application's Module Federation Config File
to specify that it can consume federated modules from this remote.

{% tabs %}
{% tab label="TypeScript Config File" %}

```typescript {% fileName="apps/react/shell/module-federation.config.ts" %}
import { ModuleFederationConfig } from '@nx/module-federation';

const config: ModuleFederationConfig = {
  name: 'shell',
  remotes: ['myremote'], // <-- add the name of your remote to the remotes array
};
export default config;
```

{% /tab %}

{% tab label="JavaScript Config File" %}

```typescript {% fileName="apps/react/shell/module-federation.config.js" %}
module.exports = {
  name: 'shell',
  remotes: ['myremote'], // <-- add the name of your remote to the remotes array
};
```

{% /tab %}
{% /tabs %}

{% callout type="note" title="Creating a Host" %}
If you do not already have a host application in your workspace, look at
the [Create a Host Recipe](/technologies/module-federation/recipes/create-a-host) for more information on how to achieve
this.
{% /callout %}

### Let Nx add your Remote to your Host

The `remote` generators also allow you to specify a `--host` option, which will allow the generator to add your remote
to your host automatically. This can save you time by skipping the manual step above.  
The command would look like the following:

{% tabs %}
{% tab label="React" %}

```{% command="nx g @nx/react:remote apps/react/myremote --host=shell" %}
NX  Generating @nx/react:remote

CREATE apps/react/myremote/src/app/app.spec.tsx
CREATE apps/react/myremote/src/assets/.gitkeep
CREATE apps/react/myremote/src/environments/environment.prod.ts
CREATE apps/react/myremote/src/environments/environment.ts
CREATE apps/react/myremote/src/favicon.ico
CREATE apps/react/myremote/src/index.html
CREATE apps/react/myremote/tsconfig.app.json
CREATE apps/react/myremote/rspack.config.ts
CREATE apps/react/myremote/.babelrc
CREATE apps/react/myremote/src/app/nx-welcome.tsx
CREATE apps/react/myremote/src/app/app.module.css
CREATE apps/react/myremote/src/app/app.tsx
CREATE apps/react/myremote/src/styles.css
CREATE apps/react/myremote/tsconfig.json
CREATE apps/react/myremote/project.json
CREATE apps/react/myremote/.eslintrc.json
CREATE apps/react/myremote/jest.config.ts
CREATE apps/react/myremote/tsconfig.spec.json
CREATE apps/react/myremote/src/bootstrap.tsx
CREATE apps/react/myremote/module-federation.config.ts
CREATE apps/react/myremote/src/main.ts
CREATE apps/react/myremote/src/remote-entry.ts
UPDATE apps/react/shell/module-federation.config.ts
UPDATE tsconfig.base.json
```

{% /tab %}
{% tab label="Angular" %}

```{% command="nx g @nx/angular:remote apps/angular/myremote --host=shell" %}
> NX Generating @nx/angular:host

CREATE apps/angular/myremote/project.json
CREATE apps/angular/myremote/src/assets/.gitkeep
CREATE apps/angular/myremote/src/favicon.ico
CREATE apps/angular/myremote/src/index.html
CREATE apps/angular/myremote/src/styles.css
CREATE apps/angular/myremote/tsconfig.app.json
CREATE apps/angular/myremote/tsconfig.json
CREATE apps/angular/myremote/src/app/app.ts
CREATE apps/angular/myremote/src/app/app.routes.ts
CREATE apps/angular/myremote/src/main.ts
CREATE apps/angular/myremote/.eslintrc.json
CREATE apps/angular/myremote/jest.config.ts
CREATE apps/angular/myremote/src/test-setup.ts
CREATE apps/angular/myremote/tsconfig.spec.json
CREATE apps/angular/myremote/src/app/remote-entry/entry.ts
CREATE apps/angular/myremote/src/app/remote-entry/entry.routes.ts
CREATE apps/angular/myremote/src/app/remote-entry/nx-welcome.ts
CREATE apps/angular/myremote/module-federation.config.ts
CREATE apps/angular/myremote/webpack.config.ts
CREATE apps/angular/myremote/webpack.prod.config.ts
CREATE apps/angular/myremote/src/bootstrap.ts
UPDATE apps/angular/shell/module-federation.config.ts
UPDATE tsconfig.base.json
```

{% /tab %}
{% /tabs %}

## Building your Remote

Your `remote` application acts like any other application in the context of Nx, and therefore building it as simple as
running:

```shell
nx build myremote
```

## Serving your Remote

The `remote` application is generated with two serve-like targets. These are:

- serve
- serve-static

They can be run as usual with Nx:

```shell
nx serve myremote
nx serve-static myremote
```

### Serve Target

The `serve` target will use `webpack-dev-server` to serve your application, allowing for HMR and Live Reload. This is
useful when you're working locally on that specific remote application.

### Serve-Static Target

The `serve-static` target will first build your application, storing the build artifact in the defined output directory
_(usually `dist/path/to/remote`)_. It will then use `http-server` to serve the built application locally.  
This is less memory and CPU intensive than `webpack-dev-server` but it does not support HMR or Live Reload.

The purpose of the `serve-static` target is to allow you to serve your `host` application, along with all of
the `remote` applications it depends on without being too resource intensive.

This has been further expanded upon. When you serve the `host` application, Nx will build (or pull from cache) your
`remote` applications and serve them all via a single file server, to further reduce resource consumption.

### Serving your Remote via your Host

Generally, your `host` is the main application that you deploy and that users visit. It consumes modules from `remote`
applications, but those `remote` applications are usually never visited directly by a user.  
Therefore, to support developing your application in a manner that replicates how users use the application, when
serving a `host` application, Nx will serve all the dependent remotes automatically.

By default, the dependent `remote` applications will be served via the `serve-static` command. However, if you are
working on a specific remote application, you can tell Nx to serve the `host` application and any number of `remote`
applications via the `webpack-dev-server` allowing those remote applications to take advantage of HMR and Live Reloading
as you work on them.

To do this, run the command:

```shell
## React
nx serve myremote

## Angular
nx serve host --devRemotes=myremote
```

This informs Nx to run the `serve` command of `myremote`, rather than the `serve-static` command.
