---
title: 'Node Server Tutorial - Part 2: Project Graph'
description: In this tutorial you'll create a backend-focused workspace with Nx.
---

# Node Server Tutorial - Part 2: Project Graph

Run the command: `npx nx graph`. A browser should open up with the following contents:

{% graph height="200px" type="project" jsonFile="shared/node-server-tutorial/initial-project-graph.json" %}
{% /graph %}

You'll notice that there is no dependency drawn from `products-api` to the `auth` library. The project graph is derived from the source code of your workspace. Once we actually wire everything up, the project graph will update accordingly.

### `auth`

Update the contents of the generated `auth.ts` file:

```typescript {% fileName="auth/src/lib/auth.ts" %}
export type AuthResponse = AuthSuccessResponse | AuthFailureResponse;
export interface AuthSuccessResponse {
  success: true;
  name: string;
}
export interface AuthFailureResponse {
  success: false;
}

export function doAuth(): AuthResponse {
  return { success: true, name: 'Cheddar' };
}
```

### `products-api`

Add a post endpoint to the `main.ts` file of the root project that uses the `doAuth()` function.

```typescript {% fileName="src/main.ts" %}
import express from 'express';
import { doAuth } from '@products-api/auth';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = express();

app.get('/', (req, res) => {
  res.send({ message: 'Hello API' });
});

app.post('/auth', (req, res) => {
  res.send(doAuth());
});

app.listen(port, host, () => {
  console.log(`[ ready ] http://${host}:${port}`);
});
```

{% callout type="note" title="Typescript Paths" %}
When a library is created, Nx adds a new Typescript path to the `tsconfig.base.json` file. The running Typescript server process inside of your editor sometimes doesn't pick up these changes and you have to restart the server to remove inline errors on your import statements. This can be done in VS Code from the command palette when viewing a typescript file (Command-Shift-P) "Typescript: Restart TS server"
{% /callout %}

### `e2e`

Update the e2e tests to check the new `/auth` endpoint.

```javascript {% fileName="e2e/src/server/server.spec.ts" %}
import axios from 'axios';

describe('GET /', () => {
  it('should return a message', async () => {
    const res = await axios.get(`/`);

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ message: 'Hello API' });
  });
});

describe('POST /auth', () => {
  it('should return a status and a name', async () => {
    const res = await axios.post(`/auth`, {});

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ success: true, name: 'Cheddar' });
  });
});
```

Now run `npx nx graph` again:

{% graph height="200px" type="project" jsonFile="shared/node-server-tutorial/final-project-graph.json" %}
{% /graph %}

The graph now shows the dependency between `products-api` and `auth`.

The project graph is more than just a visualization - Nx provides tooling to optimize your task-running and even automate your CI based on this graph. This will be covered in more detail in: [4: Task Pipelines](/node-server-tutorial/4-task-pipelines).

## What's Next

- Continue to [3: Task Running](/node-server-tutorial/3-task-running)
