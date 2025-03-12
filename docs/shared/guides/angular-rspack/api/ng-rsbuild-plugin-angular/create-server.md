---
title: 'createServer - @ng-rsbuild/plugin-angular/ssr'
description: 'API Reference for createServer from @ng-rsbuild/plugin-angular/ssr'
---

# createServer

```bash
import { createServer } from '@ng-rsbuild/plugin-angular/ssr';
```

The `createServer` function is used to setup Angular's `CommonEngine` using an `express` server. It takes the bootstrap function as an argument, which is the function that bootstraps the Angular server application. This is usually` main.server.ts`. It returns `RsbuildAngularServer` which contains the server instance to allow further modifications as well as the listen method to start the server.

```ts
function createServer(bootstrap: any): RsbuildAngularServer;
```

---

## Examples

{% tabs %}
{% tab label="Standard Express Server Usage" %}
The following example shows how to create a standard express server:

```ts {% fileName="myapp/src/server.ts" %}
import { createServer } from '@ng-rsbuild/plugin-angular/ssr';
import bootstrap from './main.server';

const server = createServer(bootstrap);

/** Add your custom server logic here
 *
 * For example, you can add a custom static file server:
 *
 * server.app.use('/static', express.static(staticFolder));
 *
 * Or add additional api routes:
 *
 * server.app.get('/api/hello', (req, res) => {
 *   res.send('Hello World!');
 * });
 *
 * Or add additional middleware:
 *
 * server.app.use((req, res, next) => {
 *   res.send('Hello World!');
 * });
 */

server.listen();
```

{% /tab %}
{% /tabs %}

---

## RsbuildAngularServer

```ts
export interface RsbuildAngularServer {
  app: express.Express;
  listen: (port?: number) => void;
}
```

---

### `app`

`express.Express`
The express application instance.

### `listen`

`(port?: number) => void`
Starts the express application on the specified port. If no port is provided, the default port (4000) is used.
