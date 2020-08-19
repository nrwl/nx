# Step 1: Create Application

In this tutorial you will use Nx to build a full-stack application out of common libraries using modern technologies like Cypress and Nest.

## Create a New Workspace

**Start by creating a new workspace.**

```bash
npx create-nx-workspace@latest

? Workspace name (e.g., org name)     myorg
? What to create in the new workspace angular
? Application name                    todos
? Default stylesheet format           CSS
```

When asked about 'preset', select `angular`, and `todos` for the app name.

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
│   │   │   ├── main.ts
│   │   │   ├── polyfills.ts
│   │   │   ├── styles.scss
│   │   │   └── test.ts
│   │   ├── browserslist
│   │   ├── jest.conf.js
│   │   ├── tsconfig.app.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.spec.json
│   │   └── tslint.json
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
│       ├── tsconfig.json
│       └── tslint.json
├── libs/
├── tools/
├── angular.json
├── nx.json
├── package.json
├── tsconfig.json
├── tslint.json
└── README.md
```

The generate command added two projects to our workspace:

- An Angular application
- E2E tests for the Angular application

## Serve the newly created application

Now that the application is set up, run it locally via:

```bash
nx serve todos
```

## Note on `nx serve` and `ng serve`

Internally, the Nx CLI delegates to the Angular CLI when running commands or generating code. The `nx serve` command produces the same result as `ng serve`, and `nx build` produces the same results as `ng build`. However, the Nx CLI supports advanced capabilities that aren't supported by the Angular CLI. For instance, Nx's computation cache only works when using the Nx CLI. In other words, using `nx` instead `ng` will result in the same output, but often will perform a lot better. [Read more about Nx CLI and Angular CLI.](/angular/cli/nx-and-cli)

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
Page saying "This is an Angular app built with the Angular CLI"
404
