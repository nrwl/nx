---
title: Creating a Module Federation Host
description: Learn how to generate and configure a host application for Module Federation in React and Angular using Nx generators.
---

# Creating a Host

A `host` is the term within [Module Federation](https://module-federation.io/docs/en/mf-docs/0.2/getting-started/) given
to an application that loads and consumes federated modules
from `remotes`. At build time, these modules do not exist and are instead fetched via a network request and executed at
runtime. It can be likened to a modern-day approach to iframes.  
A host can be configured to know the location of the federated modules at build time _(called Static Federation)_ or it
can employ a mechanism to discover the location of the federated modules at runtime, usually on startup _(called Dynamic
Federation)_.

**Nx** includes first-class support for helping you to scaffold a Module Federation Architecture for your React and
Angular application(s).

## Generating a Host

To generate only a host application in your workspace, run the following command:

{% tabs %}
{% tab label="React" %}

```{% command="nx g @nx/react:host apps/react/shell" %}
NX  Generating @nx/react:host

CREATE apps/react/shell/src/app/app.spec.tsx
CREATE apps/react/shell/src/assets/.gitkeep
CREATE apps/react/shell/src/environments/environment.prod.ts
CREATE apps/react/shell/src/environments/environment.ts
CREATE apps/react/shell/src/favicon.ico
CREATE apps/react/shell/src/index.html
CREATE apps/react/shell/tsconfig.app.json
CREATE apps/react/shell/webpack.config.ts
CREATE apps/react/shell/.babelrc
CREATE apps/react/shell/src/app/nx-welcome.tsx
CREATE apps/react/shell/src/app/app.module.css
CREATE apps/react/shell/src/app/app.tsx
CREATE apps/react/shell/src/styles.css
CREATE apps/react/shell/tsconfig.json
CREATE apps/react/shell/project.json
CREATE apps/react/shell/.eslintrc.json
CREATE apps/react/shell/jest.config.ts
CREATE apps/react/shell/tsconfig.spec.json
CREATE apps/react/shell/src/bootstrap.tsx
CREATE apps/react/shell/module-federation.config.ts
CREATE apps/react/shell/src/main.ts
CREATE apps/react/shell/webpack.config.prod.ts
```

{% /tab %}
{% tab label="Angular" %}

```{% command="nx g @nx/angular:host apps/angular/shell" %}
NX Generating @nx/angular:host

CREATE apps/angular/shell/project.json
CREATE apps/angular/shell/src/assets/.gitkeep
CREATE apps/angular/shell/src/favicon.ico
CREATE apps/angular/shell/src/index.html
CREATE apps/angular/shell/src/styles.css
CREATE apps/angular/shell/tsconfig.app.json
CREATE apps/angular/shell/tsconfig.json
CREATE apps/angular/shell/src/app/app.css
CREATE apps/angular/shell/src/app/app.html
CREATE apps/angular/shell/src/app/app.spec.ts
CREATE apps/angular/shell/src/app/app.ts
CREATE apps/angular/shell/src/app/app.routes.ts
CREATE apps/angular/shell/src/app/nx-welcome.ts
CREATE apps/angular/shell/src/main.ts
CREATE apps/angular/shell/.eslintrc.json
CREATE apps/angular/shell/jest.config.ts
CREATE apps/angular/shell/src/test-setup.ts
CREATE apps/angular/shell/tsconfig.spec.json
CREATE apps/angular/shell/module-federation.config.ts
CREATE apps/angular/shell/webpack.config.ts
CREATE apps/angular/shell/webpack.prod.config.ts
CREATE apps/angular/shell/src/bootstrap.ts
```

{% /tab %}
{% /tabs %}

### Scaffold a Host with Remotes

To scaffold a host application along with remote applications in your workspace, run the following command:

{% tabs %}
{% tab label="React" %}

```{% command="nx g @nx/react:host apps/react/with-remotes/shell --remotes=remote1,remote2" %}
NX  Generating @nx/react:host

CREATE apps/react/with-remotes/shell/src/app/app.spec.tsx
CREATE apps/react/with-remotes/shell/src/assets/.gitkeep
CREATE apps/react/with-remotes/shell/src/environments/environment.prod.ts
CREATE apps/react/with-remotes/shell/src/environments/environment.ts
CREATE apps/react/with-remotes/shell/src/favicon.ico
CREATE apps/react/with-remotes/shell/src/index.html
CREATE apps/react/with-remotes/shell/tsconfig.app.json
CREATE apps/react/with-remotes/shell/webpack.config.ts
CREATE apps/react/with-remotes/shell/.babelrc
CREATE apps/react/with-remotes/shell/src/app/nx-welcome.tsx
CREATE apps/react/with-remotes/shell/src/app/app.module.css
CREATE apps/react/with-remotes/shell/src/app/app.tsx
CREATE apps/react/with-remotes/shell/src/styles.css
CREATE apps/react/with-remotes/shell/tsconfig.json
CREATE apps/react/with-remotes/shell/project.json
CREATE apps/react/with-remotes/shell/.eslintrc.json
CREATE apps/react/with-remotes/shell/jest.config.ts
CREATE apps/react/with-remotes/shell/tsconfig.spec.json
CREATE apps/react/with-remotes/shell/src/bootstrap.tsx
CREATE apps/react/with-remotes/shell/module-federation.config.ts
CREATE apps/react/with-remotes/shell/src/main.ts
CREATE apps/react/with-remotes/shell/webpack.config.prod.ts

CREATE apps/react/with-remotes/remote1/src/app/app.spec.tsx
CREATE apps/react/with-remotes/remote1/src/assets/.gitkeep
CREATE apps/react/with-remotes/remote1/src/environments/environment.prod.ts
CREATE apps/react/with-remotes/remote1/src/environments/environment.ts
CREATE apps/react/with-remotes/remote1/src/favicon.ico
CREATE apps/react/with-remotes/remote1/src/index.html
CREATE apps/react/with-remotes/remote1/tsconfig.app.json
CREATE apps/react/with-remotes/remote1/webpack.config.ts
CREATE apps/react/with-remotes/remote1/.babelrc
CREATE apps/react/with-remotes/remote1/src/app/nx-welcome.tsx
CREATE apps/react/with-remotes/remote1/src/app/app.module.css
CREATE apps/react/with-remotes/remote1/src/app/app.tsx
CREATE apps/react/with-remotes/remote1/src/styles.css
CREATE apps/react/with-remotes/remote1/tsconfig.json
CREATE apps/react/with-remotes/remote1/project.json
CREATE apps/react/with-remotes/remote1/.eslintrc.json
CREATE apps/react/with-remotes/remote1/jest.config.ts
CREATE apps/react/with-remotes/remote1/tsconfig.spec.json
CREATE apps/react/with-remotes/remote1/src/bootstrap.tsx
CREATE apps/react/with-remotes/remote1/module-federation.config.ts
CREATE apps/react/with-remotes/remote1/src/main.ts
CREATE apps/react/with-remotes/remote1/src/remote-entry.ts
CREATE apps/react/with-remotes/remote1/webpack.config.prod.ts

UPDATE tsconfig.base.json

CREATE apps/react/with-remotes/remote2/src/app/app.spec.tsx
CREATE apps/react/with-remotes/remote2/src/assets/.gitkeep
CREATE apps/react/with-remotes/remote2/src/environments/environment.prod.ts
CREATE apps/react/with-remotes/remote2/src/environments/environment.ts
CREATE apps/react/with-remotes/remote2/src/favicon.ico
CREATE apps/react/with-remotes/remote2/src/index.html
CREATE apps/react/with-remotes/remote2/tsconfig.app.json
CREATE apps/react/with-remotes/remote2/webpack.config.ts
CREATE apps/react/with-remotes/remote2/.babelrc
CREATE apps/react/with-remotes/remote2/src/app/nx-welcome.tsx
CREATE apps/react/with-remotes/remote2/src/app/app.module.css
CREATE apps/react/with-remotes/remote2/src/app/app.tsx
CREATE apps/react/with-remotes/remote2/src/styles.css
CREATE apps/react/with-remotes/remote2/tsconfig.json
CREATE apps/react/with-remotes/remote2/project.json
CREATE apps/react/with-remotes/remote2/.eslintrc.json
CREATE apps/react/with-remotes/remote2/jest.config.ts
CREATE apps/react/with-remotes/remote2/tsconfig.spec.json
CREATE apps/react/with-remotes/remote2/src/bootstrap.tsx
CREATE apps/react/with-remotes/remote2/module-federation.config.ts
CREATE apps/react/with-remotes/remote2/src/main.ts
CREATE apps/react/with-remotes/remote2/src/remote-entry.ts
CREATE apps/react/with-remotes/remote2/webpack.config.prod.ts
```

{% /tab %}
{% tab label="Angular" %}

```{% command="nx g @nx/angular:host apps/angular/with-remotes/shell --remotes=remote1,remote2" %}
> NX Generating @nx/angular:host

CREATE apps/angular/with-remotes/shell/project.json
CREATE apps/angular/with-remotes/shell/src/assets/.gitkeep
CREATE apps/angular/with-remotes/shell/src/favicon.ico
CREATE apps/angular/with-remotes/shell/src/index.html
CREATE apps/angular/with-remotes/shell/src/styles.css
CREATE apps/angular/with-remotes/shell/tsconfig.app.json
CREATE apps/angular/with-remotes/shell/tsconfig.json
CREATE apps/angular/with-remotes/shell/src/app/app.css
CREATE apps/angular/with-remotes/shell/src/app/app.html
CREATE apps/angular/with-remotes/shell/src/app/app.spec.ts
CREATE apps/angular/with-remotes/shell/src/app/app.ts
CREATE apps/angular/with-remotes/shell/src/app/app.routes.ts
CREATE apps/angular/with-remotes/shell/src/app/nx-welcome.ts
CREATE apps/angular/with-remotes/shell/src/main.ts
CREATE apps/angular/with-remotes/shell/.eslintrc.json
CREATE apps/angular/with-remotes/shell/jest.config.ts
CREATE apps/angular/with-remotes/shell/src/test-setup.ts
CREATE apps/angular/with-remotes/shell/tsconfig.spec.json
CREATE apps/angular/with-remotes/shell/module-federation.config.ts
CREATE apps/angular/with-remotes/shell/webpack.config.ts
CREATE apps/angular/with-remotes/shell/webpack.prod.config.ts
CREATE apps/angular/with-remotes/shell/src/bootstrap.ts

CREATE apps/angular/with-remotes/ng-remote1/project.json
CREATE apps/angular/with-remotes/ng-remote1/src/assets/.gitkeep
CREATE apps/angular/with-remotes/ng-remote1/src/favicon.ico
CREATE apps/angular/with-remotes/ng-remote1/src/index.html
CREATE apps/angular/with-remotes/ng-remote1/src/styles.css
CREATE apps/angular/with-remotes/ng-remote1/tsconfig.app.json
CREATE apps/angular/with-remotes/ng-remote1/tsconfig.json
CREATE apps/angular/with-remotes/ng-remote1/src/app/app.ts
CREATE apps/angular/with-remotes/ng-remote1/src/app/app.routes.ts
CREATE apps/angular/with-remotes/ng-remote1/src/main.ts
CREATE apps/angular/with-remotes/ng-remote1/.eslintrc.json
CREATE apps/angular/with-remotes/ng-remote1/jest.config.ts
CREATE apps/angular/with-remotes/ng-remote1/src/test-setup.ts
CREATE apps/angular/with-remotes/ng-remote1/tsconfig.spec.json
CREATE apps/angular/with-remotes/ng-remote1/src/app/remote-entry/entry.ts
CREATE apps/angular/with-remotes/ng-remote1/src/app/remote-entry/entry.routes.ts
CREATE apps/angular/with-remotes/ng-remote1/src/app/remote-entry/nx-welcome.ts
CREATE apps/angular/with-remotes/ng-remote1/module-federation.config.ts
CREATE apps/angular/with-remotes/ng-remote1/webpack.config.ts
CREATE apps/angular/with-remotes/ng-remote1/webpack.prod.config.ts
CREATE apps/angular/with-remotes/ng-remote1/src/bootstrap.ts

UPDATE tsconfig.base.json

CREATE apps/angular/with-remotes/ng-remote2/project.json
CREATE apps/angular/with-remotes/ng-remote2/src/assets/.gitkeep
CREATE apps/angular/with-remotes/ng-remote2/src/favicon.ico
CREATE apps/angular/with-remotes/ng-remote2/src/index.html
CREATE apps/angular/with-remotes/ng-remote2/src/styles.css
CREATE apps/angular/with-remotes/ng-remote2/tsconfig.app.json
CREATE apps/angular/with-remotes/ng-remote2/tsconfig.json
CREATE apps/angular/with-remotes/ng-remote2/src/app/app.ts
CREATE apps/angular/with-remotes/ng-remote2/src/app/app.routes.ts
CREATE apps/angular/with-remotes/ng-remote2/src/main.ts
CREATE apps/angular/with-remotes/ng-remote2/.eslintrc.json
CREATE apps/angular/with-remotes/ng-remote2/jest.config.ts
CREATE apps/angular/with-remotes/ng-remote2/src/test-setup.ts
CREATE apps/angular/with-remotes/ng-remote2/tsconfig.spec.json
CREATE apps/angular/with-remotes/ng-remote2/src/app/remote-entry/entry.ts
CREATE apps/angular/with-remotes/ng-remote2/src/app/remote-entry/entry.routes.ts
CREATE apps/angular/with-remotes/ng-remote2/src/app/remote-entry/nx-welcome.ts
CREATE apps/angular/with-remotes/ng-remote2/module-federation.config.ts
CREATE apps/angular/with-remotes/ng-remote2/webpack.config.ts
CREATE apps/angular/with-remotes/ng-remote2/webpack.prod.config.ts
CREATE apps/angular/with-remotes/ng-remote2/src/bootstrap.ts
```

{% /tab %}
{% /tabs %}

## Serving your Host

Your `host` application acts like any other application in the context of Nx, and therefore serving it locally is as
simple as running:

```shell
nx serve shell
```

When you serve your `host`, Nx will discover any dependent remote applications that are also in the workspace and serve them statically. To learn more about check out our in-depth breakdown of [what happens when you serve your host](/technologies/module-federation/concepts/nx-module-federation-technical-overview#what-happens-when-you-serve-your-host).

## Building your Host

In the same vein, you can build your host by running:

```shell
nx build shell
```

To support [Independent Deployability](/technologies/module-federation/concepts/module-federation-and-nx#independent-deployability) `host` applications do not have `implicitDependencies` set in their `project.json`. If you want to build all your `remotes` when you build your `host`, add `implicitDependencies` to your `host`'s `project.json` with each `remote` listed:

```json
{
  ...,
  "implicitDependencies": ["remote1", "remote2"]
}
```
