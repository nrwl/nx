# React Nx Tutorial - Step 1: Create Application

<iframe loading="lazy" width="560" height="315" src="https://www.youtube.com/embed/HcQE5R6ucng" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe>

In this tutorial you use Nx to build a full-stack application out of common libraries using modern technologies.

> Next.js: Nx also has first-class Next.js support. Read more about it [here](/next/overview)

> This tutorial uses several Nx plugins to provide a rich dev experience. **All the plugins are optional.** [Read about using Nx Core without plugins](/getting-started/nx-core).

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
│   │   ├── jest.config.js
│   │   ├── project.json
│   │   ├── tsconfig.app.json
│   │   ├── tsconfig.json
│   │   └── tsconfig.spec.json
│   └── todos-e2e/
│       ├── src/
│       │   ├── fixtures/
│       │   │   └── example.json
│       │   ├── integration/
│       │   │   └── app.spec.ts
│       │   ├── plugins/
│       │   │   └── index.js
│       │   └── support/
│       │       ├── app.po.ts
│       │       ├── commands.ts
│       │       └── index.ts
│       ├── .eslintrc.json
│       ├── cypress.json
│       ├── project.json
│       └── tsconfig.json
├── libs/
├── tools/
├── .eslintrc.json
├── .prettierrc
├── babel.config.json
├── jest.config.js
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

If you would prefer to run using a global installation of Nx, you can run:

```bash
nx serve todos
```

Depending on how your dev env is set up, the command above might result in `Command 'nx' not found`.

To fix it, you can either install the `nx` cli globally by running:

```bash
npm install -g nx
```

or

```bash
yarn global add nx
```

Alternatively, you can run the local installation of Nx by prepending every command with `npx`:

```bash
npx nx serve todos
```

or

```bash
yarn nx serve todos
```

## What's Next

- Continue to [Step 2: Add E2E Tests](/react-tutorial/02-add-e2e-test)
