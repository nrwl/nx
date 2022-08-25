# Angular Nx Tutorial - Step 1: Create Application

{% youtube
src="https://www.youtube.com/embed/i37yJKK8qGI"
title="Nx.dev Tutorial | Angular | Step 1: Create Application"
width="100%" /%}

In this tutorial you use Nx to build a full-stack application out of common libraries using modern technologies like Cypress and Nest.

{% callout type="note" title="Plugins for a rich developer experience" %}
In this tutorial, we use several Nx plugins to provide a rich developer experience that do most of the work for you. **All the plugins are optional.** [Read about using Nx without plugins](/core-tutorial/01-create-blog).
{% /callout %}

## Contents

- [1 - Create Application](/angular-tutorial/01-create-application)
- [2 - Add E2E Test](/angular-tutorial/02-add-e2e-test)
- [3 - Display Todos](/angular-tutorial/03-display-todos)
- [4 - Connect to API](/angular-tutorial/04-connect-to-api)
- [5 - Add Node Application](/angular-tutorial/05-add-node-app)
- [6 - Proxy Configuration](/angular-tutorial/06-proxy)
- [7 - Share Code](/angular-tutorial/07-share-code)
- [8 - Create Libraries](/angular-tutorial/08-create-libs)
- [9 - Project Graph](/angular-tutorial/09-dep-graph)
- [10 - Use Computation Caching](/angular-tutorial/10-computation-caching)
- [11 - Test Affected Projects](/angular-tutorial/11-test-affected-projects)
- [12 - Summary](/angular-tutorial/12-summary)

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
│   │   ├── jest.config.ts
│   │   ├── project.json
│   │   ├── tsconfig.app.json
│   │   ├── tsconfig.editor.json
│   │   ├── tsconfig.json
│   │   └── tsconfig.spec.json
│   └── todos-e2e/
│       ├── src/
│       │   ├── fixtures/
│       │   │   └── example.json
│       │   ├── e2e/
│       │   │   └── app.cy.ts
│       │   └── support/
│       │       ├── app.po.ts
│       │       ├── commands.ts
│       │       └── e2e.ts
│       ├── cypress.config.ts
│       ├── project.json
│       └── tsconfig.json
├── libs/
├── tools/
├── .eslintrc.json
├── .prettierrc
├── angular.json
├── decorate-angular-cli.js
├── jest.config.ts
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
