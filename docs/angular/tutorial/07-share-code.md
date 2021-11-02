# Angular Nx Tutorial - Step 7: Share Code

<iframe width="560" height="315" src="https://www.youtube.com/embed/icyOSQ6gAm0" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

Awesome! The application is working end to end! However, there is a problem. Both the backend and the frontend define the `Todo` interface. The interface is in sync now, but in a real application, over time, it will diverge, and, as a result, runtime errors will creep in. You should share this interface between the backend and the frontend. In Nx, you can do this by creating a library.

**Run the following command to create a library:**

```bash
npx nx g @nrwl/workspace:lib data
```

The result should look like this:

```treeview
myorg/
├── apps/
│   ├── todos/
│   ├── todos-e2e/
│   └── api/
├── libs/
│   └── data/
│       ├── src/
│       │   ├── lib/
│       │   │   └── data.ts
│       │   └── index.ts
│       ├── .eslintrc
│       ├── jest.config.js
│       ├── tsconfig.app.json
│       ├── tsconfig.json
│       └── tsconfig.spec.json
├── workspace.json
├── nx.json
├── package.json
├── tools/
└── tsconfig.base.json
```

**Copy the interface into `libs/data/src/lib/data.ts`.**

```typescript
export interface Todo {
  title: string;
}
```

### A note about VS Code :

If you're using [VS Code](https://code.visualstudio.com/) it may be necessary at this point to restart the TS server so that the new `@myorg/data` package is recognized. This may need to be done **every time a new workspace library is added**.

## Refactor the API

**Now update `apps/api/src/app/app.service.ts` to import the interface:**

```typescript
import { Injectable } from '@nestjs/common';
import { Todo } from '@myorg/data';

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

## Update the Angular application

**Next import the interface in `apps/todos/src/app/app.component.ts`:**

```typescript
import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Todo } from '@myorg/data';

@Component({
  selector: 'myorg-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  todos: Todo[] = [];

  constructor(private http: HttpClient) {
    this.fetch();
  }

  fetch() {
    this.http.get<Todo[]>('/api/todos').subscribe((t) => (this.todos = t));
  }

  addTodo() {
    this.http.post('/api/addTodo', {}).subscribe(() => {
      this.fetch();
    });
  }
}
```

> Every time you add a new library, you have to restart `npx nx serve`.

Restart the api and application in separate terminal windows

```bash
npx nx serve api
```

```bash
npx nx serve todos
```

And you should see the application running.

## What's Next

- Continue to [Step 8: Create Libraries](/latest/angular/tutorial/08-create-libs)
