---
title: Handling CORS In Your Workspace
slug: handling-cors
authors: [Mike Hartington]
tags: [nx]
cover_image: '/blog/images/2024-11-14/cors.avif'
description: Learn to handle CORS issues in web development, with practical examples and solutions for common challenges.
---

## CORS - The Great Initiation For Web Developers

Are you even a developer if you've never dealt with CORS? Jokes aside, CORS is one of those problems that everyone faces at least once in their life, and if it's your first time, it can be quite frustrating. CORS stands for Cross Origin Resource Sharing, which is a mechanism for allowing what URLs can access other URLs. Meaning if I have `http://site1.com` and I try to access something from `http://site2.com`, I will get an `Access-Control-Allow-Origin` error.

To demonstrate the issue most developers will encounter with CORS, take this example: I have a web server that I'm hosting locally on port 3333. This is a typical REST API that I can make a request to and get a response back:

![REST API returning the data as expected](/blog/images/2024-11-14/status-ok.png)

That's working as expected, but now consider trying to make this request from a different origin. When I try to make my request in my web app, the request will fail:

![REST API blocking the request in the bowser](/blog/images/2024-11-14/status-fail.png)

This is due to CORS restriction that is actually built into our browser. Whenever you make a network request from one location (in this case, our Angular App that is hosted on [http://localhost:4200](http://localhost:4200/)) to a different location (the API hosted at [http://localhost:3333](http://localhost:3333/)), the browser will intercept this request, and if the API hasn't allowed requests from `localhost:4200`, it will block the request.

## Letting The Request Through

Now CORS-related issues can be addressed in multiple ways, and it can be as simple as bypassing CORS all together (the less ideal solution) or configuring a middleware for our dev server to intercept any requests.

> But wait, I thought Nx would do this for me?

In past releases, Nx would provide options in our executors to configure a proxy connection between backend and frontend applications. This still exists for example in our Angular plugin where we are still using executors. However, with our decision to move to a more "optionally opinionated" approach, we now recommend that you use native CLI tools (like vite or webpack) instead of our executors. In this approach, you'd configure the proxy exactly according to how the tool prescribes. Nx doesn't get in your way!

To address this, our two possible solutions could be at the API level, or the framework level.

### Handle The CORS Request On The API

Let's take this very basic Express app that you can get when you run our default Express app generator from `@nx/express`:

```ts {% fileName="main.ts" %}
import express from 'express';
import * as path from 'path';
const app = express();

app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.get('/api', (_req, res) => {
  res.send({ message: 'Welcome to api!' });
});

const port = process.env.PORT || 3333;
const server = app.listen(port, () => {
  console.log(`Listening at <http://localhost>:${port}/api`);
});
server.on('error', console.error);
```

There are two ways we can address CORS in our API. One approach can be to actually set the `Access-Control-Allow-Origin` header in our request:

```ts {% fileName="main.ts" %}
app.get('/api', (_req, res) => {
  res
    .setHeader('Access-Control-Allow-Origin', '*')
    .send({ message: 'Welcome to api!' });
});
```

Or, we can use the `cors` middleware.

```shell
npm install cors @types/cors
```

With `cors` installed, you can import the package and `use` it in your app:

```diff {% fileName="main.ts" %}
  import express from 'express';
  import * as path from 'path';
+ import cors from 'cors'

  const app = express();

+ app.use(cors())

```

By just doing this, any requests made to our Express API will allow all requests, but you can limit it to certain origins by passing in some options to `cors()`

```ts {% fileName="main.ts" %}
app.use(
  cors({
    origin: '<http://example.com>',
  })
);
```

Now, why would you use the `cors` middleware when you could just set the `Access-Control-Allow-Origin` header yourself? The middleware handles a lot of edge cases that you would need to write yourself, and at sub 250 lines of code, it doesn't add too much to your codebase.

### Leave It To The Framework Tools

If you don't have control over the API and are not able to enable CORS, there's still another option for you. Most framework tools have an option to let you pass a proxy file to your dev server. Then any requests made during development can be proxied by the dev server, and you can continue building your app.

For example, in our Angular application, let's create a `proxy.conf.json` in our web project:

```shell
touch apps/web/src/proxy.conf.json
```

In that file, let's add the following:

```json {% fileName="proxy.conf.json" %}
{
  "/api": {
    "target": "http://localhost:3333",
    "secure": false
  }
}
```

Then in our in the `project.json`, let's tell the dev server about this newly created proxy file:

```diff {% fileName="project.json" %}
    "serve": {
      "executor": "@angular-devkit/build-angular:dev-server",
+     "options":{
+       "proxyConfig": "apps/web/src/proxy.conf.json"
+     },
```

With our dev server running, we can simply make requests to `/api` and the request will be allowed.

For frameworks like Vue and React that provide a Vite config, you can inline this right in the config:

```ts {% fileName="vite.config.ts" %}
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3333',
      },
    },
  },
});
```

## Parting Thoughts

With CORS being an ever present issue in many apps, it's important to know how to address it when you run into it. By either addressing it at the API level or with in your app directly, you can make sure that CORS doesn't stop you from shipping your projects.

- [MDM CORS Docs](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
