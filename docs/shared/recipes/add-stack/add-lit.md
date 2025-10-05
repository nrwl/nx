---
title: Add a New Lit Project
description: Learn how to integrate Lit with Nx, including setting up applications, configuring build systems, and leveraging Nx features with manual configuration.
---

# Add a New Lit Project

The code for this example is available on GitHub:

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/lit" /%}

**Supported Features**

Because we are not using an Nx plugin for Lit, there are few items we'll have to configure manually. We'll have to configure our own build system. There are no pre-created Lit-specific code generators. And we'll have to take care of updating any framework dependencies as needed.

{% pill url="/features/run-tasks" %}✅ Run Tasks{% /pill %}
{% pill url="/features/cache-task-results" %}✅ Cache Task Results{% /pill %}
{% pill url="/ci/features/remote-cache" %}✅ Share Your Cache{% /pill %}
{% pill url="/features/explore-graph" %}✅ Explore the Graph{% /pill %}
{% pill url="/ci/features/distribute-task-execution" %}✅ Distribute Task Execution{% /pill %}
{% pill url="/getting-started/editor-setup" %}✅ Integrate with Editors{% /pill %}
{% pill url="/features/automate-updating-dependencies" %}✅ Automate Updating Nx{% /pill %}
{% pill url="/features/enforce-module-boundaries" %}✅ Enforce Module Boundaries{% /pill %}
{% pill url="/features/generate-code" %}🚫 Use Code Generators{% /pill %}
{% pill url="/features/automate-updating-dependencies" %}🚫 Automate Updating Framework Dependencies{% /pill %}

## Install Lit and Other Dependencies

Install all the dependencies we need:

{% tabs %}
{%tab label="npm"%}

```shell {% skipRescope=true %}
nx add @nx/node
npm add -D lit http-server
```

{% /tab %}
{%tab label="yarn"%}

```shell {% skipRescope=true %}
nx add @nx/node
yarn add -D lit http-server
```

{% /tab %}
{%tab label="pnpm"%}

```shell {% skipRescope=true %}
nx add @nx/node
pnpm add -D lit http-server
```

{% /tab %}

{% tab label="bun" %}

```shell
nx add @nx/node
bun add -D lit http-server
```

{% /tab %}
{% /tabs %}

## Create an Application

We'll start with a node application and then tweak the settings to match what we need. Add a new node application to your workspace with the following command:

```shell
nx g @nx/node:app apps/my-lit-app
```

Choose `none` for the node framework, since we won't be using this as a node app.

### Turn the Application into a Lit Application

Update `main.ts`:

```typescript {% fileName="apps/my-lit-app/src/main.ts" %}
import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('my-element')
export class MyElement extends LitElement {
  @property()
  version = 'STARTING';

  render() {
    return html`
      <p>Welcome to the Lit tutorial!</p>
      <p>This is the ${this.version} code.</p>
    `;
  }
}
```

Create `index.html`:

```html {% fileName="apps/my-lit-app/index.html" %}
<!DOCTYPE html>
<html>
  <head>
    <script type="module" src="main.js"></script>
    <style>
      body {
        font-family: 'Open Sans', sans-serif;
        font-size: 1.5em;
        padding-left: 0.5em;
      }
    </style>
  </head>
  <body>
    <my-element></my-element>
  </body>
</html>
```

### Update the Build Task

In the `project.json` file update the `options` under the `build` target. The properties that need to change are `format`, `bundle`, `thirdParty`, and `assets`:

```json {% fileName="apps/my-lit-app/project.json" %}
{
  "targets": {
    "build": {
      "executor": "@nx/esbuild:esbuild",
      "outputs": ["{options.outputPath}"],
      "defaultConfiguration": "production",
      "options": {
        "outputPath": "dist/apps/my-lit-app",
        "format": ["esm"],
        "bundle": true,
        "thirdParty": true,
        "main": "apps/my-lit-app/src/main.ts",
        "tsConfig": "apps/my-lit-app/tsconfig.app.json",
        "assets": ["apps/my-lit-app/src/assets", "apps/my-lit-app/index.html"],
        "generatePackageJson": true,
        "esbuildOptions": {
          "sourcemap": true,
          "outExtension": {
            ".js": ".js"
          }
        }
      }
    }
  }
}
```

Now, when you run the build, there should be `index.html`, `main.js` and `package.json` under `dist/apps/my-lit-app`. Try it out:

```shell
nx build my-lit-app
```

### Update the Serve Task

To serve the app, we'll completely overwrite the existing `serve` task. Change it to this:

```json {% fileName="apps/my-lit-app/project.json" %}
{
  "targets": {
    "serve": {
      "dependsOn": ["build"],
      "executor": "nx:run-commands",
      "options": {
        "commands": [
          "http-server dist/apps/my-lit-app",
          "nx watch --projects=my-lit-app --includeDependentProjects -- nx build my-lit-app"
        ]
      }
    }
  }
}
```

`"dependsOn": ["build"]` will ensure that the `build` task is always run before the `serve` task. The entries under `commands` will each be run in parallel. The `http-server` line serves the `build` output with a simple server. The `nx watch` line will automatically re-run the `build` task any time the application code or any project it depends on changes.

Run the `serve` task and see your Lit app in action:

```shell
nx serve my-lit-app
```

## Create a Library

Let's create a library that our Lit application is going to consume. To create a new library, install the `@nx/js` package and run:

```shell
nx g @nx/js:lib libs/my-lib
```

Once the library is created, update the following files.

```typescript {% fileName="libs/my-lib/src/lib/my-lib.ts" %}
export function someFunction(): string {
  return 'some function';
}
```

```typescript {% fileName="apps/my-lit-app/src/main.ts" %}
import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { someFunction } from '@my-org/my-lib';

@customElement('my-element')
export class MyElement extends LitElement {
  @property()
  version = 'STARTING';

  render() {
    return html`
      <p>Welcome to the Lit tutorial!</p>
      <p>This is the ${this.version} code.</p>
      <p>Imported from a library: ${someFunction()}.</p>
    `;
  }
}
```

Now when you serve your application, you'll see the content from the library being displayed.

## More Documentation

- [@nx/esbuild](/technologies/build-tools/esbuild/introduction)
- [@nx/js](/technologies/typescript/introduction)
- [Lit](https://lit.dev/)
