# Step 5: Add Node Application Implementing API

The requests fail because the API has not been created yet. Using Nx you can develop node applications next to your React applications. You can use same commands to run and test them. You can share code between the backend and the frontend. Use this capability to implement the API service.

## Add Express Capabilities to your workspace

Run the following to add the capability to develop Express applications in your workspace:

```bash
npm install --save-dev @nrwl/express
```

or

```bash
yarn add --dev @nrwl/express
```

## Create an Express Application

**Run the following to generate a new Express application:**

```bash
nx g @nrwl/express:app api --frontendProject=todos
```

Nx will ask you a few questions, and, as with the React application, the defaults will work well here.

After this is done, you should see something like this:

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

The `apps` directory is where Nx places anything you can run: frontend applications, backend applications, e2e test suites. That's why the `api` application appeared there.

You can run:

- `nx serve api` to serve the application
- `nx build api` to build the application
- `nx test api` to test the application

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
      title: `New todo ${Math.floor(Math.random() * 1000)}`
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
Run "nx serve api" and open http://localhost:3333/api/todos. What do you see?
!!!!!
`[{"title":"Todo 1"},{"title":"Todo 2"}]`
Blank screen
404
