# React Nx Tutorial - Step 3: Display Todos

<iframe loading="lazy" width="560" height="315" src="https://www.youtube.com/embed/fNehP0WX__c" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe>

Great! You have a failing E2E test. Now you can make it pass!

The best way to work with Cypress is to keep the failing E2E test running while working on the app. This helps you see the progress you are making.

## Show todos

**Open `apps/todos`.**

To make the first assertion of the e2e test pass, update `apps/todos/src/app/app.tsx`:

```typescript
import React, { useState } from 'react';

interface Todo {
  title: string;
}

export const App = () => {
  const [todos, setTodos] = useState<Todo[]>([
    { title: 'Todo 1' },
    { title: 'Todo 2' },
  ]);

  return (
    <>
      <h1>Todos</h1>
      <ul>
        {todos.map((t) => (
          <li className={'todo'}>{t.title}</li>
        ))}
      </ul>
    </>
  );
};

export default App;
```

**Rerun the specs by clicking the button in the top right corner of the left pane.** Now the test fails while trying to find the add todo button.

## Add todos

**Add the `add-todo` button with the corresponding click handler.**

```typescript
import React, { useState } from 'react';

interface Todo {
  title: string;
}

export const App = () => {
  const [todos, setTodos] = useState<Todo[]>([
    { title: 'Todo 1' },
    { title: 'Todo 2' },
  ]);

  function addTodo() {
    setTodos([
      ...todos,
      {
        title: `New todo ${Math.floor(Math.random() * 1000)}`,
      },
    ]);
  }

  return (
    <>
      <h1>Todos</h1>
      <ul>
        {todos.map((t) => (
          <li className={'todo'}>{t.title}</li>
        ))}
      </ul>
      <button id={'add-todo'} onClick={addTodo}>
        Add Todo
      </button>
    </>
  );
};

export default App;
```

The tests should pass now.
