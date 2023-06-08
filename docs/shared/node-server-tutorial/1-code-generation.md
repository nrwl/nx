---
title: 'Node Server Tutorial - Part 1: Code Generation'
description: In this tutorial you'll create a backend-focused workspace with Nx.
---

{% callout type="check" title="Two Styles of Repo" %}
There are two styles of repos: integrated and package-based. This tutorial shows the integrated style.

You can find more information on the difference between the two in [our introduction](/getting-started/intro).
{% /callout %}

{% youtube
src="https://www.youtube.com/embed/-Oe8j-NZcBc"
title="Tutorial: Node Server"
width="100%" /%}

# Node Server Tutorial - Part 1: Code Generation

In this tutorial you'll create a backend-focused workspace with Nx.

## Contents

- [1 - Code Generation](/node-server-tutorial/1-code-generation)
- [2 - Project Graph](/node-server-tutorial/2-project-graph)
- [3 - Task Running](/node-server-tutorial/3-task-running)
- [4 - Task Pipelines](/node-server-tutorial/4-task-pipelines)
- [5 - Docker Target](/node-server-tutorial/5-docker-target)
- [6 - Summary](/node-server-tutorial/6-summary)

## Your Objective

For this tutorial, you'll create an Express API application, a library that the API can reference to handle authentication and a suite of e2e tests.

## Creating an Nx Workspace

Run the command `npx create-nx-workspace@latest` and when prompted, provide the following responses:

```{% command="npx create-nx-workspace@latest" path="~" %}

 >  NX   Let's create a new workspace [https://nx.dev/getting-started/intro]

✔ Where would you like to create your workspace? · products-api
✔ Which stack do you want to use? · node
✔ What framework should be used? · express
✔ Standalone project or integrated monorepo? · standalone
✔ Would you like to generate a Dockerfile? [https://docs.docker.com/] · Yes
✔ Enable distributed caching to make your CI faster · Yes
```

{% card title="Opting into Nx Cloud" description="You will also be prompted whether to add Nx Cloud to your workspace. We won't address this in this tutorial, but you can see the introduction to Nx Cloud for more details." url="/nx-cloud/intro/what-is-nx-cloud" /%}

The `node-standalone` preset automatically creates a `products-api` application at the root of the workspace and an `e2e` project that runs against it.

{% callout type="note" title="Framework Options" %}
This tutorial uses the `express` framework. The `node-standalone` preset also provides starter files for `koa` and `fastify`. For other frameworks, you can choose `none` and add a it yourself.
{% /callout %}

## Generating Libraries

To create the `auth` library, use the `@nx/node:lib` generator:

![Nx Generator Syntax](/shared/node-server-tutorial/generator-syntax.svg)

```{% command="npx nx g @nx/node:lib auth --buildable" path="~/products-api" %}
>  NX  Generating @nx/node:library

CREATE auth/README.md
CREATE auth/.babelrc
CREATE auth/package.json
CREATE auth/src/index.ts
CREATE auth/src/lib/auth.spec.ts
CREATE auth/src/lib/auth.ts
CREATE auth/tsconfig.json
CREATE auth/tsconfig.lib.json
UPDATE tsconfig.json
UPDATE package.json
CREATE auth/project.json
CREATE .eslintrc.base.json
UPDATE .eslintrc.json
UPDATE e2e/.eslintrc.json
CREATE auth/.eslintrc.json
CREATE jest.config.app.ts
UPDATE jest.config.ts
UPDATE project.json
CREATE auth/jest.config.ts
CREATE auth/tsconfig.spec.json
```

You have now created three projects:

- `products-api` in `/`
- `e2e` in `/e2e`
- `auth` in `/auth`

## What's Next

- Continue to [2: Project Graph](/node-server-tutorial/2-project-graph)
