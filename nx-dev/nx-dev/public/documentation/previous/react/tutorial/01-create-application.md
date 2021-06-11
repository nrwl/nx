# React Nx Tutorial - Step 1: Create Application

## Nx.dev Tutorial | React | Step 1: Create Application

<iframe width="560" height="315" src="https://www.youtube.com/embed/HcQE5R6ucng" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

In this tutorial you will use Nx to build a full-stack application out of common libraries using modern technologies.

> Next.js: Nx also has first-class Next.js support. Read more about it [here](/{{framework}}/next/overview)

## Create a New Workspace

**Start by creating a new workspace.**

```bash
npx create-nx-workspace@latest
```

You will then receive the following prompts in your command line:

```
? Workspace name (e.g., org name)     myorg
? What to create in the new workspace react
? Application name                    todos
? Default stylesheet format           CSS
```

When asked about 'preset', select `react`, and `todos` for the app name.

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
│   │   ├── browserslist
│   │   ├── jest.config.js
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
│       │   │   └── index.ts
│       │   └── support/
│       │       ├── app.po.ts
│       │       ├── commands.ts
│       │       └── index.ts
│       ├── cypress.json
│       ├── tsconfig.e2e.json
│       └── tsconfig.json
├── libs/
├── tools/
├── README.md
├── workspace.json
├── nx.json
├── package.json
└── tsconfig.json
```

The generate command added two projects to our workspace:

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

Alternatively, you can run the local installation of Nx by prepending every command with `npm run`:

```bash
npm run nx -- serve todos
```

or

```bash
yarn nx serve todos
```

!!!!!
Open http://localhost:4200 in the browser. What do you see?
!!!!!
Page saying "Welcome to Todos!"
Page saying "This is an React app built with Create React App"
404
