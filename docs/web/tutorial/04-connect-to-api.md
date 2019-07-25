# Step 4: Connect to an API

Real-world applications do not live in isolation — they need APIs to talk to. Setup your app to talk to an API.

**Let's change our application to fetch the data from the API.**

```typescript
interface Todo {
  title: string;
}

export class AppElement extends HTMLElement {
  todos: Todo[] = [];

  connectedCallback() {
    this.innerHTML = `
      <h1>Todos</h1>
      <ul></ul>
      <button id="add-todo">Add Todo</button>
    `;

    this.querySelector('#add-todo').addEventListener('click', () => {
      fetch('/api/addTodo', {
        method: 'POST',
        body: ''
      })
        .then(_ => _.json())
        .then(newTodo => {
          this.todos = [...this.todos, newTodo];
          this.renderTodos();
        });
    });

    fetch('/api/todos')
      .then(_ => _.json())
      .then(todos => {
        this.todos = todos;
        this.renderTodos();
      });
  }

  private renderTodos() {
    this.querySelector('ul').innerHTML = this.todos
      .map(t => `<li class="todo">${t.title}</li>`)
      .join('');
  }
}
```

!!!!!
Run "nx serve todos" and open http://localhost:4200. What do you see?
!!!!!
"the server responded with a status of 404 (Not Found)" in Console.
Blank screen.
Exception rendered on the screen.
