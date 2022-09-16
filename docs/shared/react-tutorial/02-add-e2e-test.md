# React Nx Tutorial - Step 2: Add E2E Tests

{% youtube
src="https://www.youtube.com/embed/3HSzqt3WiVg"
title="Nx.dev Tutorial | React | Step 2: Add E2E Tests"
width="100%" /%}

By default, Nx uses [Cypress](https://cypress.io) to run E2E tests.

Open **`apps/todos-e2e/src/support/app.po.ts`.** It's a page object file that contains helpers for querying the page.

**Add the following two helpers:**

```typescript
export const getTodos = () => cy.get('li.todo');
export const getAddTodoButton = () => cy.get('button#add-todo');
```

**Next, update `apps/todos-e2e/src/e2e/app.cy.ts`.**

```typescript
import { getAddTodoButton, getTodos } from '../support/app.po';

describe('TodoApps', () => {
  beforeEach(() => cy.visit('/'));

  it('should display todos', () => {
    getTodos().should((t) => expect(t.length).equal(2));
    getAddTodoButton().click();
    getTodos().should((t) => expect(t.length).equal(3));
  });
});
```

This is a simple example of an E2E test, only to verify the todos are displayed correctly.

If you have not done so already, stop the `npx nx serve` command and run `npx nx e2e todos-e2e --watch`.

Once the Cypress UI opens, select any browser you want. You'll see the `app.cy.ts` file that you just updated. Click on the file and the test will run. Keep the E2E tests running.

As you progress through the tutorial, you work on making these E2E tests pass.

## What's Next

- Continue to [Step 3: Display Todos](/react-tutorial/03-display-todos)
