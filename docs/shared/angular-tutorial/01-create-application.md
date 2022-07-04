# Angular Nx Tutorial - Step 1: Create Application

{% youtube
src="https://www.youtube.com/embed/i37yJKK8qGI"
title="Nx.dev Tutorial | Angular | Step 1: Create Application"
width="100%" /%}

In this tutorial you use Nx to build a full-stack application out of common libraries using modern technologies like Cypress and Nest.

{% callout type="note" title="Plugins for a rich developer experience" %}
In this tutorial, we use several Nx plugins to provide a rich developer experience that do most of the work for you. **All the plugins are optional.** [Read about using Nx Core without plugins](/getting-started/nx-core).
{% /callout %}

## Create a new workspace

**Start by creating a new workspace.**

```bash
npx create-nx-workspace@latest
```

You then receive the following prompts in your command line:

```bash
Workspace name (e.g., org name)     myorg
What to create in the new workspace angular
Application name                    todos
Default stylesheet format           CSS
```

> You can also choose to add [Nx Cloud](https://nx.app), but its not required for the tutorial.

When asked about 'preset', select `angular`, and `todos` for the app name.

```treeview
myorg/
├── apps/
│   ├── todos/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── assets/
│   │   │   ├── environments/
│   │   │   ├── favicon.ico
│   │   │   ├── index.html
│   │   │   ├── main.ts
│   │   │   ├── polyfills.ts
│   │   │   ├── styles.scss
│   │   │   └── test-setup.ts
│   │   ├── .browserslistrc
│   │   ├── .eslintrc.json
│   │   ├── jest.config.js
│   │   ├── project.json
│   │   ├── tsconfig.app.json
│   │   ├── tsconfig.editor.json
│   │   ├── tsconfig.json
│   │   └── tsconfig.spec.json
│   └── todos-e2e/
│       ├── src/
│       │   ├── fixtures/
│       │   │   └── example.json
│       │   ├── integration/
│       │   │   └── app.spec.ts
│       │   ├── plugins/
│       │   │   └── index.ts
│       │   └── support/
│       │       ├── app.po.ts
│       │       ├── commands.ts
│       │       └── index.ts
│       ├── cypress.json
│       ├── project.json
│       └── tsconfig.json
├── libs/
├── tools/
├── .eslintrc.json
├── .prettierrc
├── angular.json
├── decorate-angular-cli.js
├── jest.config.js
├── jest.preset.js
├── nx.json
├── package.json
├── README.md
└── tsconfig.base.json
```

The generate command added two projects to our workspace:

- An Angular application
- E2E tests for the Angular application

## Serve the newly created application

Now that the application is set up, run it locally via:

```bash
npx nx serve todos
```

## Note on the Nx CLI

If you would prefer to run using a global installation of Nx, you can run:

```bash
nx serve todos
```

Depending on how your dev env is set up, the command above might result in `Command 'nx' not found`.

To fix it, you can either install the `nx` cli globally by running:

{% tabs %}
{% tab label="yarn" %}

```bash
yarn global add nx
```

{% /tab %}
{% tab label="npm" %}

```bash
npm install -g nx
```

{% /tab %}
{% /tabs %}

Alternatively, you can run the local installation of Nx by prepending every command with `npx`:

{% tabs %}
{% tab label="yarn" %}

```bash
yarn nx serve todos
```

{% /tab %}
{% tab label="npm" %}

```bash
npx nx serve todos
```

{% /tab %}
{% /tabs %}

## Note on `nx serve` and `ng serve`

The Nx CLI syntax is intentionally similar to the Angular CLI. The `nx serve` command
produces the same result as `ng serve`, and `nx build` produces the same results as `ng build`. However, the Nx CLI
supports advanced capabilities that aren't supported by the Angular CLI. For instance, Nx's computation cache only
works when using the Nx CLI. In other words, using `nx` instead of `ng` results in the same output, but often performs
a lot better.

## What's Next

- Continue to [Step 2: Add E2E Tests](/angular-tutorial/02-add-e2e-test)
