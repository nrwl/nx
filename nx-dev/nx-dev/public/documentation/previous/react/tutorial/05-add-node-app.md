# React Nx Tutorial - Step 5: Add Node Application Implementing API

## Nx.dev Tutorial | React | Step 5: Add Node Application Implementing API

<iframe width="560" height="315" src="https://www.youtube.com/embed/XgfknOqgxQ0" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

The requests fail because the API has not been created yet. Using Nx you can develop node applications next to your React applications. You can use same commands to run and test them. You can share code between the backend and the frontend. Use this capability to implement the API service.

## Add Express Plugin to Your Workspace

Nx is an open platform with plugins for many modern tools and frameworks. **To see some plugins, run `npx nx list`:**

```bash
>  NX  Installed plugins:

  @nrwl/cypress (builders,schematics)
  @nrwl/jest (builders,schematics)
  @nrwl/linter (builders)
  @nrwl/react (schematics)
  @nrwl/web (builders,schematics)
  @nrwl/workspace (builders,schematics)


>  NX  Also available:

  @nrwl/angular (schematics)
  @nrwl/express (builders,schematics)
  @nrwl/nest (builders,schematics)
  @nrwl/next (builders,schematics)
  @nrwl/node (builders,schematics)
  @nrwl/nx-plugin (builders,schematics)
  @nrwl/storybook (builders,schematics)


>  NX  Community plugins:

  @nxtend/ionic-react - An Nx plugin for developing Ionic React applications and libraries
  @angular-architects/ddd - Nx plugin for structuring a monorepo with domains and layers
  ...
```

**Now run `npx nx list @nrwl/express`, and you will see:**

```bash
>  NX   NOTE  @nrwl/express is not currently installed

  Use "yarn add --dev @nrwl/express" to add new capabilities
```

**Add the dependency:**

```bash
npm install --save-dev @nrwl/express
```

or

```bash
yarn add --dev @nrwl/express
```

> `@nrwl/express` also added `@nrwl/node`. Run `npx nx list @nrwl/express` and `npx nx list @nrwl/node` to see what those plugins provide.

## Generate an Express Application

**Run the following to generate a new Express application:**

```bash
npx nx g @nrwl/express:app api --frontendProject=todos
```

After this is done, you should see something like this:

```treeview
myorg/
├── apps/
│   ├── todos/
│   ├── todos-e2e/
│   └── api/
│       ├── src/
│       │   ├── app/
│       │   ├── assets/
│       │   ├── environments/
│       │   │   ├── environment.ts
│       │   │   └── environment.prod.ts
│       │   └── main.ts
│       ├── jest.conf.js
│       ├── proxy.conf.json
│       ├── tsconfig.app.json
│       ├── tsconfig.json
│       └── tsconfig.spec.json
├── libs/
├── tools/
├── workspace.json
├── nx.json
├── package.json
└── tsconfig.json
```

The `apps` directory is where Nx places anything you can run: frontend applications, backend applications, e2e test suites. That's why the `api` application appeared there.

You can run:

- `npx nx serve api` to serve the application
- `npx nx build api` to build the application
- `npx nx test api` to test the application

**Add a file `apps/api/src/app/todos.ts`.**

```typescript
import { Express } from 'express';

interface Todo {
  title: string;
}

const todos: Todo[] = [{ title: 'Todo 1' }, { title: 'Todo 2' }];

export function addTodoRoutes(app: Express) {
  app.get('/api/todos', (req, resp) => resp.send(todos));
  app.post('/api/addTodo', (req, resp) => {
    const newTodo = {
      title: `New todo ${Math.floor(Math.random() * 1000)}`,
    };
    todos.push(newTodo);
    resp.send(newTodo);
  });
}
```

Here, you are building an Express application with Nx. Nx also comes with Nest support, and you can also use any other node library you want.

**Next update `apps/api/src/main.ts` to register the routes**

```typescript
import * as express from 'express';
import { addTodoRoutes } from './app/todos';

const app = express();

app.get('/api', (req, res) => {
  res.send({ message: 'Welcome to api!' });
});
addTodoRoutes(app);

const port = process.env.port || 3333;
const server = app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}/api`);
});
server.on('error', console.error);
```

!!!!!
Run "npx nx serve api" and open http://localhost:3333/api/todos. What do you see?
!!!!!
`[{"title":"Todo 1"},{"title":"Todo 2"}]`
Blank screen
404
