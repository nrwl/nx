# Node Standalone Tutorial - Part 2: Project Graph

Run the command: `npx nx graph`. A browser should open up with the following contents:

{% graph height="200px" type="project" jsonFile="shared/node-tutorial/initial-project-graph.json" %}
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

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = express();

app.get('/', (req, res) => {
  res.send({ message: 'Hello API' });
});

app.post('/auth', (req, res) => {
  res.send({ success: true, name: 'Cheddar' });
});

app.listen(port, () => {
  console.log(`[ ready ] http://localhost:${port}`);
});
```

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

{% graph height="200px" type="project" jsonFile="shared/node-tutorial/final-project-graph.json" %}
{% /graph %}

The graph now shows the dependency between `products-api` and `auth`.

The project graph is more than just a visualization - Nx provides tooling to optimize your task-running and even automate your CI based on this graph. This will be covered in more detail in: [4: Task Pipelines](/node-tutorial/4-task-pipelines).

## What's Next

- Continue to [3: Task Running](/node-tutorial/3-task-running)
