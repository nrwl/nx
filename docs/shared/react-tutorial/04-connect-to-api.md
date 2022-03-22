# React Nx Tutorial - Step 4: Connect to an API

<iframe loading="lazy" width="560" height="315" src="https://www.youtube.com/embed/HexxYHpIfAo" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe>

Real-world applications do not live in isolation — they need APIs to talk to. Setup your app to talk to an API.

**Let's change our application to fetch the data from the API.**

```typescript
import { useEffect, useState } from 'react';

interface Todo {
  title: string;
}

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

## What's Next

- Continue to [Step 5: Add Node Application Implementing an API](/react-tutorial/05-add-node-app)
