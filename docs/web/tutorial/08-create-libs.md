# Step 8: Create Libs

Libraries are not just a way to share code in Nx. They are also useful for factoring out code into small units with a well-defined public API.

## Public API

Every library has an `index.ts` file, which defines its public API. Other applications and libraries should only access what the `index.ts` exports. Everything else in the library is private.

## UI Libraries

To illustrate how useful libraries can be, create a library of Web components.

**Run `nx g @nrwl/workspace:lib ui`.**

You should see the following:

```treeview
myorg/
├── apps/
│   ├── todos/
│   ├── todos-e2e/
│   └── api/
├── libs/
│   ├── data/
│   └── ui/
│       ├── src/
│       │   ├── lib/
│       │   │   └── ui.ts
│       │   └── index.ts
│       ├── jest.conf.js
│       ├── tsconfig.app.json
│       ├── tsconfig.json
│       └── tsconfig.spec.json
├── tools/
├── workspace.json
├── nx.json
├── package.json
└── tsconfig.json
```

## Add a Component

**Add a component to the newly created ui library by running:**

```typescript
import { Todo } from '@myorg/data';

export class TodosElement extends HTMLElement {
  _todos: Todo[] = [];

  set todos(todos: Todo[]) {
    this._todos = todos;
    this.renderTodos();
  }

  connectedCallback() {
    this.renderTodos();
  }

  private renderTodos() {
    this.innerHTML = `<ul>${this._todos
      .map(t => `<li class="todo">${t.title}</li>`)
      .join('')}</ul>`;
  }
}

customElements.define('myorg-todos', TodosElement);
```

## Use the UI Library

**First, import `Todos` into `apps/todos/src/app/main.ts`.**

```typescript
import '@myorg/ui';
import './app/app.element.ts';
```

**Now update `apps/todos/src/app/app.element.ts`.**

```typescript
interface Todo {
  title: string;
}

export class AppElement extends HTMLElement {
  // ...

  connectedCallback() {
    this.innerHTML = `
      <h1>Todos</h1>
      <myorg-todos></myorg-todos>
      <button id="add-todo">Add Todo</button>
    `;
    //...
  }

  private renderTodos() {
    (this.querySelector('myorg-todos') as TodosElement).todos = this.todos;
  }
}

customElements.define('myorg-root', AppElement);
```

**Restart both `nx serve api` and `nx serve todos` and you should see the application running.**

!!!!!
Libraries' public API is defined in...
!!!!!
index.ts
workspace.json and tsconfig.json files
