import type { Type } from '@angular/core';
import type {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import type { RouterNavigationAction } from '@ngrx/router-store';
import { ROUTER_NAVIGATION } from '@ngrx/router-store';
import type { Action } from '@ngrx/store';
import type { Observable } from 'rxjs';
import { isObservable, of } from 'rxjs';
import {
  catchError,
  concatMap,
  filter,
  groupBy,
  map,
  mergeMap,
  switchMap,
} from 'rxjs/operators';

export interface PessimisticUpdateOpts<T extends Array<unknown>, A> {
  run(a: A, ...slices: [...T]): Observable<Action> | Action | void;
  onError(a: A, e: any): Observable<any> | any;
}

export interface OptimisticUpdateOpts<T extends Array<unknown>, A> {
  run(a: A, ...slices: [...T]): Observable<Action> | Action | void;
  undoAction(a: A, e: any): Observable<Action> | Action;
}

export interface FetchOpts<T extends Array<unknown>, A> {
  id?(a: A, ...slices: [...T]): any;
  run(a: A, ...slices: [...T]): Observable<Action> | Action | void;
  onError?(a: A, e: any): Observable<any> | any;
}

export interface HandleNavigationOpts<T extends Array<unknown>> {
  run(
    a: ActivatedRouteSnapshot,
    ...slices: [...T]
  ): Observable<Action> | Action | void;
  onError?(a: ActivatedRouteSnapshot, e: any): Observable<any> | any;
}

export type ActionOrActionWithStates<T extends Array<unknown>, A> =
  | A
  | [A, ...T];
export type ActionOrActionWithState<T, A> = ActionOrActionWithStates<[T], A>;
export type ActionStatesStream<T extends Array<unknown>, A> = Observable<
  ActionOrActionWithStates<T, A>
>;
export type ActionStateStream<T, A> = Observable<
  ActionOrActionWithStates<[T], A>
>;

/**
 *
 * @whatItDoes Handles pessimistic updates (updating the server first).
 *
 * Updating the server, when implemented naively, suffers from race conditions and poor error handling.
 *
 * `pessimisticUpdate` addresses these problems. It runs all fetches in order, which removes race conditions
 * and forces the developer to handle errors.
 *
 * ## Example:
 *
 * ```typescript
 * @Injectable()
 * class TodoEffects {
 *   updateTodo$ = createEffect(() =>
 *     this.actions$.pipe(
 *       ofType('UPDATE_TODO'),
 *       pessimisticUpdate({
 *         // provides an action
 *         run: (action: UpdateTodo) => {
 *           // update the backend first, and then dispatch an action that will
 *           // update the client side
 *           return this.backend.updateTodo(action.todo.id, action.todo).pipe(
 *             map((updated) => ({
 *               type: 'UPDATE_TODO_SUCCESS',
 *               todo: updated,
 *             }))
 *           );
 *         },
 *         onError: (action: UpdateTodo, error: any) => {
 *           // we don't need to undo the changes on the client side.
 *           // we can dispatch an error, or simply log the error here and return `null`
 *           return null;
 *         },
 *       })
 *     )
 *   );
 *
 *   constructor(private actions$: Actions, private backend: Backend) {}
 * }
 * ```
 *
 * Note that if you don't return a new action from the run callback, you must set the dispatch property
 * of the effect to false, like this:
 *
 * ```typescript
 * class TodoEffects {
 *   updateTodo$ = createEffect(() =>
 *     this.actions$.pipe(
 *       //...
 *     ), { dispatch: false }
 *   );
 * }
 * ```
 *
 * @param opts
 */
export function pessimisticUpdate<T extends Array<unknown>, A extends Action>(
  opts: PessimisticUpdateOpts<T, A>
) {
  return (source: ActionStatesStream<T, A>): Observable<Action> => {
    return source.pipe(
      mapActionAndState(),
      concatMap(runWithErrorHandling(opts.run, opts.onError))
    );
  };
}

/**
 *
 * @whatItDoes Handles optimistic updates (updating the client first).
 *
 * It runs all fetches in order, which removes race conditions and forces the developer to handle errors.
 *
 * When using `optimisticUpdate`, in case of a failure, the developer has already updated the state locally,
 * so the developer must provide an undo action.
 *
 * The error handling must be done in the callback, or by means of the undo action.
 *
 * ## Example:
 *
 * ```typescript
 * @Injectable()
 * class TodoEffects {
 *   updateTodo$ = createEffect(() =>
 *     this.actions$.pipe(
 *       ofType('UPDATE_TODO'),
 *       optimisticUpdate({
 *         // provides an action
 *         run: (action: UpdateTodo) => {
 *           return this.backend.updateTodo(action.todo.id, action.todo).pipe(
 *             mapTo({
 *               type: 'UPDATE_TODO_SUCCESS',
 *             })
 *           );
 *         },
 *         undoAction: (action: UpdateTodo, error: any) => {
 *           // dispatch an undo action to undo the changes in the client state
 *           return {
 *             type: 'UNDO_TODO_UPDATE',
 *             todo: action.todo,
 *           };
 *         },
 *       })
 *     )
 *   );
 *
 *   constructor(private actions$: Actions, private backend: Backend) {}
 * }
 * ```
 *
 * Note that if you don't return a new action from the run callback, you must set the dispatch property
 * of the effect to false, like this:
 *
 * ```typescript
 * class TodoEffects {
 *   updateTodo$ = createEffect(() =>
 *     this.actions$.pipe(
 *       //...
 *     ), { dispatch: false }
 *   );
 * }
 * ```
 *
 * @param opts
 */
export function optimisticUpdate<T extends Array<unknown>, A extends Action>(
  opts: OptimisticUpdateOpts<T, A>
) {
  return (source: ActionStatesStream<T, A>): Observable<Action> => {
    return source.pipe(
      mapActionAndState(),
      concatMap(runWithErrorHandling(opts.run, opts.undoAction))
    );
  };
}

/**
 *
 * @whatItDoes Handles data fetching.
 *
 * Data fetching implemented naively suffers from race conditions and poor error handling.
 *
 * `fetch` addresses these problems. It runs all fetches in order, which removes race conditions
 * and forces the developer to handle errors.
 *
 * ## Example:
 *
 * ```typescript
 * @Injectable()
 * class TodoEffects {
 *   loadTodos$ = createEffect(() =>
 *     this.actions$.pipe(
 *       ofType('GET_TODOS'),
 *       fetch({
 *         // provides an action
 *         run: (a: GetTodos) => {
 *           return this.backend.getAll().pipe(
 *             map((response) => ({
 *               type: 'TODOS',
 *               todos: response.todos,
 *             }))
 *           );
 *         },
 *         onError: (action: GetTodos, error: any) => {
 *           // dispatch an undo action to undo the changes in the client state
 *           return null;
 *         },
 *       })
 *     )
 *   );
 *
 *   constructor(private actions$: Actions, private backend: Backend) {}
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
 *   loadTodo$ = createEffect(() =>
 *     this.actions$.pipe(
 *       ofType('GET_TODO'),
 *       fetch({
 *         id: (todo: GetTodo) => {
 *           return todo.id;
 *         },
 *         // provides an action
 *         run: (todo: GetTodo) => {
 *           return this.backend.getTodo(todo.id).map((response) => ({
 *             type: 'LOAD_TODO_SUCCESS',
 *             todo: response.todo,
 *           }));
 *         },
 *         onError: (action: GetTodo, error: any) => {
 *           // dispatch an undo action to undo the changes in the client state
 *           return null;
 *         },
 *       })
 *     )
 *   );
 *
 *   constructor(private actions$: Actions, private backend: Backend) {}
 * }
 * ```
 *
 * With this setup, the requests for Todo 1 will run concurrently with the requests for Todo 2.
 *
 * In addition, if there are multiple requests for Todo 1 scheduled, it will only run the last one.
 *
 * @param opts
 */
export function fetch<T extends Array<unknown>, A extends Action>(
  opts: FetchOpts<T, A>
) {
  return (source: ActionStatesStream<T, A>): Observable<Action> => {
    if (opts.id) {
      const groupedFetches = source.pipe(
        mapActionAndState(),
        groupBy(([action, ...store]) => {
          return opts.id(action, ...store);
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
 *   loadTodo$ = createEffect(() =>
 *     this.actions$.pipe(
 *       // listens for the routerNavigation action from @ngrx/router-store
 *       navigation(TodoComponent, {
 *         run: (activatedRouteSnapshot: ActivatedRouteSnapshot) => {
 *           return this.backend
 *             .fetchTodo(activatedRouteSnapshot.params['id'])
 *             .pipe(
 *               map((todo) => ({
 *                 type: 'LOAD_TODO_SUCCESS',
 *                 todo: todo,
 *               }))
 *             );
 *         },
 *         onError: (
 *           activatedRouteSnapshot: ActivatedRouteSnapshot,
 *           error: any
 *         ) => {
 *           // we can log and error here and return null
 *           // we can also navigate back
 *           return null;
 *         },
 *       })
 *     )
 *   );
 *
 *   constructor(private actions$: Actions, private backend: Backend) {}
 * }
 * ```
 *
 * @param component
 * @param opts
 */
export function navigation<T extends Array<unknown>, A extends Action>(
  component: Type<any>,
  opts: HandleNavigationOpts<T>
) {
  return (source: ActionStatesStream<T, A>) => {
    const nav = source.pipe(
      mapActionAndState(),
      filter(([action]) => isStateSnapshot(action)),
      map(([action, ...slices]) => {
        if (!isStateSnapshot(action)) {
          // Because of the above filter we'll never get here,
          // but this properly type narrows `action`
          return;
        }

        return [
          findSnapshot(component, action.payload.routerState.root),
          ...slices,
        ] as [ActivatedRouteSnapshot, ...T];
      }),
      filter(([snapshot]) => !!snapshot)
    );

    return nav.pipe(switchMap(runWithErrorHandling(opts.run, opts.onError)));
  };
}

function isStateSnapshot(
  action: any
): action is RouterNavigationAction<RouterStateSnapshot> {
  return action.type === ROUTER_NAVIGATION;
}

function runWithErrorHandling<T extends Array<unknown>, A, R>(
  run: (a: A, ...slices: [...T]) => Observable<R> | R | void,
  onError: any
) {
  return ([action, ...slices]: [A, ...T]): Observable<R> => {
    try {
      const r = wrapIntoObservable(run(action, ...slices));
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
function mapActionAndState<T extends Array<unknown>, A>() {
  return (source: Observable<ActionOrActionWithStates<T, A>>) => {
    return source.pipe(
      map((value) => normalizeActionAndState(value) as [A, ...T])
    );
  };
}

/**
 * @whatItDoes Normalizes either a bare action or an array of action and slices
 * into an array of action and slices (or undefined)
 */
function normalizeActionAndState<T extends Array<unknown>, A>(
  args: ActionOrActionWithStates<T, A>
): [A, ...T] {
  let action: A, slices: T;

  if (args instanceof Array) {
    [action, ...slices] = args;
  } else {
    slices = [] as T;
    action = args;
  }

  return [action, ...slices];
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
