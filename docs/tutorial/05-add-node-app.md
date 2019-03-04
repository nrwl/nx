# Step 5: Add Node Application Implementing API

Using Nx you can develop node applications next to your Angular applications. You can use same commands to run and test them. You can share code between the backend and the frontend. Let's use this capability to implement the API service.

**Run the following to generate a new Node application:**

```bash
ng g node-app api --frontendProject=todos
```

Nx will ask you a few questions, and, as with the Angular application, the defaults will work well here.

After Nx is done installing the required dependencies, you should see something like this:

```treeview
myorg/
├── apps/
│   ├── todos/
│   ├── todos-e2e/
│   └── api/
│       ├── jest.conf.js
│       ├── proxy.conf.json
│       ├── src/
│       │   ├── app/
│       │   │   ├── app.controller.ts
│       │   │   ├── app.controller.spec.ts
│       │   │   ├── app.module.ts
│       │   │   ├── app.service.ts
│       │   │   └── app.service.spec.ts
│       │   ├── assets/
│       │   ├── environments/
│       │   │   ├── environment.ts
│       │   │   └── environment.prod.ts
│       │   └── main.ts
│       ├── tsconfig.app.json
│       ├── tsconfig.json
│       ├── tsconfig.spec.json
│       └── tslint.json
├── libs/
├── nx.json
├── package.json
├── tools/
├── tsconfig.json
└── tslint.json
```

The `apps` directory is where Nx places anything you can run: frontend applications, backend applications, e2e test suites. That's why the `api` application appeared there.

You can run:

- `ng serve api` to serve the application
- `ng build api` to build the application
- `ng test api` to test the application

**Open `apps/api/src/app/app.module.ts`.**

```typescript
import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
```

By default, Nx uses the Nest framework when creating node applications. Nest is heavily inspired by Angular, so the configuration for your backend and your frontend will look similar. Also, a lot of best practices used in Angular can be used in Nest as well.

In this case you have an application that registers a service and a controller. Services in Nest are responsible for the business logic, and controllers are responsible for implementing Http endpoints.

**Update `AppService`:**

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
      title: `New todo ${Math.floor(Math.random() * 1000)}`
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

!!!!!
Run "ng serve api" and open https://localhost:3333/api/todos. What do you see?
!!!!!
`[{"title":"Todo 1"},{"title":"Todo 2"}]`
Blank screen
404
