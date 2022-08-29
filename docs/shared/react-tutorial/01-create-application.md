# React Nx Tutorial - Step 1: Create Application

{% youtube
src="https://www.youtube.com/embed/HcQE5R6ucng"
title="Nx.dev Tutorial | React | Step 1: Create Application"
width="100%" /%}

In this tutorial you use Nx to build a full-stack application out of common libraries using modern technologies.

{% callout type="check" title="Nx has first-class Next.js support" %}
Nx has first-class Next.js support, if you are looking to try or use it for your project. Read more about it [here](/packages/next)
{% /callout %}

{% callout type="note" title="Plugins for a rich developer experience" %}
In this tutorial, we use several Nx plugins to provide a rich developer experience that do most of the work for you. **All the plugins are optional.**
{% /callout %}

## Contents

- [1 - Create Application](/react-tutorial/01-create-application)
- [2 - Add E2E Test](/react-tutorial/02-add-e2e-test)
- [3 - Display Todos](/react-tutorial/03-display-todos)
- [4 - Connect to API](/react-tutorial/04-connect-to-api)
- [5 - Add Node Application](/react-tutorial/05-add-node-app)
- [6 - Proxy Configuration](/react-tutorial/06-proxy)
- [7 - Share Code](/react-tutorial/07-share-code)
- [8 - Create Libraries](/react-tutorial/08-create-libs)
- [9 - Project Graph](/react-tutorial/09-dep-graph)
- [10 - Use Computation Caching](/react-tutorial/10-computation-caching)
- [11 - Test Affected Projects](/react-tutorial/11-test-affected-projects)
- [12 - Summary](/react-tutorial/12-summary)

## Create a new workspace

Start by creating a new workspace.

```bash
npx create-nx-workspace@latest
```

You then receive the following prompts in your command line:

```bash
Workspace name (e.g., org name)     myorg
What to create in the new workspace react
Application name                    todos
Default stylesheet format           CSS
```

Enter the indicated answers.

> You can also choose to add [Nx Cloud](https://nx.app), but its not required for the tutorial.

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
│   │   │   ├── main.tsx
│   │   │   ├── polyfills.ts
│   │   │   └── styles.css
│   │   ├── .babelrc
│   │   ├── .browserslistrc
│   │   ├── .eslintrc.json
│   │   ├── jest.config.ts
│   │   ├── project.json
│   │   ├── tsconfig.app.json
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
│       ├── .eslintrc.json
│       ├── cypress.config.ts
│       ├── project.json
│       └── tsconfig.json
├── libs/
├── tools/
├── .eslintrc.json
├── .prettierrc
├── babel.config.json
├── jest.config.ts
├── jest.preset.js
├── nx.json
├── package.json
├── README.md
├── tsconfig.base.json
└── workspace.json
```

Two projects were added to the workspace:

- A React application
- E2E tests for the React application

## Serve the newly created application

Now that the application is set up, run it locally via:

```bash
npx nx serve todos
```

## Note on the Nx CLI

If you prefer to run using a global installation of Nx, you can run:

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

## What's Next

- Continue to [Step 2: Add E2E Tests](/react-tutorial/02-add-e2e-test)
