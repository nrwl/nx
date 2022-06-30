# Angular Nx Tutorial - Step 5: Add Node Application Implementing an API

{% youtube
src="https://www.youtube.com/embed/SsCx2WErVTI"
title="Nx.dev Tutorial | Angular | Step 5: Add Node Application Implementing API"
width="100%" /%}

The requests fail because the API has not been created yet. Using Nx you can develop node applications next to your Angular applications. You can use same commands to run and test them. You can share code between the backend and the frontend. Use this capability to implement the API service.

## Add NestJS plugin to your workspace

Nx is an extensible framework with plugins for many modern tools and frameworks. **To see some plugins, run `nx list`:**

```bash
>  NX  Installed plugins:

  @angular-devkit/build-angular (builders)
  @nrwl/angular (builders,generators)
  @nrwl/cypress (builders,generators)
  @nrwl/jest (builders,generators)
  @nrwl/linter (builders,generators)
  @nrwl/storybook (builders,generators)
  @nrwl/workspace (builders,generators)


>  NX  Also available:

  @nrwl/express (executors,generators)
  @nrwl/nest (executors,generators)
  @nrwl/next (executors,generators)
  @nrwl/node (executors,generators)
  @nrwl/nx-plugin (executors,generators)
  @nrwl/react (executors,generators)
  @nrwl/web (executors,generators)


>  NX  Community plugins:

  nx-plugins - Nx plugin integrations with ESBuild / Vite / Snowpack / Prisma, with derived ESBuild / Snowpack / ... plugins.
  @codebrew/nx-aws-cdk - An Nx plugin for aws cdk develop.
  @rxap/plugin-localazy - An Nx plugin for localazy.com upload and download tasks.
  ...
```

**Add the dependency:**

```bash
npm install --save-dev @nrwl/nest
```

or

```bash
yarn add --dev @nrwl/nest
```

> `@nrwl/nest` also added `@nrwl/node`. Run `nx list @nrwl/nest` and `nx list @nrwl/node` to see what those plugins provide.

## Create a NestJS application

**Run the following to generate a new Nest application:**

```bash
npx nx g @nrwl/nest:app api --frontendProject=todos
```

Nx asks you a few questions, and, as with the Angular application, the defaults work well here.

After this is done, you should see something like this:

```treeview
myorg/
├── apps/
│   ├── todos/
│   ├── todos-e2e/
│   └── api/
│       ├── src/
│       │   ├── app/
│       │   │   ├── app.controller.ts
│       │   │   ├── app.controller.spec.ts
│       │   │   ├── app.module.ts
│       │   │   ├── app.service.ts
│       │   │   └── app.service.spec.ts
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
├── angular.json
├── nx.json
├── package.json
└── tsconfig.base.json
```

The `apps` directory is where Nx places anything you can run: frontend applications, backend applications, e2e test suites. That's why the `api` application appeared there.

You can run:

- `npx nx serve api` to serve the application
- `npx nx build api` to build the application
- `npx nx test api` to test the application

**Open `apps/api/src/app/app.module.ts`.**

```typescript
import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

We recommend using the [Nest](/nest/overview) framework when creating node applications. Nest is a powerful framework which helps develop robust node applications. You can also use Express or any node libraries with Nx.

In this case you have an application that registers a service and a controller. Services in Nest are responsible for the business logic, and controllers are responsible for implementing Http endpoints.

**Update `apps/api/src/app/app.service.ts`:**

```typescript
import { Injectable } from '@nestjs/common';

interface Todo {
  title: string;
}

@Injectable()
export class AppService {
  todos: Todo[] = [{ title: 'Todo 1' }, { title: 'Todo 2' }];

  getData(): Todo[] {
    return this.todos;
  }

  addTodo() {
    this.todos.push({
      title: `New todo ${Math.floor(Math.random() * 1000)}`,
    });
  }
}
```

**Next, update the controller to invoke the service:**

```typescript
import { Controller, Get, Post } from '@nestjs/common';

import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('todos')
  getData() {
    return this.appService.getData();
  }

  @Post('addTodo')
  addTodo() {
    return this.appService.addTodo();
  }
}
```

In a new terminal window, serve the API.

```bash
npx nx serve api
```

The API starts running on port `3333`.

## What's Next

- Continue to [Step 6: Proxy](/angular-tutorial/06-proxy)
