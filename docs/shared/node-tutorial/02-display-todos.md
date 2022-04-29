# Node Nx Tutorial - Step 2: Display todos

<iframe loading="lazy" width="560" height="315" src="https://www.youtube.com/embed/I4-sO2LeVbU" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe>

Great! you now have a server application set up to show some data when going to the `/api` route.

Next, you're going to add a new service, and set up some server side templates.

## Creating a todos service

With Nx, you have the ability to scaffold out new code for your application. Create a Todos service and populate some todos!

**Run `nx generate @nrwl/nest:service todo --project todos --directory app` to generate our new service**

```bash
$ nx generate @nrwl/nest:service todos --project todos --directory app
CREATE apps/todos/src/app/todos/todos.service.spec.ts (453 bytes)
CREATE apps/todos/src/app/todos/todos.service.ts (89 bytes)
UPDATE apps/todos/src/app/app.module.ts (318 bytes)
```

> Services are not the only things that the `@nrwl/nest` plugin can create. Run `nx list @nrwl/nest` to see other capabilities that the plugin provides.

Open the newly created file in `apps/todos/src/app/todos/todos.service.ts` and paste the following code:

```typescript
import { Injectable } from '@nestjs/common';

export type Todo = {
  message: string;
  done: boolean;
};

const todos: Todo[] = [
  { message: 'Take out trash', done: false },
  { message: 'Continue using Nx', done: false },
];

@Injectable()
export class TodosService {
  getTodos(): Todo[] {
    return todos;
  }
}
```

> Usually services should call some kind of data source (like a database or even a file) but for this tutorial, just populate todos manually.

You now have your Todos service ready!

## Install template engine

In order to render some views, you need to install a template engine:

```bash
yarn add hbs
```

or

```bash
npm install --save hbs
```

Once the installation process is complete, you need to configure the `main.ts` file with the following code:

```typescript
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setBaseViewsDir(join(__dirname, 'assets', 'views'));
  app.setViewEngine('hbs');

  const port = process.env.PORT || 3333;
  await app.listen(port, () => {
    Logger.log('Listening at http://localhost:' + port);
  });
}

bootstrap();
```

You added configuration for setting up the view engine, and removed the `globalPrefix` option.

## Template rendering

Under the `assets` directory of the todo's project, you create a `views` directory with an `index.hbs` file inside with the following content:

```handlebars
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>App</title>
  </head>

  <body>
    <ul class="todos">
      {{#each todos}}
      <li><input type="checkbox" {{#if done}}checked{{/if}} /> {{message}}</li>
      {{/each}}
    </ul>
  </body>
</html>
```

Next, update the `app.controller.ts` file with the following:

```typescript
import { Controller, Get, Render } from '@nestjs/common';

import { AppService } from './app.service';
import { TodosService } from './todos/todos.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private todosService: TodosService
  ) {}

  @Get('api')
  getData() {
    return this.todosService.getTodos();
  }

  @Get()
  @Render('index')
  root() {
    return {
      todos: this.getData(),
    };
  }
}
```

You changed the `@Get` decorator for the `getData` function to point to the `api` route. You also changed this to call the `todosService.getTodos()` method. \
Then you added the `root` function which renders the `index` file from our `views` directory.

> The serve process should still be running. If it isn't, restart the process with `nx serve todos`

## What's Next

- Continue to [Step 3: Share code](/node-tutorial/03-share-code)
