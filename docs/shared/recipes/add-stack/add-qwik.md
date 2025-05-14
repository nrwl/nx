---
title: Add a New Qwik Project
description: Learn how to integrate Qwik with Nx using the qwik-nx plugin, including creating applications, libraries, and leveraging Nx features.
---

# Add a New Qwik Project

The code for this example is available on GitHub:

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/qwik" /%}

**Supported Features**

We'll be using an Nx Plugin for Qwik called [qwik-nx](https://github.com/qwikifiers/qwik-nx).

{% pill url="/features/run-tasks" %}✅ Run Tasks{% /pill %}
{% pill url="/features/cache-task-results" %}✅ Cache Task Results{% /pill %}
{% pill url="/ci/features/remote-cache" %}✅ Share Your Cache{% /pill %}
{% pill url="/features/explore-graph" %}✅ Explore the Graph{% /pill %}
{% pill url="/ci/features/distribute-task-execution" %}✅ Distribute Task Execution{% /pill %}
{% pill url="/getting-started/editor-setup" %}✅ Integrate with Editors{% /pill %}
{% pill url="/features/automate-updating-dependencies" %}✅ Automate Updating Nx{% /pill %}
{% pill url="/features/enforce-module-boundaries" %}✅ Enforce Module Boundaries{% /pill %}
{% pill url="/features/generate-code" %}✅ Use Code Generators{% /pill %}
{% pill url="/features/automate-updating-dependencies" %}✅ Automate Updating Framework Dependencies{% /pill %}

## Install the qwik-nx Plugin

Install the `qwik-nx` plugin:

{% tabs %}
{%tab label="npm"%}

```shell
npm add -D qwik-nx
```

{% /tab %}
{%tab label="yarn"%}

```shell
yarn add -D qwik-nx
```

{% /tab %}
{%tab label="pnpm"%}

```shell
pnpm add -D qwik-nx
```

{% /tab %}

{% tab label="bun" %}

```shell
bun add -D qwik-nx
```

{% /tab %}
{% /tabs %}

{% callout type="note" title="Nx Version Compatibility" %}
You can find a compatibility matrix for `qwik-nx`
here: https://github.com/qwikifiers/qwik-nx#qwik-nx--nx-compatibility-chart.  
You can use this to help you understand which version of `qwik-nx` you should install based on the version of `nx` you
are currently using.  
If you need help finding the version of `nx` you are currently using, run `nx report`.
{% /callout %}

## Create the application

Let's generate a new application using `qwik-nx`.

```shell
nx g qwik-nx:app todo --directory=apps/todo
```

## Create a library

Let's generate a new library using `qwik-nx`.

```shell
nx g qwik-nx:lib data-access --directory=libs/data-access
```

## Create a Context in the library

We'll add a `Context` to the library to store some state.

Create a new file `libs/data-access/src/lib/todo.context.tsx` with the following content:

```tsx
import {
  component$,
  createContextId,
  Slot,
  useContextProvider,
  useStore,
} from '@builder.io/qwik';

export interface Todo {
  id: number;
  message: string;
}

interface TodoStore {
  todos: Todo[];
  lastId: number;
}

export const TodoContext = createContextId<TodoStore>('todo.context');

export const TodoContextProvider = component$(() => {
  const todoStore = useStore<TodoStore>({
    todos: [],
    lastId: 0,
  });

  useContextProvider(TodoContext, todoStore);

  return <Slot />;
});
```

We'll use this context to store the state for our application.

Let's create a new file to handle some of the logic for our application.

Create `libs/data-access/src/lib/todo.ts` and add the following:

```ts
import { Todo } from './todo.context';

// A rudimentary in-mem DB that will run on the server
interface DB {
  store: Record<string, any[]>;
  get: (storeName: string) => any[];
  set: (storeName: string, value: any[]) => boolean;
  add: (storeName: string, value: any) => boolean;
}

export const db: DB = {
  store: { todos: [] },
  get(storeName) {
    return db.store[storeName];
  },
  set(storeName, value) {
    try {
      db.store[storeName] = value;
      return true;
    } catch (e) {
      return false;
    }
  },
  add(storeName, value) {
    try {
      db.store[storeName].push(value);
      return true;
    } catch (e) {
      return false;
    }
  },
};

export function getTodos() {
  // A network request or db connection could be made here to fetch persisted todos
  // For illustrative purposes, we're going to seed a rudimentary in-memory DB if it hasn't been already
  // Then return the value from it
  if (db.get('todos')?.length === 0) {
    db.set('todos', [
      {
        id: 1,
        message: 'First todo',
      },
    ]);
  }
  const todos: Todo[] = db.get('todos');
  const lastId = [...todos].sort((a, b) => b.id - a.id)[0].id;
  return { todos, lastId };
}

export function addTodo(todo: { id: string; message: string }) {
  const success = db.add('todos', {
    id: parseInt(todo.id),
    message: todo.message,
  });
  return { success };
}
```

Update `libs/data-access/src/index.ts` to export our new context and methods:

```ts
export * from './lib/todo.context';
export * from './lib/todo';
```

## Generate a Route

Next, let's generate a route to store the logic for the application.

```shell
nx g qwik-nx:route --name=todo --project=todo
```

We will use our new context
Update the new route file (`apps/todo/src/routes/todo/index.tsx`) to the following:

```tsx
import { component$, useContext, useTask$ } from '@builder.io/qwik';
import {
  Form,
  routeAction$,
  routeLoader$,
  z,
  zod$,
} from '@builder.io/qwik-city';
import { addTodo, getTodos, TodoContext } from '@acme/data-access';

export const useGetTodos = routeLoader$(() => getTodos());

export const useAddTodo = routeAction$(
  (todo) => addTodo(todo),
  zod$({ id: z.string(), message: z.string() })
);

export default component$(() => {
  const todoStore = useContext(TodoContext);
  const persistedTodos = useGetTodos();
  const addTodoAction = useAddTodo();

  useTask$(({ track }) => {
    track(() => persistedTodos.value);
    if (persistedTodos.value) {
      todoStore.todos = persistedTodos.value.todos;
      todoStore.lastId =
        todoStore.lastId > persistedTodos.value.lastId
          ? todoStore.lastId
          : persistedTodos.value.lastId;
    }
  });

  return (
    <div>
      <h1>Todos</h1>
      {todoStore.todos.map((t) => (
        <div key={`todo-${t.id}`}>
          <label>
            <input type="checkbox" /> {t.message}
          </label>
        </div>
      ))}
      <Form action={addTodoAction}>
        <input type="hidden" name="id" value={todoStore.lastId + 1} />
        <input type="text" name="message" />
        <button type="submit">Add</button>
      </Form>
      {addTodoAction.value?.success && <p>Todo added!</p>}
    </div>
  );
});
```

## Build and Serve the Application

To serve the application, run the following command and then navigate your browser to `http://localhost:4200/todo`

```shell
nx serve todo
```

To build the application, run the following command:

```shell
nx build todo
```

## More Documentation

- [Qwik](https://qwik.builder.io)
- [qwik-nx](https://github.com/qwikifiers/qwik-nx)
