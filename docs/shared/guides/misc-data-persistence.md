# Using DataPersistence

Managing state is a hard problem. We need to coordinate multiple backends, web workers, and UI components, all of which update the state concurrently.

What should we store in memory and what in the URL? What about the local UI state? How do we synchronize the persistent state, the URL, and the state on the server? All these questions have to be answered when designing the state management of our applications. **Nx** provides a set of helper functions that enables the developer to manage state in Angular with an intentional synchronization strategy and handle error state. Check out the [Managing State in Angular Applications using NgRx](https://blog.nrwl.io/using-ngrx-4-to-manage-state-in-angular-applications-64e7a1f84b7b) for more detailed example of the state problem Nx is solving.

## Optimistic Updates

For a better user experience, the `optimisticUpdate` operator updates the state on the client application first, before updating the data on the server-side. While it addresses fetching data in order, removing the race conditions and handling error, it is optimistic about not failing to update the server. In case of a failure, when using `optimisticUpdate`, the local state on the client is already updated. The developer must provide an undo action to restore the previous state to keep it consistent with the server state. The error handling must be done in the callback, or by means of the undo action.

```typescript
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { optimisticUpdate } from '@nrwl/angular';

@Injectable()
class TodoEffects {
  updateTodo$ = createEffect(() =>
    this.actions$.pipe(
      ofType('UPDATE_TODO'),
      optimisticUpdate({
        // provides an action
        run: (action: UpdateTodo) => {
          return this.backend.updateTodo(action.todo.id, action.todo).pipe(
            mapTo({
              type: 'UPDATE_TODO_SUCCESS',
            })
          );
        },
        undoAction: (action: UpdateTodo, error: any) => {
          // dispatch an undo action to undo the changes in the client state
          return {
            type: 'UNDO_TODO_UPDATE',
            todo: action.todo,
          };
        },
      })
    )
  );

  constructor(private actions$: Actions, private backend: Backend) {}
}
```

## Pessimistic Updates

To achieve a more reliable data synchronization, the `pessimisticUpdate` operator updates the server data first. When the change is reflected in the server state, changes the client state by dispatching an action. `pessimisticUpdate` method enforces the order of the fetches and error handling.

```typescript
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { pessimisticUpdate } from '@nrwl/angular';

@Injectable()
class TodoEffects {
  updateTodo$ = createEffect(() =>
    this.actions$.pipe(
      ofType('UPDATE_TODO'),
      pessimisticUpdate({
        // provides an action
        run: (action: UpdateTodo) => {
          // update the backend first, and then dispatch an action that will
          // update the client side
          return this.backend.updateTodo(action.todo.id, action.todo).pipe(
            map((updated) => ({
              type: 'UPDATE_TODO_SUCCESS',
              todo: updated,
            }))
          );
        },
        onError: (action: UpdateTodo, error: any) => {
          // we don't need to undo the changes on the client side.
          // we can dispatch an error, or simply log the error here and return `null`
          return null;
        },
      })
    )
  );

  constructor(private actions$: Actions, private backend: Backend) {}
}
```

## Data Fetching

The `fetch` operator provides consistency when fetching data. If there are multiple requests scheduled for the same action, it will only run the last one.

```typescript
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { fetch } from '@nrwl/angular';

@Injectable()
class TodoEffects {
  loadTodos$ = createEffect(() =>
    this.actions$.pipe(
      ofType('GET_TODOS'),
      fetch({
        // provides an action
        run: (a: GetTodos) => {
          return this.backend.getAll().pipe(
            map((response) => ({
              type: 'TODOS',
              todos: response.todos,
            }))
          );
        },

        onError: (action: GetTodos, error: any) => {
          // dispatch an undo action to undo the changes in the client state
          return null;
        },
      })
    )
  );

  constructor(private actions$: Actions, private backend: Backend) {}
}
```

This is correct, but we can improve the performance by supplying an id of the data by using an accessor function and adding concurrency to the fetch action for different ToDo's.

```typescript
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { fetch } from '@nrwl/angular';

@Injectable()
class TodoEffects {
  loadTodo$ = createEffect(() =>
    this.actions$.pipe(
      ofType('GET_TODO'),
      fetch({
        id: (todo: GetTodo) => {
          return todo.id;
        },

        // provides an action
        run: (todo: GetTodo) => {
          return this.backend.getTodo(todo.id).map((response) => ({
            type: 'LOAD_TODO_SUCCESS',
            todo: response.todo,
          }));
        },

        onError: (action: GetTodo, error: any) => {
          // dispatch an undo action to undo the changes in the client state
          return null;
        },
      })
    )
  );

  constructor(private actions$: Actions, private backend: Backend) {}
}
```

With this setup, the requests for Todo will run concurrently with the requests for Todo 2.

## Data Fetching On Router Navigation

Since the user can always interact with the URL directly, we should treat the router as the source of truth and the initiator of actions. In other words, the router should invoke the reducer, not the other way around.

When our state depends on navigation, we can not assume the route change happened when a new url is triggered but when we actually know the user was able to navigate to the url. The `navigation` operator checks if an activated router state contains the passed in component type, and, if it does, runs the `run` callback. It provides the activated snapshot associated with the component and the current state. And it only runs the last request.

```typescript
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { navigation } from '@nrwl/angular';

@Injectable()
class TodoEffects {
  loadTodo$ = createEffect(() =>
    this.actions$.pipe(
      // listens for the routerNavigation action from @ngrx/router-store
      navigation(TodoComponent, {
        run: (activatedRouteSnapshot: ActivatedRouteSnapshot) => {
          return this.backend
            .fetchTodo(activatedRouteSnapshot.params['id'])
            .pipe(
              map((todo) => ({
                type: 'LOAD_TODO_SUCCESS',
                todo: todo,
              }))
            );
        },

        onError: (
          activatedRouteSnapshot: ActivatedRouteSnapshot,
          error: any
        ) => {
          // we can log and error here and return null
          // we can also navigate back
          return null;
        },
      })
    )
  );

  constructor(private actions$: Actions, private backend: Backend) {}
}
```

The StoreRouterConnectingModule must be configured with an appropriate serializer. The `DefaultRouterStateSerializer` provides the full router state instead of the `MinimalRouterStateSerializer` that is used without configuration.

```typescript
import { NgModule } from '@angular/core';
import {
  StoreRouterConnectingModule,
  DefaultRouterStateSerializer,
} from '@ngrx/router-store';

@NgModule({
  imports: [
    StoreRouterConnectingModule.forRoot({
      serializer: DefaultRouterStateSerializer,
    }),
  ],
})
export class TodosModule {}
```
