# Building Full-Stack Applications using Angular and NestJS

In this guide we will build a full-stack application using Angular and NestJS. 

## Creating Angular Application

Let's start with implementing the frontend. 

The easier way to add a frontend app to an Nx workspace is to run `ng g application frontend`, which will create:

```
apps/
  frontend/
    src/
      app/
      assets/
      environments/
      favicon.ico
      index.html
      main.ts
      polyfills.ts
      styles.css
      test.ts
    browserslist
    jest.conf.js
    tsconfig.json
    tsconfig.app.json
    tsconfig.spec.json
    tslint.json
  frontend-e2e/
    ...
libs/
  ...
tools/
  ...
angular.json
nx.json
package.json
tsconfig.json
tslint.json
```


If you have used the Angular CLI, this should all look familiar: same configuration files, same folders. 

We can run:

* `ng serve frontend` to serve the application
* `ng build frontend` to build the application
* `ng test frontend` to test the application


## Creating Node Application

Real-world applications don’t live in isolation — they need APIs to talk to. 

```typescript
interface Ticket {
  id: number;
  title: string;
}

@Component({
  selector: 'tuskorg-root',
  template: `
    <h1>Tickets</h1>
    <ul>
      <li *ngFor="let t of tickets|async">
        {{ t.title }}
      </li>
    </ul>
  `
})
export class AppComponent {
  tickets: Observable<Ticket[]>;
  
  constructor(http: HttpClient) {
    this.tickets = http.get<Ticket[]>('/api/tickets');
  }
}
```

Next, let's creat the api. We can do it by running `ng g node-application api --frontend-project=frontend` (`--frontend-project=frontend` set ups the proxy configuration such that the frontend application can access the api).

```
apps/
  frontend/
    ...
  frontend-e2e/
    ...
  api/
    src/
      app/ 
        app.module.ts  
        app.controller.ts 
        app.controller.spec.ts  
        app.service.ts
        app.service.spec.ts  
      assets/
        ...  
      environments/
        environment.ts
        environment.prod.ts
      main.ts
    jest.config.js
    tsconfig.json 
    tsconfig.app.json
    tsconfig.spec.json
    tslint.json
    proxy.conf.json
libs/
  ...
tools/
  ...
angular.json
nx.json
package.json
tsconfig.json
tslint.json
```

The `apps` directory is where Nx places anything you can run: frontend applications, backend applications, e2e test suites. That's why the `api` application appeared there. 

By default, Nx will use NestJS when generating node applications. NestJS ia fantastic framework that shares many of its core concepts with Angular. It uses modules, providers, dependency injection, etc.. As a result, most Angular developers find NestJS easy to use.

The generated `apps/api/src/app/app.module.ts` will look like this:

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

> If you prefer `express` or any other node framework, run the following commands instead: `ng g node-application api --framework=express` or `ng g node-application api --framework=none`.

### Implementing Endpoint

To implement our endpoint, let's update `app.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

export interface Ticket {
  id: number;
  title: string;
}

@Injectable()
export class AppService {
  getTodos(): Ticket[] {
    return [
      { id: 1, title: 'Fix my computer!' },
      { id: 2, title: 'Fix my desk' }
    ];
  }
}
```

and `app.controller.ts`

```typescript
import { Controller, Get } from '@nestjs/common';
import { AppService, Ticket } from './app.service';

@Controller('api')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('tickets')
  getTodos(): Ticket[] {
    return this.appService.getTodos();
  }
}
```

Now, let's run `ng serve frontend & ng serve api`, and open `http://localhost:4200`.

![Full Stack Application Screenshot](./full-stack-app.png)

The application works, but we have a small problem. We defined `Ticket` twice: once on the frontend, once on the backend. This duplication will inevitably result in the two interfaces going out of sync, which means that runtime errors will creep in. We need to share this interface.

Normally sharing code between the backend and the frontend would have required days of work, but with Nx, it’s done in just minutes.

## Sharing Libs Between Frontend and Backend

Let's create a new lib by running `ng g library data --framework=none`.

```
apps/
  frontend/
    ...
  frontend-e2e/
    ...
  api/
    ...
libs/
  data/
    src/
      lib/
      index.ts
    jest.config.js
    tsconfig.json 
    tsconfig.lib.json
    tsconfig.spec.json
    tslint.json  
tools/
  ...
angular.json
nx.json
package.json
tsconfig.json
tslint.json
```

Next, let's move `Ticket` into `libs/data/src/index.ts`:

```typescript
export interface Ticket {
  id: number;
  title: string;
}
```

Finally, let's update the frontend and the backend to import the interface from the library.

```typescript
import { Observable } from 'rxjs';
import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Ticket } from '@tuskorg/data';


@Component({
  selector: 'tuskorg-root',
  template: `
    <h1>Ticket</h1>
    <ul>
      <li *ngFor="let t of tickets|async">
        {{ t.title }}
      </li>
    </ul>
  `
})
export class AppComponent {
  tickets: Observable<Ticket[]>;

  constructor(http: HttpClient) {
    this.tickets = http.get<Ticket[]>('/api/tickets');
  }
}
```

```typescript
import { Injectable } from '@nestjs/common';
import { Ticket } from '@tuskorg/data';

@Injectable()
export class AppService {
  getTodos(): Ticket[] {
    return [
      { id: 1, title: 'Fix my computer!' },
      { id: 2, title: 'Fix my desk' }
    ];
  }
}
```

After this refactoring, the backend and the frontend will not get out of sync. Being able to factor code into a lot of small libraries with well-defined public API, which you can then use across both the backend and the frontend, is one of key features of Nx. You can read more about it in [Sharing code and Monorepos](./monorepo.md).



## Nx is Smart

We have already showed something amazing. We have a repository where we can build multiple Angular and Node applications and share code between them. And it took us just a few minutes.

But Nx can do a lot more than that. In Nx, your libraries, node applications, Angular applications are all part of the same dependency graph, which you can see by running `npm run dep-graph`.

![Full Stack Dependencies](./full-stack-deps.png)

 If you change the data library, Nx will know that both the backend and the frontend can be affected by the change. This is what makes Nx a powerful full-stack development environment that scales. You can read more about this Nx capability in [Sharing code and Monorepos](./monorepo.md).
