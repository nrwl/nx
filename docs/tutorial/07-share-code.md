# Step 7: Share Code

There is a problem. Both the backend and the frontend define the `Todo` interface. The interface is in sync now, but in a real application, over time, it will diverge, and, as a result, runtime errors will creep in. You need to share this interface between the backend and the frontend. In Nx, you can do it by creating a library.

**Run the following generator to create a library:**

```bash
ng g lib data
```

**When asked "What framework should this library use?", select `TypeScript`.** The result should look like this:

```treeview
myorg/
├── apps/
│   ├── frontend/
│   ├── frontend-e2e/
│   └── api/
├── libs/
│   └── data/
│       ├── jest.conf.js
│       ├── src/
│       │   ├── lib/
│       │   └── index.ts
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

**Copy the interface into the library's index file.**

```typescript
interface Todo {
  title: string;
}
```

## Update Backend

**Now update `app.service.ts` to import the interface:**

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
      title: `New todo ${Math.floor(Math.random() * 1000)}`
    });
  }
}
```

## Update Frontend

**Next import the interface on the frontend:**

```typescript
import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Todo } from '@myorg/data';

@Component({
  selector: 'myorg-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  todos: Todo[] = [];

  constructor(private http: HttpClient) {
    this.fetch();
  }

  fetch() {
    this.http.get<Todo[]>('/api/todos').subscribe(t => (this.todos = t));
  }

  addTodo() {
    this.http.post('/api/addTodo', {}).subscribe(() => {
      this.fetch();
    });
  }
}
```

Every time you add a new library, you have to restart `ng serve`. **So restart both `ng serve api` and `ng serve todos` and you should see the application running.**

!!!!!
Nx allows you to share code...
!!!!!
Between frontend and backend apps
Between different frontend apps
Between different node apps
