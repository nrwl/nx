import { Injectable, Type } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Actions } from '@ngrx/effects';
import { ROUTER_NAVIGATION, RouterNavigationAction } from '@ngrx/router-store';
import { Action, State, Store } from '@ngrx/store';
import { Observable } from 'rxjs/Observable';
import { of } from 'rxjs/observable/of';
import { _catch } from 'rxjs/operator/catch';
import { concatMap } from 'rxjs/operator/concatMap';
import { filter } from 'rxjs/operator/filter';
import { groupBy } from 'rxjs/operator/groupBy';
import { map } from 'rxjs/operator/map';
import { mergeMap } from 'rxjs/operator/mergeMap';
import { switchMap } from 'rxjs/operator/switchMap';
import { withLatestFrom } from 'rxjs/operator/withLatestFrom';

/**
 * See {@link DataPersistence.pessimisticUpdate} for more information.
 */
export interface PessimisticUpdateOpts {
  run(a: Action, state?: any): Observable<Action> | Action | void;
  onError(a: Action, e: any): Observable<any> | any;
}
/**
 * See {@link DataPersistence.pessimisticUpdate} for more information.
 */
export interface OptimisticUpdateOpts {
  run(a: Action, state?: any): Observable<any> | any;
  undoAction(a: Action, e: any): Observable<Action> | Action;
}

/**
 * See {@link DataPersistence.navigation} for more information.
 */
export interface FetchOpts {
  id?(a: Action, state?: any): any;
  run(a: Action, state?: any): Observable<Action> | Action | void;
  onError?(a: Action, e: any): Observable<any> | any;
}

/**
 * See {@link DataPersistence.navigation} for more information.
 */
export interface HandleNavigationOpts {
  run(a: ActivatedRouteSnapshot, state?: any): Observable<Action> | Action | void;
  onError?(a: ActivatedRouteSnapshot, e: any): Observable<any> | any;
}

type Pair = [Action, any];

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
   *   @Effect() updateTodo = this.s.pessimisticUpdate('UPDATE_TODO', {
   *     // provides an action and the current state of the store
   *     run(a: UpdateTodo, state: TodosState) {
   *       // update the backend first, and then dispatch an action that will
   *       // update the client side
   *       return this.backend(state.user, a.payload).map(updated => ({
   *         type: 'TODO_UPDATED',
   *         payload: updated
   *       }));
   *     },
   *
   *     onError(a: UpdateTodo, e: any) {
   *       // we don't need to undo the changes on the client side.
   *       // we can dispatch an error, or simply log the error here and return `null`
   *       return null;
   *     }
   *   });
   *
   *   constructor(private s: DataPersistence<TodosState>, private backend: Backend) {}
   * }
   * ```
   */
  pessimisticUpdate(actionType: string, opts: PessimisticUpdateOpts): Observable<any> {
    const nav = this.actions.ofType(actionType);
    const pairs = withLatestFrom.call(nav, this.store);
    return concatMap.call(pairs, this.runWithErrorHandling(opts.run, opts.onError));
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
   *   @Effect() updateTodo = this.s.optimisticUpdate('UPDATE_TODO', {
   *     // provides an action and the current state of the store
   *     run: (a: UpdateTodo, state: TodosState) => {
   *       return this.backend(state.user, a.payload);
   *     },
   *
   *     undoAction: (a: UpdateTodo, e: any) => {
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
   */
  optimisticUpdate(actionType: string, opts: OptimisticUpdateOpts): Observable<any> {
    const nav = this.actions.ofType(actionType);
    const pairs = withLatestFrom.call(nav, this.store);
    return concatMap.call(pairs, this.runWithErrorHandling(opts.run, opts.undoAction));
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
   *   @Effect() loadTodos = this.s.fetch('GET_TODOS', {
   *     // provides an action and the current state of the store
   *     run: (a: GetTodos, state: TodosState) => {
   *       return this.backend(state.user, a.payload).map(r => ({
   *         type: 'TODOS',
   *         payload: r
   *       });
   *     },
   *
   *     onError: (a: GetTodos, e: any) => {
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
   * To fix that, you can provide the `id` function, li ke this:
   *
   * ```typescript
   * @Injectable()
   * class TodoEffects {
   *   @Effect() loadTodo = this.s.fetch('GET_TODO', {
   *     id: (a: GetTodo, state: TodosState) => {
   *       return a.payload.id;
   *     }
   *
   *     // provides an action and the current state of the store
   *     run: (a: GetTodo, state: TodosState) => {
   *       return this.backend(state.user, a.payload).map(r => ({
   *         type: 'TODO',
   *         payload: r
   *       });
   *     },
   *
   *     onError: (a: GetTodo, e: any) => {
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
  fetch(actionType: string, opts: FetchOpts): Observable<any> {
    const nav = this.actions.ofType(actionType);
    const allPairs = withLatestFrom.call(nav, this.store);

    if (opts.id) {
      const groupedFetches: Observable<Observable<Pair>> = groupBy.call(allPairs, p => opts.id(p[0], p[1]));
      return mergeMap.call(groupedFetches, (pairs: Observable<Pair>) =>
        switchMap.call(pairs, this.runWithErrorHandling(opts.run, opts.onError))
      );
    } else {
      return concatMap.call(allPairs, this.runWithErrorHandling(opts.run, opts.onError));
    }
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
   *     run: (a: ActivatedRouteSnapshot, state: TodosState) => {
   *       return this.backend.fetchTodo(a.params['id']).map(todo => ({
   *         type: 'TODO_LOADED',
   *         payload: todo
   *       }));
   *     },
   *     onError: (a: ActivatedRouteSnapshot, e: any) => {
   *       // we can log and error here and return null
   *       // we can also navigate back
   *       return null;
   *     }
   *   });
   *   constructor(private s: DataPersistence<TodosState>, private backend: Backend) {}
   * }
   * ```
   *
   */
  navigation(component: Type<any>, opts: HandleNavigationOpts): Observable<any> {
    const nav = filter.call(
      map.call(this.actions.ofType(ROUTER_NAVIGATION), (a: RouterNavigationAction<RouterStateSnapshot>) =>
        findSnapshot(component, a.payload.routerState.root)
      ),
      s => !!s
    );

    const pairs = withLatestFrom.call(nav, this.store);
    return switchMap.call(pairs, this.runWithErrorHandling(opts.run, opts.onError));
  }

  private runWithErrorHandling(run: any, onError: any) {
    return a => {
      try {
        const r = wrapIntoObservable(run(a[0], a[1]));
        return _catch.call(r, e => wrapIntoObservable(onError(a[0], e)));
      } catch (e) {
        return wrapIntoObservable(onError(a[0], e));
      }
    };
  }
}

function findSnapshot(component: Type<any>, s: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
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

function wrapIntoObservable(obj: any): Observable<any> {
  if (!!obj && typeof obj.subscribe === 'function') {
    return obj;
  } else if (!obj) {
    return of();
  } else {
    return of(obj);
  }
}
