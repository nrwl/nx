# Nrwl Extensions for Angular

NX (Nrwl Extensions) is a set of libraries and schematics for the Angular framework.



## Installing

Add the following dependencies to your project's `package.json` and run `npm install`:

```
{
  dependencies: {
    "@ngrx/store": "4.0.2",
    "@ngrx/effects": "4.0.2",
    "@nrwl/nx": "https://github.com/nrwl/nx-build",
    "@angular-devkit/schematics": "0.0.17" 
  }
}
```



## Schematics

### addNgRxToModule

#### Root

Run `schematics @nrwl/nx:addNgRxToModule --module=src/app/app.module.ts  --root`, and you will see the following files created:

```
/src/app/+state/app.actions.ts
/src/app/+state/app.effects.ts
/src/app/+state/app.effects.spec.ts
/src/app/+state/app.init.ts
/src/app/+state/app.interfaces.ts
/src/app/+state/app.reducer.ts
/src/app/+state/app.reducer.spec.ts
```

Also, `app.module.ts` will have `StoreModule.forRoot` and `EffectsModule.forRoot` configured.

#### EmptyRoot

Run `schematics @nrwl/nx:addNgRxToModule --module=src/app/app.module.ts  --emptyRoot` to only add the `StoreModule.forRoot` and `EffectsModule.forRoot` calls.

#### Feature

Run `schematics @nrwl/nx:addNgRxToModule --module=src/app/mymodule/mymodule.module.ts `, and you will see the following files created:

```
/src/app/mymodule/+state/app.actions.ts
/src/app/mymodule/+state/app.effects.ts
/src/app/mymodule/+state/app.effects.spec.ts
/src/app/mymodule/+state/app.init.ts
/src/app/mymodule/+state/app.interfaces.ts
/src/app/mymodule/+state/app.reducer.ts
/src/app/mymodule/+state/app.reducer.spec.ts
```

Also, `mymodule.module.ts` will have `StoreModule.forFeature` and `EffectsModule.forFeature` configured.

#### skipImport

Add `--skipImport` to generate files without adding imports to the module.



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

Nrwl Extensions come with utilities to simplify testing Angular applications. See `app.effects.spec.ts`. Read https://github.com/vsavkin/testing_ngrx_effects for more information.


