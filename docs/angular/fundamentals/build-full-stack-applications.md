# Building Full-Stack Applications

In this guide you will:

- Build a full-stack application using [Angular](https://angular.io) and [Nest](https://nestjs.com).
- Share code between frontend and backend

## Creating an empty workspace

Start with creating a new workspace with the following:

```bash
npx create-nx-workspace@latest myorg
cd myorg
```

## Creating a Frontend Application

Now, create a frontend application using Angular with:

```bash
ng add @nrwl/angular # Add Angular Capabilities to the workspace
ng g @nrwl/angular:application frontend # Create an Angular Application
```

This will create the following:

```treeview
myorg/
├── apps/
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── app.component.html
│   │   │   │   ├── app.component.scss
│   │   │   │   ├── app.component.spec.ts
│   │   │   │   ├── app.component.ts
│   │   │   │   ├── app.module.ts
│   │   │   ├── assets/
│   │   │   ├── environments/
│   │   │   ├── favicon.ico
│   │   │   ├── index.html
│   │   │   ├── main.ts
│   │   │   ├── polyfills.ts
│   │   │   ├── styles.scss
│   │   │   └── test.ts
│   │   ├── browserslist
│   │   ├── jest.config.js
│   │   ├── tsconfig.app.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.spec.json
│   │   └── tslint.json
│   └── frontend-e2e/
├── README.md
├── libs/
├── tools/
├── angular.json
├── nx.json
├── package.json
├── tsconfig.json
└── tslint.json
```

If you have used the [Angular CLI](https://cli.angular.io), this should all look familiar: same configuration files, same folders.

You can run:

- `ng serve frontend` to serve the application
- `ng build frontend` to build the application
- `ng test frontend` to test the application

## Creating a Node Application

Real-world applications do not live in isolation — they need APIs to talk to. Setup your frontend application to fetch some todos.

Add `HttpClientModule` to `apps/frontend/src/app/app.module.ts`:

```typescript
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, HttpClientModule],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
```

Edit `apps/frontend/src/app/app.component.ts` to fetch Todos from a Todos API:

```typescript
import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';

interface Todo {
  title: string;
}

@Component({
  selector: 'myorg-root',
  template: `
    <h1>Todos</h1>
    <ul>
      <li *ngFor="let t of todos | async">{{ t.title }}</li>
    </ul>
  `
})
export class AppComponent {
  todos: Observable<Todo[]>;

  constructor(http: HttpClient) {
    this.todos = http.get<Todo[]>('/api/todos');
  }
}
```

No todos will show up yet because the API does not exist. So the next step is to create the api using Nest.

Create a Nest Application similar to how you created the Angular application earlier:

```bash
ng add @nrwl/nest # Add Node Capabilities to the workspace
ng g @nrwl/nest:application api --frontend-project frontend # sets up the proxy configuration so you can access the API in development
```

This will create the following:

```treeview
myorg/
├── apps/
│   ├── frontend/
│   ├── frontend-e2e/
│   └── api/
│       ├── src/
│       │   ├── app/
│       │   │   ├── app.controller.spec.ts
│       │   │   ├── app.controller.ts
│       │   │   ├── app.module.ts
│       │   │   ├── app.service.spec.ts
│       │   │   ├── app.service.ts
│       │   ├── assets/
│       │   ├── environments/
│       │   └── main.ts
│       ├── jest.config.js
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

The `apps` directory is where Nx places anything you can run: frontend applications, backend applications, e2e test suites. That is why the `api` application was generated there.

You can run:

- `ng serve api` to serve the application
- `ng build api` to build the application
- `ng test api` to test the application

We recommend using Nest when generating node applications. Nest is a fantastic framework that shares many of its core concepts with Angular. It uses modules, providers, dependency injection, etc.. As a result, most Angular developers find Nest easy to use.

The generated `apps/api/src/app/app.module.ts` will look like this:

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

> If you prefer `express`, run the following commands instead:

```
ng add @nrwl/express # Add Express Capabilities to the workspace
ng g @nrwl/express:application api --frontend-project frontend
```

### Adding an Endpoint

Now, add an endpoint to get todos by updating `app.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

export interface Todo {
  title: string;
}

@Injectable()
export class AppService {
  getTodos(): Todo[] {
    return [{ title: 'Fix my computer!' }, { title: 'Fix my desk' }];
  }
}
```

and `app.controller.ts`

```typescript
import { Controller, Get } from '@nestjs/common';

import { AppService, Todo } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('todos')
  getTodos(): Todo[] {
    return this.appService.getTodos();
  }
}
```

Now, run `ng serve frontend & ng serve api`, and open [http://localhost:4200](http://localhost:4200) to see both the frontend and backend working:

![Full Stack Application Screenshot](./full-stack-app.png)

The application works, but you have a small problem. The `Todo` interface is defined twice: once on the frontend, once on the backend. This duplication will inevitably result in the two interfaces going out of sync, which means that runtime errors will creep in. It's better to share this interface.

## Sharing Code Between Frontend and Backend

Normally sharing code between the backend and the frontend would have required days of work, but with Nx, it’s done in just minutes. In Nx, code is shared by creating libraries. Because everything is in a single repository, libraries can be imported without having to publish them to a registry.

Create a new library via:

```bash
ng g @nrwl/workspace:library data # This generates a barebone library with only Typescript setup
```

```treeview
<workspace name>/
├── apps/
│   ├── frontend/
│   ├── frontend-e2e/
│   └── api/
├── libs/
│   └── data/
│       ├── src/
│       │   ├── lib/
│       │   │   └── data.ts
│       │   └── index.ts
│       ├── jest.config.js
│       ├── tsconfig.app.json
│       ├── tsconfig.json
│       ├── tsconfig.spec.json
│       └── tslint.json
├── nx.json
├── package.json
├── tools/
├── tsconfig.json
└── tslint.json
```

Next, move `Todo` into `libs/data/src/lib/data.ts`:

```typescript
export interface Todo {
  title: string;
}
```

Finally, update the frontend and the backend to import the interface from the library.

Update `apps/frontend/src/app/app.component.ts`:

```typescript
import { Observable } from 'rxjs';
import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Todo } from '@myorg/data';

@Component({
  selector: 'myorg-root',
  template: `
    <h1>Todos</h1>
    <ul>
      <li *ngFor="let t of todos | async">{{ t.title }}</li>
    </ul>
  `
})
export class AppComponent {
  todos: Observable<Todo[]>;

  constructor(http: HttpClient) {
    this.todos = http.get<Todo[]>('/api/todos');
  }
}
```

Update `apps/api/src/app/app.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { Todo } from '@myorg/data';

@Injectable()
export class AppService {
  getTodos(): Todo[] {
    return [{ title: 'Fix my computer!' }, { title: 'Fix my desk' }];
  }
}
```

Update `apps/api/src/app/app.controller.ts`:

```typescript
import { Controller, Get } from '@nestjs/common';

import { Todo } from '@myorg/data';

import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('todos')
  getTodos(): Todo[] {
    return this.appService.getTodos();
  }
}
```

After this refactor, the backend and the frontend will share the same definition of `Todo` and never get out of sync. Being able to factor code into a lot of small libraries with a well-defined public API, which you can then use across both the backend and the frontend, is a key feature of Nx. You can read more about it in our [Develop like Google Guide](/angular/fundamentals/monorepos-automation).

## Nx is Smart

Having both frontend and backend code is already something amazing. In just minutes, You have a repository which can build multiple frontend and backend applications and share code between them.

But Nx can do a lot more than that. In Nx, your libraries, backend applications, frontend applications are all part of the same dependency graph, which you can see via:

```bash
nx dep-graph
```

![Full Stack Dependencies](./full-stack-deps.png)

If you change the data library, Nx will know that both the backend and the frontend can be affected by the change. This information can be used to test and build all areas affected by a change making Nx a powerful full-stack development environment that scales. You can read more about this Nx capability in [Building Like Google](/angular/fundamentals/monorepos-automation).

## Summary

With Nx, you can:

- Build full stack applications
- Share code between backend and frontend
- Scale your workspace by understanding how the backend and frontend depend on each other and using this information to only retest/rebuilt only what is affected.
