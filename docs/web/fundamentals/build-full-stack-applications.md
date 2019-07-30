# Building Full-Stack Applications

In this guide you will:

- Build a full-stack application using web components and Express.
- Share code between frontend and backend

## Creating an empty workspace

Start with creating a new workspace with the following:

```bash
npx create-nx-workspace@latest
cd myorg
```

## Creating a Frontend Application

Now, create a frontend application using web components with:

```bash
yarn add --dev @nrwl/web # Add Web Capabilities to the workspace
nx g @nrwl/web:application frontend # Create a Web Application
```

This will create the following:

```treeview
myorg/
├── apps/
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── assets/
│   │   │   ├── environments/
│   │   │   ├── favicon.ico
│   │   │   ├── index.html
│   │   │   ├── main.ts
│   │   │   ├── polyfills.ts
│   │   │   └── styles.css
│   │   ├── browserslist
│   │   ├── jest.config.js
│   │   ├── tsconfig.app.json
│   │   ├── tsconfig.json
│   │   └── tsconfig.spec.json
│   └── frontend-e2e/
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

You can run:

- `nx serve frontend` to serve the application
- `nx build frontend` to build the application
- `nx test frontend` to test the application

## Creating a Node Application

Real-world applications do not live in isolation — they need APIs to talk to. Setup your frontend application to fetch some todos.

```typescript jsx
interface Todo {
  title: string;
}

export class AppElement extends HTMLElement {
  todos: Todo[] = [];

  connectedCallback() {
    this.innerHTML = `
      <h1>Todos</h1>
      <ul></ul>
    `;

    fetch('/api/todos')
      .then(_ => _.json())
      .then(todos => {
        this.todos = todos;
        this.renderTodos();
      });
  }

  private renderTodos() {
    this.querySelector('ul').innerHTML = this.todos
      .map(t => `<li class="todo">${t.title}</li>`)
      .join('');
  }
}
```

No todos will show up yet because the API does not exist. So the next step is to create the api using Express.

Create an Express application similar to how you created the web components application earlier:

```bash
yarn add --dev @nrwl/express # Add Express Capabilities to the workspace
nx g @nrwl/express:application api --frontend-project frontend # sets up the proxy configuration so you can access the API in development
```

This will create the following:

```treeview
myorg/
├── apps/
│   ├── todos/
│   ├── todos-e2e/
│   └── api/
│       ├── src/
│       │   ├── app/
│       │   ├── assets/
│       │   ├── environments/
│       │   │   ├── environment.ts
│       │   │   └── environment.prod.ts
│       │   └── main.ts
│       ├── jest.conf.js
│       ├── proxy.conf.json
│       ├── tsconfig.app.json
│       ├── tsconfig.json
│       └── tsconfig.spec.json
├── libs/
├── tools/
├── workspace.json
├── nx.json
├── package.json
└── tsconfig.json
```

The `apps` directory is where Nx places anything you can run: frontend applications, backend applications, e2e test suites. That is why the `api` application was generated there.

You can run:

- `nx serve api` to serve the application
- `nx build api` to build the application
- `nx test api` to test the application

### Adding an Endpoint

Now, add an endpoint to get todos by updating `apps/api/src/main.ts`

```typescript
import * as express from 'express';

const app = express();

interface Todo {
  title: string;
}

const todos: Todo[] = [{ title: 'Todo 1' }, { title: 'Todo 2' }];

app.get('/api', (req, res) => {
  res.send({ message: 'Welcome to api!' });
});
app.get('/api/todos', (req, resp) => resp.send(todos));

const port = process.env.port || 3333;
const server = app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}/api`);
});
server.on('error', console.error);
```

Now, run `nx serve frontend & nx serve api`, and open [http://localhost:4200](http://localhost:4200) to see both the frontend and backend working:

The application works, but you have a small problem. The `Todo` interface is defined twice: once on the frontend, once on the backend. This duplication will inevitably result in the two interfaces going out of sync, which means that runtime errors will creep in. It's better to share this interface.

## Sharing Code Between Frontend and Backend

Normally sharing code between the backend and the frontend would have required days of work, but with Nx, it’s done in just minutes. In Nx, code is shared by creating libraries. Because everything is in a single repository, libraries can be imported without having to publish them to a registry.

Create a new library via:

```bash
nx g @nrwl/workspace:library data # This generates a barebone library with only Typescript setup
```

```treeview
myorg/
├── apps/
│   ├── todos/
│   ├── todos-e2e/
│   └── api/
├── libs/
│   └── data/
│       ├── src/
│       │   ├── lib/
│       │   │   └── data.ts
│       │   └── index.ts
│       ├── jest.conf.js
│       ├── tsconfig.app.json
│       ├── tsconfig.json
│       └── tsconfig.spec.json
├── tools/
├── nx.json
├── package.json
└── tsconfig.json
```

Next, move `Todo` into `libs/data/src/lib/data.ts`:

```typescript
export interface Todo {
  title: string;
}
```

Finally, update the frontend and the backend to import the interface from the library.

Update `apps/frontend/src/app/app.tsx`:

```typescript jsx
import { Todo } from '@myorg/data';

export class AppElement extends HTMLElement {
  //...
}
```

Update `apps/api/src/main.ts`:

```typescript
import * as express from 'express';
import { Todo } from '@myorg/data';

const app = express();

const todos: Todo[] = [{ title: 'Todo 1' }, { title: 'Todo 2' }];

//...
```

After this refactor, the backend and the frontend will share the same definition of `Todo` and never get out of sync. Being able to factor code into a lot of small libraries with a well-defined public API, which you can then use across both the backend and the frontend, is a key feature of Nx. You can read more about it in our [Monorepos and Automation](/web/fundamentals/monorepos-automation) guide.

## Nx is Smart

Having both frontend and backend code is already something amazing. In just minutes, You have a repository which can build multiple frontend and backend applications and share code between them.

But Nx can do a lot more than that. In Nx, your libraries, backend applications, frontend applications are all part of the same dependency graph, which you can see via:

```bash
nx dep-graph
```

![Full Stack Dependencies](./full-stack-deps.png)

If you change the data library, Nx will know that both the backend and the frontend can be affected by the change. This information can be used to test and build all areas affected by a change making Nx a powerful full-stack development environment that scales. You can read more about this Nx capability in the [Monorepos and Automation](/web/fundamentals/monorepos-automation) guide.

## Summary

With Nx, you can:

- Build full stack applications
- Share code between backend and frontend
- Scale your workspace by understanding how the backend and frontend depend on each other and using this information to only retest/rebuilt only what is affected.
