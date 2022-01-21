# Angular Nx Tutorial - Step 8: Create Libs

<iframe loading="lazy" width="560" height="315" src="https://www.youtube.com/embed/szaH7fNw0zg" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe>

Libraries are not just a way to share code in Nx. They are also useful for factoring out code into small units with a well-defined public API.

## Public API

Every library has an `index.ts` file, which defines its public API. Other applications and libraries should only access what the `index.ts` exports. Everything else in the library is private.

## UI libraries

To illustrate how useful libraries can be, create a library of Angular components.

Use the generate to scaffold a new library:

```sh
npx nx g @nrwl/angular:lib ui
```

You should see the following:

```treeview
myorg/
├── apps/
│   ├── todos/
│   ├── todos-e2e/
│   └── api/
├── libs/
│   ├── data/
│   └── ui/
│       ├── src/
│       │   ├── lib/
│       │   │   ├── ui.module.spec.ts
│       │   │   └── ui.module.ts
│       │   └── index.ts
│       ├── .eslintrc
│       ├── jest.conf.js
│       ├── tsconfig.app.json
│       ├── tsconfig.json
│       └── tsconfig.spec.json
├── .eslintrc
├── nx.json
├── package.json
├── tools/
└── tsconfig.base.json
```

The `libs/ui/src/lib/ui.module.ts` file looks like this:

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

@NgModule({
  imports: [CommonModule],
})
export class UiModule {}
```

## Add a component

**Add a component to the newly created ui library by running:**

```bash
npx nx g component todos --project=ui --export
```

```treeview
myorg/
├── apps/
│   ├── todos/
│   ├── todos-e2e/
│   └── api/
├── libs/
│   ├── data/
│   └── ui/
│       ├── src/
│       │   ├── lib/
│       │   │   ├── todos/
│       │   │   │   ├── todos.component.css
│       │   │   │   ├── todos.component.html
│       │   │   │   ├── todos.component.spec.ts
│       │   │   │   └── todos.component.ts
│       │   │   ├── ui.module.spec.ts
│       │   │   └── ui.module.ts
│       │   └── index.ts
│       ├── .eslintrc
│       ├── jest.conf.js
│       ├── tsconfig.app.json
│       ├── tsconfig.json
│       └── tsconfig.spec.json
├── nx.json
├── package.json
├── tools/
└── tsconfig.base.json
```

**Add a `todos` input to `libs/ui/src/lib/todos/todos.component.ts`.**

```typescript
import { Component, OnInit, Input } from '@angular/core';
import { Todo } from '@myorg/data';

@Component({
  selector: 'myorg-todos',
  templateUrl: './todos.component.html',
  styleUrls: ['./todos.component.css'],
})
export class TodosComponent implements OnInit {
  @Input() todos: Todo[] = [];

  constructor() {}

  ngOnInit() {}
}
```

**And update `todos.component.html` to display the given todos:**

```html
<ul>
  <li *ngFor="let t of todos" class="todo">{{ t.title }}</li>
</ul>
```

## Use the UI library

**Now import `UiModule` into `apps/todos/src/app/app.module.ts`.**

```typescript
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { HttpClientModule } from '@angular/common/http';
import { UiModule } from '@myorg/ui';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, HttpClientModule, UiModule],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

**And update `app.component.html`:**

```html
<h1>Todos</h1>

<myorg-todos [todos]="todos"></myorg-todos>

<button (click)="addTodo()">Add Todo</button>
```

Restart the api and application in separate terminal windows

```bash
npx nx serve api
```

```bash
npx nx serve todos
```

## What's Next

- Continue to [Step 9: Using the Project Graph](/angular-tutorial/09-dep-graph)
