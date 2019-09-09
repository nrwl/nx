# Using DataPersistence

Managing state is a hard problem. We need to coordinate multiple backends, web workers, and UI components, all of which update the state concurrently.

What should we store in memory and what in the URL? What about the local UI state? How do we synchronize the persistent state, the URL, and the state on the server? All these questions have to be answered when designing the state management of our applications. **Nx** Data Persistence is a set of helper functions that enables the developer to manage state with an intentional synchronization strategy and handle error state. Check out the [Managing State in Angular Applications using NgRx](https://blog.nrwl.io/using-ngrx-4-to-manage-state-in-angular-applications-64e7a1f84b7b) for more detailed example of the state problem Data Persistence is solving.

## Optimistic Updates

For a better user experience, `optimisticUpdate` method updates the state on the client application first, before updating the data on the server-side. While it addresses fetching data in order, removing the race conditions and handling error, it is optimistic about not failing to update the server. In case of a failure, when using `optimisticUpdate`, the local state on the client is already updated. The developer must provide an undo action to restore the previous state to keep it consistent with the server state. The error handling must be done in the callback, or by means of the undo action.

```typescript
import { DataPersistence } from '@nrwl/angular';

class TodoEffects {
  @Effect() updateTodo = this.s.optimisticUpdate('UPDATE_TODO', {
    // provides an action and the current state of the store
    run: (a: UpdateTodo, state: TodosState) => {
      return this.backend(state.user, a.payload);
    },

    undoAction: (a: UpdateTodo, e: any) => {
      // dispatch an undo action to undo the changes in the client state
      return {
        type: 'UNDO_UPDATE_TODO',
        payload: a
      };
    }
  });

  constructor(
    private s: DataPersistence<TodosState>,
    private backend: Backend
  ) {}
}
```

## Pessimistic Updates

To achieve a more reliable data synchronization, `pessimisticUpdate` method updates the server data first. When the change is reflected in the server state, changes the client state by dispatching an action. `pessimisticUpdate` method enforces the order of the fetches and error handling.

```typescript
import { DataPersistence } from '@nrwl/angular';

@Injectable()
class TodoEffects {
  @Effect() updateTodo = this.s.pessimisticUpdate('UPDATE_TODO', {
    // provides an action and the current state of the store
    run: (a: UpdateTodo, state: TodosState) => {
      // update the backend first, and then dispatch an action that will
      // update the client side
      return this.backend(state.user, a.payload).map(updated => ({
        type: 'TODO_UPDATED',
        payload: updated
      }));
    },

    onError: (a: UpdateTodo, e: any) => {
      // we don't need to undo the changes on the client side.
      // we can dispatch an error, or simply log the error here and return `null`
      return null;
    }
  });

  constructor(
    private s: DataPersistence<TodosState>,
    private backend: Backend
  ) {}
}
```

## Data Fetching

DataPersistence's fetch method provides consistency when fetching data. If there are multiple requests scheduled for the same action, it will only run the last one.

```typescript
import { DataPersistence } from '@nrwl/angular';

@Injectable()
class TodoEffects {
  @Effect() loadTodos = this.s.fetch('GET_TODOS', {
    // provides an action and the current state of the store
    run: (a: GetTodos, state: TodosState) => {
      return this.backend(state.user, a.payload).map(r => ({
        type: 'TODOS',
        payload: r
      }));
    },

    onError: (a: GetTodos, e: any) => {
      // dispatch an undo action to undo the changes in the client state
      return null;
    }
  });

  constructor(
    private s: DataPersistence<TodosState>,
    private backend: Backend
  ) {}
}
```

This is correct, but we can improve the performance by supplying and id of the data by using an accessor function and adding concurrency to the fetch action for different ToDo's.

```typescript
@Injectable()
class TodoEffects {
  @Effect()
  loadTodo = this.s.fetch('GET_TODO', {
    id: (a: GetTodo, state: TodosState) => {
      return a.payload.id;
    },

    // provides an action and the current state of the store
    run: (a: GetTodo, state: TodosState) => {
      return this.backend(state.user, a.payload).map(r => ({
        type: 'TODO',
        payload: r
      }));
    },

    onError: (a: GetTodo, e: any) => {
      // dispatch an undo action to undo the changes in the client state
      return null;
    }
  });

  constructor(
    private s: DataPersistence<TodosState>,
    private backend: Backend
  ) {}
}
```

With this setup, the requests for Todo will run concurrently with the requests for Todo 2.

## Data Fetching On Router Navigation

Since the user can always interact with the URL directly, we should treat the router as the source of truth and the initiator of actions. In other words, the router should invoke the reducer, not the other way around.

When our state depends on navigation, we can not assume the route change happened when a new url is triggered but when we actually know the user was able to navigate to the url. DataPersistence `navigation` method checks if an activated router state contains the passed in component type, and, if it does, runs the `run` callback. It provides the activated snapshot associated with the component and the current state. And it only runs the last request.

```typescript
import { DataPersistence } from '@nrwl/angular';

@Injectable()
class TodoEffects {
  @Effect() loadTodo = this.s.navigation(TodoComponent, {
    run: (a: ActivatedRouteSnapshot, state: TodosState) => {
      return this.backend.fetchTodo(a.params['id']).map(todo => ({
        type: 'TODO_LOADED',
        payload: todo
      }));
    },

    onError: (a: ActivatedRouteSnapshot, e: any) => {
      // we can log and error here and return null
      // we can also navigate back
      return null;
    }
  });

  constructor(
    private s: DataPersistence<TodosState>,
    private backend: Backend
  ) {}
}
```
