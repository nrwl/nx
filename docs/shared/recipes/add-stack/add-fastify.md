# Add a New Fastify Project

{% youtube
src="https://www.youtube.com/embed/LHLW0b4fr2w"
title="Easy, Modular Node Applications!"
width="100%" /%}

**Supported Features**

Because we are using an Nx plugin for Fastify, all the features of Nx are available.

{% pill url="/features/run-tasks" %}✅ Run Tasks{% /pill %}
{% pill url="/features/cache-task-results" %}✅ Cache Task Results{% /pill %}
{% pill url="/ci/features/remote-cache" %}✅ Share Your Cache{% /pill %}
{% pill url="/features/explore-graph" %}✅ Explore the Graph{% /pill %}
{% pill url="/ci/features/distribute-task-execution" %}✅ Distribute Task Execution{% /pill %}
{% pill url="/features/integrate-with-editors" %}✅ Integrate with Editors{% /pill %}
{% pill url="/features/automate-updating-dependencies" %}✅ Automate Updating Nx{% /pill %}
{% pill url="/features/enforce-module-boundaries" %}✅ Enforce Module Boundaries{% /pill %}
{% pill url="/features/generate-code" %}✅ Use Code Generators{% /pill %}
{% pill url="/features/automate-updating-dependencies" %}✅ Automate Updating Framework Dependencies{% /pill %}

## Create a New Workspace with a Fastify App

If you're starting from scratch, you can use a preset to get you started quickly.

```shell
npx create-nx-workspace@latest --preset=node-monorepo --framework=fastify --appName=fastify-api
```

Then you can skip to the [Create a Library](#create-a-library) section.

If you are adding Fastify to an existing repo, continue to the next section.

## Install the Node Plugin

```shell {% skipRescope=true %}
nx add @nx/node
```

## Create an Application

Use the `app` generator to create a new Fastify app.

{% callout type="note" title="Directory Flag Behavior Changes" %}
The command below uses the `as-provided` directory flag behavior, which is the default in Nx 16.8.0. If you're on an earlier version of Nx or using the `derived` option, omit the `--directory` flag. See the [as-provided vs. derived documentation](/deprecated/as-provided-vs-derived) for more details.
{% /callout %}

```shell
nx g @nx/node:app fastify-api --directory=apps/fastify-api
```

Serve the API by running

```shell
nx serve fastify-api
```

This starts the application on localhost:3000/api by default.

## Create a Library

To create a new library, run:

{% callout type="note" title="Directory Flag Behavior Changes" %}
The command below uses the `as-provided` directory flag behavior, which is the default in Nx 16.8.0. If you're on an earlier version of Nx or using the `derived` option, omit the `--directory` flag. See the [as-provided vs. derived documentation](/deprecated/as-provided-vs-derived) for more details.
{% /callout %}

```shell
nx g @nx/node:lib my-lib --directory=libs/my-lib
```

Once the library is created, update the following files.

```typescript {% fileName="libs/my-lib/src/lib/my-lib.ts" %}
export function someFunction(): string {
  return 'some function';
}
```

```typescript {% fileName="apps/fastify-app/src/app/routes/root.ts" %}
import { someFunction } from '@my-org/my-lib';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export default async function (fastify: FastifyInstance) {
  fastify.get(
    '/',
    async function (request: FastifyRequest, reply: FastifyReply) {
      return { message: 'Hello API ' + someFunction };
    }
  );
}
```

Now when you serve your API, you'll see the content from the library being displayed.

## More Documentation

- [@nx/node](/nx-api/node)
- [Using Mongo with Fastify](/showcase/example-repos/mongo-fastify)
- [Using Redis with Fastify](/showcase/example-repos/redis-fastify)
- [Using Postgres with Fastify](/showcase/example-repos/postgres-fastify)
- [Using PlanetScale with Serverless Fastify](/showcase/example-repos/serverless-fastify-planetscale)
- [Fastify](https://fastify.dev/)
