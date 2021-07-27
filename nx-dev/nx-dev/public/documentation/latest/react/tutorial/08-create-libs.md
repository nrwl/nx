# React Nx Tutorial - Step 8: Create Libs

<iframe width="560" height="315" src="https://www.youtube.com/embed/a1CAYlXizWM" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

Libraries are not just a way to share code in Nx. They are also useful for factoring out code into small units with a well-defined public API.

## Public API

Every library has an `index.ts` file, which defines its public API. Other applications and libraries should only access what the `index.ts` exports. Everything else in the library is private.

## UI libraries

To illustrate how useful libraries can be, create a library of React components.

Run

```bash
npx nx g @nrwl/react:lib ui
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
│       │   │   └── ui/
│       │   │       ├── ui.css
│       │   │       ├── ui.spec.tsx
│       │   │       └── ui.tsx
│       │   └── index.ts
│       ├── jest.conf.js
│       ├── tsconfig.app.json
│       ├── tsconfig.json
│       └── tsconfig.spec.json
├── tools/
├── nx.json
├── package.json
└── tsconfig.base.json
```

The `libs/ui/src/lib/ui.tsx` file looks like this:

```typescript
import React from 'react';

import './ui.css';

export interface UiProps {}

export const Ui = (props: UiProps) => {
  return (
    <div>
      <h1>Welcome to ui!</h1>
    </div>
  );
};

export default Ui;
```

## Add a component

Here, you can either change the UI component or generate a new one.

**Add a component to the newly created ui library by running:**

```bash
npx nx g @nrwl/react:component todos --project=ui --export
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
│       │   │   ├── ui/
│       │   │   │   ├── ui.css
│       │   │   │   ├── ui.spec.tsx
│       │   │   │   └── ui.tsx
│       │   │   └── todos/
│       │   │       ├── todos.css
│       │   │       ├── todos.spec.tsx
│       │   │       └── todos.tsx
│       │   └── index.ts
│       ├── jest.conf.js
│       ├── tsconfig.app.json
│       ├── tsconfig.json
│       └── tsconfig.spec.json
├── tools/
├── workspace.json
├── nx.json
├── package.json
└── tsconfig.base.json
```

**Implement the Todos component.**

```typescript
import React from 'react';
import { Todo } from '@myorg/data';

export const Todos = (props: { todos: Todo[] }) => {
  return (
    <ul>
      {props.todos.map((t) => (
        <li className={'todo'}>{t.title}</li>
      ))}
    </ul>
  );
};

export default Todos;
```

## Use the UI library

**Now import `Todos` into `apps/todos/src/app/app.tsx`.**

```typescript
import React, { useEffect, useState } from 'react';
import { Todo } from '@myorg/data';
import { Todos } from '@myorg/ui';

const App = () => {
  const [todos, setTodos] = useState<Todo[]>([]);

  useEffect(() => {
    fetch('/api/todos')
      .then((_) => _.json())
      .then(setTodos);
  }, []);

  function addTodo() {
    fetch('/api/addTodo', {
      method: 'POST',
      body: '',
    })
      .then((_) => _.json())
      .then((newTodo) => {
        setTodos([...todos, newTodo]);
      });
  }

  return (
    <>
      <h1>Todos</h1>
      <Todos todos={todos} />
      <button id={'add-todo'} onClick={addTodo}>
        Add Todo
      </button>
    </>
  );
};

export default App;
```

**Restart both `npx nx serve api` and `npx nx serve todos` and you should see the application running.**

> Nx helps you explore code generation options. Run `npx nx g @nrwl/react:component --help` to see all options available. Pass `--dry-run` to the command to see what would be generated without actually changing anything, like this: `npx nx g @nrwl/react:component mycmp --project=ui --dry-run`.
