import { Injectable, Type } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { ROUTER_NAVIGATION, RouterNavigationAction } from '@ngrx/router-store';
import { Action, Store, ActionCreator } from '@ngrx/store';
import { isObservable, Observable, of } from 'rxjs';
import {
  catchError,
  concatMap,
  filter,
  groupBy,
  map,
  mergeMap,
  switchMap,
  withLatestFrom,
} from 'rxjs/operators';

/**
 * See {@link DataPersistence.pessimisticUpdate} for more information.
 */
export interface PessimisticUpdateOpts<T, A> {
  run(a: A, state?: T): Observable<Action> | Action | void;
  onError(a: A, e: any): Observable<any> | any;
}
/**
 * See {@link DataPersistence.pessimisticUpdate} for more information.
 */
export interface OptimisticUpdateOpts<T, A> {
  run(a: A, state?: T): Observable<Action> | Action | void;
  undoAction(a: A, e: any): Observable<Action> | Action;
}

/**
 * See {@link DataPersistence.fetch} for more information.
 */
export interface FetchOpts<T, A> {
  id?(a: A, state?: T): any;
  run(a: A, state?: T): Observable<Action> | Action | void;
  onError?(a: A, e: any): Observable<any> | any;
}

/**
 * See {@link DataPersistence.navigation} for more information.
 */
export interface HandleNavigationOpts<T> {
  run(a: ActivatedRouteSnapshot, state?: T): Observable<Action> | Action | void;
  onError?(a: ActivatedRouteSnapshot, e: any): Observable<any> | any;
}

export type ActionOrActionWithState<T, A> = A | [A, T];
export type ActionStateStream<T, A> = Observable<ActionOrActionWithState<T, A>>;

export function pessimisticUpdate<T, A extends Action>(
  opts: PessimisticUpdateOpts<T, A>
) {
  return (source: ActionStateStream<T, A>): Observable<Action> => {
    return source.pipe(
      mapActionAndState(),
      concatMap(runWithErrorHandling(opts.run, opts.onError))
    );
  };
}

export function optimisticUpdate<T, A extends Action>(
  opts: OptimisticUpdateOpts<T, A>
) {
  return (source: ActionStateStream<T, A>): Observable<Action> => {
    return source.pipe(
      mapActionAndState(),
      concatMap(runWithErrorHandling(opts.run, opts.undoAction))
    );
  };
}

export function fetch<T, A extends Action>(opts: FetchOpts<T, A>) {
  return (source: ActionStateStream<T, A>): Observable<Action> => {
    if (opts.id) {
      const groupedFetches = source.pipe(
        mapActionAndState(),
        groupBy(([action, store]) => {
          return opts.id(action, store);
        })
      );

      return groupedFetches.pipe(
        mergeMap((pairs) =>
          pairs.pipe(switchMap(runWithErrorHandling(opts.run, opts.onError)))
        )
      );
    }

    return source.pipe(
      mapActionAndState(),
      concatMap(runWithErrorHandling(opts.run, opts.onError))
    );
  };
}

export function navigation<T, A extends Action>(
  component: Type<any>,
  opts: HandleNavigationOpts<T>
) {
  return (source: ActionStateStream<T, A>) => {
    const nav = source.pipe(
      mapActionAndState(),
      filter(([action, state]) => isStateSnapshot(action)),
      map(([action, state]) => {
        if (!isStateSnapshot(action)) {
          // Because of the above filter we'll never get here,
          // but this properly type narrows `action`
          return;
        }

        return [
          findSnapshot(component, action.payload.routerState.root),
          state,
        ] as [ActivatedRouteSnapshot, T];
      }),
      filter(([snapshot, state]) => !!snapshot)
    );

    return nav.pipe(switchMap(runWithErrorHandling(opts.run, opts.onError)));
  };
}

function isStateSnapshot(
  action: any
): action is RouterNavigationAction<RouterStateSnapshot> {
  return action.type === ROUTER_NAVIGATION;
}

function runWithErrorHandling<T, A, R>(
  run: (a: A, state?: T) => Observable<R> | R | void,
  onError: any
) {
  return ([action, state]: [A, T]): Observable<R> => {
    try {
      const r = wrapIntoObservable(run(action, state));
      return r.pipe(catchError((e) => wrapIntoObservable(onError(action, e))));
    } catch (e) {
      return wrapIntoObservable(onError(action, e));
    }
  };
}

/**
 * @whatItDoes maps Observable<Action | [Action, State]> to
 * Observable<[Action, State]>
 */
function mapActionAndState<T, A>() {
  return (source: Observable<ActionOrActionWithState<T, A>>) => {
    return source.pipe(
      map((value) => {
        const [action, store] = normalizeActionAndState(value);
        return [action, store] as [A, T];
      })
    );
  };
}

/**
 * @whatItDoes Normalizes either a bare action or an array of action and state
 * into an array of action and state (or undefined)
 */
function normalizeActionAndState<T, A>(
  args: ActionOrActionWithState<T, A>
): [A, T] {
  let action: A, state: T;

  if (args instanceof Array) {
    [action, state] = args;
  } else {
    action = args;
  }

  return [action, state];
}

/**
 * @whatItDoes Provides convenience methods for implementing common operations of persisting data.
 */
@Injectable()
export class DataPersistence<T> {
  constructor(public store: Store<T>, public actions: Actions) {}

  /**
   *
   * @whatItDoes Handles pessimistic updates (updating the server first).
   *
   * Update the server implemented naively suffers from race conditions and poor error handling.
   *
   * `pessimisticUpdate` addresses these problems--it runs all fetches in order, which removes race conditions
   * and forces the developer to handle errors.
   *
   * ## Example:
   *
   * ```typescript
   * @Injectable()
   * class TodoEffects {
   *   @Effect() updateTodo = this.s.pessimisticUpdate<UpdateTodo>('UPDATE_TODO', {
   *     // provides an action and the current state of the store
   *     run(a, state) {
   *       // update the backend first, and then dispatch an action that will
   *       // update the client side
   *       return this.backend(state.user, a.payload).map(updated => ({
   *         type: 'TODO_UPDATED',
   *         payload: updated
   *       }));
   *     },
   *
   *     onError(a, e: any) {
   *       // we don't need to undo the changes on the client side.
   *       // we can dispatch an error, or simply log the error here and return `null`
   *       return null;
   *     }
   *   });
   *
   *   constructor(private s: DataPersistence<TodosState>, private backend: Backend) {}
   * }
   * ```
   *
   * Note that if you don't return a new action from the run callback, you must set the dispatch property
   * of the effect to false, like this:
   *
   * ```
   * class TodoEffects {
   *   @Effect({dispatch: false})
   *   updateTodo; //...
   * }
   * ```
   */
  pessimisticUpdate<A extends Action = Action>(
    actionType: string | ActionCreator,
    opts: PessimisticUpdateOpts<T, A>
  ): Observable<any> {
    return this.actions.pipe(
      ofType<A>(actionType),
      withLatestFrom(this.store),
      pessimisticUpdate(opts)
    );
  }

  /**
   *
   * @whatItDoes Handles optimistic updates (updating the client first).
   *
   * `optimisticUpdate` addresses these problems--it runs all fetches in order, which removes race conditions
   * and forces the developer to handle errors.
   *
   * `optimisticUpdate` is different from `pessimisticUpdate`. In case of a failure, when using `optimisticUpdate`,
   * the developer already updated the state locally, so the developer must provide an undo action.
   *
   * The error handling must be done in the callback, or by means of the undo action.
   *
   * ## Example:
   *
   * ```typescript
   * @Injectable()
   * class TodoEffects {
   *   @Effect() updateTodo = this.s.optimisticUpdate<UpdateTodo>('UPDATE_TODO', {
   *     // provides an action and the current state of the store
   *     run: (a, state) => {
   *       return this.backend(state.user, a.payload);
   *     },
   *
   *     undoAction: (a, e: any) => {
   *       // dispatch an undo action to undo the changes in the client state
   *       return ({
   *         type: 'UNDO_UPDATE_TODO',
   *         payload: a
   *       });
   *     }
   *   });
   *
   *   constructor(private s: DataPersistence<TodosState>, private backend: Backend) {}
   * }
   * ```
   *
   * Note that if you don't return a new action from the run callback, you must set the dispatch property
   * of the effect to false, like this:
   *
   * ```
   * class TodoEffects {
   *   @Effect({dispatch: false})
   *   updateTodo; //...
   * }
   * ```
   */
  optimisticUpdate<A extends Action = Action>(
    actionType: string | ActionCreator,
    opts: OptimisticUpdateOpts<T, A>
  ): Observable<any> {
    return this.actions.pipe(
      ofType<A>(actionType),
      withLatestFrom(this.store),
      optimisticUpdate(opts)
    );
  }

  /**
   *
   * @whatItDoes Handles data fetching.
   *
   * Data fetching implemented naively suffers from race conditions and poor error handling.
   *
   * `fetch` addresses these problems--it runs all fetches in order, which removes race conditions
   * and forces the developer to handle errors.
   *
   * ## Example:
   *
   * ```typescript
   * @Injectable()
   * class TodoEffects {
   *   @Effect() loadTodos = this.s.fetch<GetTodos>('GET_TODOS', {
   *     // provides an action and the current state of the store
   *     run: (a, state) => {
   *       return this.backend(state.user, a.payload).map(r => ({
   *         type: 'TODOS',
   *         payload: r
   *       });
   *     },
   *
   *     onError: (a, e: any) => {
   *       // dispatch an undo action to undo the changes in the client state
   *     }
   *   });
   *
   *   constructor(private s: DataPersistence<TodosState>, private backend: Backend) {}
   * }
   * ```
   *
   * This is correct, but because it set the concurrency to 1, it may not be performant.
   *
   * To fix that, you can provide the `id` function, like this:
   *
   * ```typescript
   * @Injectable()
   * class TodoEffects {
   *   @Effect() loadTodo = this.s.fetch<GetTodo>('GET_TODO', {
   *     id: (a, state) => {
   *       return a.payload.id;
   *     }
   *
   *     // provides an action and the current state of the store
   *     run: (a, state) => {
   *       return this.backend(state.user, a.payload).map(r => ({
   *         type: 'TODO',
   *         payload: r
   *       });
   *     },
   *
   *     onError: (a, e: any) => {
   *       // dispatch an undo action to undo the changes in the client state
   *       return null;
   *     }
   *   });
   *
   *   constructor(private s: DataPersistence<TodosState>, private backend: Backend) {}
   * }
   * ```
   *
   * With this setup, the requests for Todo 1 will run concurrently with the requests for Todo 2.
   *
   * In addition, if DataPersistence notices that there are multiple requests for Todo 1 scheduled,
   * it will only run the last one.
   */
  fetch<A extends Action = Action>(
    actionType: string | ActionCreator,
    opts: FetchOpts<T, A>
  ): Observable<any> {
    return this.actions.pipe(
      ofType<A>(actionType),
      withLatestFrom(this.store),
      fetch(opts)
    );
  }

  /**
   * @whatItDoes Handles data fetching as part of router navigation.
   *
   * Data fetching implemented naively suffers from race conditions and poor error handling.
   *
   * `navigation` addresses these problems.
   *
   * It checks if an activated router state contains the passed in component type, and, if it does, runs the `run`
   * callback. It provides the activated snapshot associated with the component and the current state. And it only runs
   * the last request.
   *
   * ## Example:
   *
   * ```typescript
   * @Injectable()
   * class TodoEffects {
   *   @Effect() loadTodo = this.s.navigation(TodoComponent, {
   *     run: (a, state) => {
   *       return this.backend.fetchTodo(a.params['id']).map(todo => ({
   *         type: 'TODO_LOADED',
   *         payload: todo
   *       }));
   *     },
   *     onError: (a, e: any) => {
   *       // we can log and error here and return null
   *       // we can also navigate back
   *       return null;
   *     }
   *   });
   *   constructor(private s: DataPersistence<TodosState>, private backend: Backend) {}
   * }
   * ```
   */
  navigation(
    component: Type<any>,
    opts: HandleNavigationOpts<T>
  ): Observable<any> {
    return this.actions.pipe(
      withLatestFrom(this.store),
      navigation(component, opts)
    );
  }
}

function findSnapshot(
  component: Type<any>,
  s: ActivatedRouteSnapshot
): ActivatedRouteSnapshot {
  if (s.routeConfig && s.routeConfig.component === component) {
    return s;
  }
  for (const c of s.children) {
    const ss = findSnapshot(component, c);
    if (ss) {
      return ss;
    }
  }
  return null;
}

function wrapIntoObservable<O>(obj: Observable<O> | O | void): Observable<O> {
  if (isObservable(obj)) {
    return obj;
  } else if (!obj) {
    return of();
  } else {
    return of(obj as O);
  }
}
