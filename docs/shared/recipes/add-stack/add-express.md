---
title: Add a New Express Project
description: Learn how to create and configure Express applications and libraries in your Nx workspace using the @nx/express plugin.
---

# Add a New Express Project

**Supported Features**

Because we are using an Nx plugin for Express, all the features of Nx are available.

{% pill url="/features/run-tasks" %}✅ Run Tasks{% /pill %}
{% pill url="/features/cache-task-results" %}✅ Cache Task Results{% /pill %}
{% pill url="/ci/features/remote-cache" %}✅ Share Your Cache{% /pill %}
{% pill url="/features/explore-graph" %}✅ Explore the Graph{% /pill %}
{% pill url="/ci/features/distribute-task-execution" %}✅ Distribute Task Execution{% /pill %}
{% pill url="/getting-started/editor-setup" %}✅ Integrate with Editors{% /pill %}
{% pill url="/features/automate-updating-dependencies" %}✅ Automate Updating Nx{% /pill %}
{% pill url="/features/enforce-module-boundaries" %}✅ Enforce Module Boundaries{% /pill %}
{% pill url="/features/generate-code" %}✅ Use Code Generators{% /pill %}
{% pill url="/features/automate-updating-dependencies" %}✅ Automate Updating Framework Dependencies{% /pill %}

## Install the Express Plugin

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/express` version that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

```shell {% skipRescope=true %}
nx add @nx/express
```

## Create an Application

Use the `app` generator to create a new Express app.

```shell
nx g @nx/express:app apps/my-express-api
```

Serve the API by running

```shell
nx serve my-express-api
```

This starts the application on localhost:3333/api by default.

## Create a Library

The `@nx/express` plugin does not have a `library` generator, but we can use the `library` generator from the `@nx/js` plugin. To create a new library, install the `@nx/js` package and run:

```shell
nx g @nx/js:lib libs/my-lib
```

Once the library is created, update the following files.

```typescript {% fileName="libs/my-lib/src/lib/my-lib.ts" %}
export function someFunction(): string {
  return 'some function';
}
```

```typescript {% fileName="apps/my-express-app/src/main.ts" %}
/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import express from 'express';
import * as path from 'path';
import { someFunction } from '@my-express-app/my-lib';

const app = express();

app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.get('/api', (req, res) => {
  res.send({ message: `Welcome to my-express-app! ${someFunction()}` });
});

const port = process.env.PORT || 3333;
const server = app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}/api`);
});
server.on('error', console.error);
```

Now when you serve your API, you'll see the content from the library being displayed.

## More Documentation

- [@nx/express](/technologies/node/express/introduction)
- [@nx/js](/technologies/typescript/introduction)
- [Express](https://expressjs.com/)
