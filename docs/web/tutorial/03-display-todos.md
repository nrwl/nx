# Step 3: Display Todos

Great! You have a failing E2E test. Now you can make it pass!

The best way to work with Cypress is to keep the failing E2E test running while working on the app. This helps you see the progress you are making.

## Show Todos

**Open `apps/todos`.**

To make the first assertion of the e2e test pass, update `apps/todos/src/app/app.element.ts`:

```typescript
interface Todo {
  title: string;
}

export class AppElement extends HTMLElement {
  todos: Todo[] = [{ title: 'Todo 1' }, { title: 'Todo 2' }];

  connectedCallback() {
    this.innerHTML = `
      <h1>Todos</h1>
      <ul></ul>
    `;
    this.renderTodos();
  }

  private renderTodos() {
    this.querySelector('ul').innerHTML = this.todos
      .map(t => `<li class="todo">${t.title}</li>`)
      .join('');
  }
}

customElements.define('myorg-root', AppElement);
```

**Rerun the specs by clicking the button in the top right corner of the left pane.** Now the test will fail while trying to find the add todo button.

## Add Todos

**Add the `add-todo` button with the corresponding click handler.**

```typescript
interface Todo {
  title: string;
}

export class AppElement extends HTMLElement {
  todos: Todo[] = [{ title: 'Todo 1' }, { title: 'Todo 2' }];

  connectedCallback() {
    this.innerHTML = `
      <h1>Todos</h1>
      <ul></ul>
      <button id="add-todo">Add Todo</button>
    `;

    this.querySelector('#add-todo').addEventListener('click', () => {
      this.todos.push({
        title: `New todo ${Math.floor(Math.random() * 1000)}`
      });
      this.renderTodos();
    });
    this.renderTodos();
  }

  private renderTodos() {
    this.querySelector('ul').innerHTML = this.todos
      .map(t => `<li class="todo">${t.title}</li>`)
      .join('');
  }
}

customElements.define('myorg-root', AppElement);
```

The tests should pass now.

!!!!!
What will you see if you run: nx e2e todos-e2e --headless
!!!!!
Cypress will run in the headless mode, and the test will pass.
Cypress will run in the headless mode, and the test will fail.
