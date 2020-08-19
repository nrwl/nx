# Step 1: Create Application

In this tutorial you will use Nx to build a full-stack application out of common libraries using modern technologies.

> Next.js: Nx also has first-class Next.js support. Read more about it [here](https://nx.dev/react/plugins/next/overview)

## Create a New Workspace

**Start by creating a new workspace.**

```bash
npx create-nx-workspace@latest

? Workspace name (e.g., org name)     myorg
? What to create in the new workspace react
? Application name                    todos
? Default stylesheet format           CSS
```

When asked about 'preset', select `react`, and `todos` for the app name.

```treeview
myorg/
├── apps/
│   ├── todos/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── assets/
│   │   │   ├── environments/
│   │   │   ├── favicon.ico
│   │   │   ├── index.html
│   │   │   ├── main.tsx
│   │   │   ├── polyfills.ts
│   │   │   └── styles.css
│   │   ├── browserslist
│   │   ├── jest.config.js
│   │   ├── tsconfig.app.json
│   │   ├── tsconfig.json
│   │   └── tsconfig.spec.json
│   └── todos-e2e/
│       ├── src/
│       │   ├── fixtures/
│       │   │   └── example.json
│       │   ├── integration/
│       │   │   └── app.spec.ts
│       │   ├── plugins/
│       │   │   └── index.ts
│       │   └── support/
│       │       ├── app.po.ts
│       │       ├── commands.ts
│       │       └── index.ts
│       ├── cypress.json
│       ├── tsconfig.e2e.json
│       └── tsconfig.json
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
nx serve todos
```

## Note on the Nx CLI

Depending on how your dev env is set up, the command above might result in `Command 'nx' not found`.

To fix it, you can either install the `nx` cli globally by running:

```bash
npm install -g nx
```

or

```bash
yarn global add nx
```

Or you can prepend every command with `npm run`:

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
