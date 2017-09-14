# Nrwl Extensions for Angular

Nx (Nrwl Extensions for Angular) is a set of libraries and schematics for the Angular framework.

## Installing

Add the following dependencies to your project's `package.json` and run `npm install`:

```
{
  dependencies: {
    "@ngrx/store": "4.0.2",
    "@ngrx/effects": "4.0.2",
    "@nrwl/nx": "https://github.com/nrwl/nx-build"
  }
}
```

## Data Persistence

Nrwl Extensions come with utilities to simplify data persistence (data fetching, optimistic and pessimistic updates).

### Optimistic Updates

```typescript
class TodoEffects {
  @Effect() updateTodo = this.s.optimisticUpdate('UPDATE_TODO', {
    // provides an action and the current state of the store
    run(a: UpdateTodo, state: TodosState) {
      return this.backend(state.user, a.payload);
    },

    undoAction(a: UpdateTodo, e: any): Action {
      // dispatch an undo action to undo the changes in the client state
      return ({
        type: 'UNDO_UPDATE_TODO',
        payload: a
      });
    }
  });

  constructor(private s: DataPersistence<TodosState>, private backend: Backend) {}
}
```

### Pessimistic Updates

```typescript
@Injectable()
class TodoEffects {
  @Effect() updateTodo = this.s.pessimisticUpdate('UPDATE_TODO', {
    // provides an action and the current state of the store
    run(a: UpdateTodo, state: TodosState) {
      // update the backend first, and then dispatch an action that will
      // update the client side
      return this.backend(state.user, a.payload).map(updated => ({
        type: 'TODO_UPDATED',
        payload: updated
      }));
    },
    onError(a: UpdateTodo, e: any) {
      // we don't need to undo the changes on the client side.
      // we can dispatch an error, or simply log the error here and return `null`
      return null;
    }
  });
  constructor(private s: DataPersistence<TodosState>, private backend: Backend) {}
}
```

### Date Fetching

```typescript
@Injectable()
class TodoEffects {
  @Effect() loadTodo = this.s.fetch('GET_TODOS', {
    // provides an action and the current state of the store
    run(a: GetTodos, state: TodosState) {
      return this.backend(state.user, a.payload).map(r => ({
        type: 'TODOS',
        payload: r
      });
    },
    onError(a: GetTodos, e: any): Action {
      // dispatch an undo action to undo the changes in the client state
      // return null;
    }
  });
  constructor(private s: DataPersistence<TodosState>, private backend: Backend) {}
}
```

### Date Fetching On Router Navigation

```typescript
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
  constructor(private s: DataPersistence<TodosState>, private backend: Backend) {}
}
```


## Testing

Nx comes with utilities to simplify testing Angular applications. Read https://github.com/vsavkin/testing_ngrx_effects for more information.


