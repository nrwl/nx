import { Component, Injectable } from '@angular/core';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { Actions, Effect, EffectsModule } from '@ngrx/effects';
import { provideMockActions } from '@ngrx/effects/testing';
import { StoreRouterConnectingModule } from '@ngrx/router-store';
import { Store, StoreModule } from '@ngrx/store';
import { Observable, of, Subject, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';

import { DataPersistence } from '../index';
import { NxModule } from '../src/nx.module';
import { readAll } from '../testing';

// interfaces
type Todo = {
  id: number;
  user: string;
};
type Todos = {
  selected: Todo;
};
type TodosState = {
  todos: Todos;
  user: string;
};

// actions
type TodoLoaded = {
  type: 'TODO_LOADED';
  payload: Todo;
};
type UpdateTodo = {
  type: 'UPDATE_TODO';
  payload: { newTitle: string };
};
type Action = TodoLoaded;

// reducers
function todosReducer(state: Todos, action: Action): Todos {
  if (action.type === 'TODO_LOADED') {
    return { selected: action.payload };
  } else {
    return state;
  }
}

function userReducer(state: string, action: Action): string {
  return 'bob';
}

@Component({ template: `ROOT[<router-outlet></router-outlet>]` })
class RootCmp {}

@Component({
  template: `
      Todo [
        <div *ngIf="(todo|async) as t">
           ID {{t.id}}
           User {{t.user}}
        </div>
      ]
    `
})
class TodoComponent {
  todo = this.store.select('todos', 'selected');
  constructor(private store: Store<TodosState>) {}
}

describe('DataPersistence', () => {
  describe('navigation', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        declarations: [RootCmp, TodoComponent],
        imports: [
          StoreModule.forRoot({ todos: todosReducer, user: userReducer }),
          StoreRouterConnectingModule,
          RouterTestingModule.withRoutes([
            { path: 'todo/:id', component: TodoComponent }
          ]),
          NxModule.forRoot()
        ]
      });
    });

    describe('successful navigation', () => {
      @Injectable()
      class TodoEffects {
        @Effect()
        loadTodo = this.s.navigation(TodoComponent, {
          run: (a, state) => {
            return {
              type: 'TODO_LOADED',
              payload: { id: a.params['id'], user: state.user }
            };
          },
          onError: () => null
        });
        constructor(private s: DataPersistence<TodosState>) {}
      }

      beforeEach(() => {
        TestBed.configureTestingModule({
          providers: [TodoEffects],
          imports: [EffectsModule.forRoot([TodoEffects])]
        });
      });

      it(
        'should work',
        fakeAsync(() => {
          const root = TestBed.createComponent(RootCmp);

          const router: Router = TestBed.get(Router);
          router.navigateByUrl('/todo/123');
          tick(0);
          root.detectChanges(false);

          expect(root.elementRef.nativeElement.innerHTML).toContain('ID 123');
          expect(root.elementRef.nativeElement.innerHTML).toContain('User bob');
        })
      );
    });

    describe('`run` throwing an error', () => {
      @Injectable()
      class TodoEffects {
        @Effect()
        loadTodo = this.s.navigation(TodoComponent, {
          run: (a, state) => {
            if (a.params['id'] === '123') {
              throw new Error('boom');
            } else {
              return {
                type: 'TODO_LOADED',
                payload: { id: a.params['id'], user: state.user }
              };
            }
          },
          onError: (a, e) => ({ type: 'ERROR', payload: { error: e } })
        });
        constructor(private s: DataPersistence<TodosState>) {}
      }

      beforeEach(() => {
        TestBed.configureTestingModule({
          providers: [TodoEffects],
          imports: [EffectsModule.forRoot([TodoEffects])]
        });
      });

      it(
        'should work',
        fakeAsync(() => {
          const root = TestBed.createComponent(RootCmp);

          const router: Router = TestBed.get(Router);
          let action;
          TestBed.get(Actions).subscribe(a => (action = a));

          router.navigateByUrl('/todo/123');
          tick(0);
          root.detectChanges(false);
          expect(root.elementRef.nativeElement.innerHTML).not.toContain(
            'ID 123'
          );
          expect(action.type).toEqual('ERROR');
          expect(action.payload.error.message).toEqual('boom');

          // can recover after an error
          router.navigateByUrl('/todo/456');
          tick(0);
          root.detectChanges(false);
          expect(root.elementRef.nativeElement.innerHTML).toContain('ID 456');
        })
      );
    });

    describe('`run` returning an error observable', () => {
      @Injectable()
      class TodoEffects {
        @Effect()
        loadTodo = this.s.navigation(TodoComponent, {
          run: (a, state) => {
            if (a.params['id'] === '123') {
              return throwError('boom');
            } else {
              return {
                type: 'TODO_LOADED',
                payload: { id: a.params['id'], user: state.user }
              };
            }
          },
          onError: (a, e) => ({ type: 'ERROR', payload: { error: e } })
        });
        constructor(private s: DataPersistence<TodosState>) {}
      }

      beforeEach(() => {
        TestBed.configureTestingModule({
          providers: [TodoEffects],
          imports: [EffectsModule.forRoot([TodoEffects])]
        });
      });

      it(
        'should work',
        fakeAsync(() => {
          const root = TestBed.createComponent(RootCmp);

          const router: Router = TestBed.get(Router);
          let action;
          TestBed.get(Actions).subscribe(a => (action = a));

          router.navigateByUrl('/todo/123');
          tick(0);
          root.detectChanges(false);
          expect(root.elementRef.nativeElement.innerHTML).not.toContain(
            'ID 123'
          );
          expect(action.type).toEqual('ERROR');
          expect(action.payload.error).toEqual('boom');

          router.navigateByUrl('/todo/456');
          tick(0);
          root.detectChanges(false);
          expect(root.elementRef.nativeElement.innerHTML).toContain('ID 456');
        })
      );
    });
  });

  describe('fetch', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({ providers: [DataPersistence] });
    });

    describe('no id', () => {
      type GetTodos = {
        type: 'GET_TODOS';
      };

      @Injectable()
      class TodoEffects {
        @Effect()
        loadTodos = this.s.fetch<GetTodos>('GET_TODOS', {
          run: (a, state) => {
            // we need to introduce the delay to "enable" switchMap
            return of({
              type: 'TODOS',
              payload: { user: state.user, todos: 'some todos' }
            }).pipe(delay(1));
          },

          onError: (a, e: any) => null
        });

        constructor(private s: DataPersistence<TodosState>) {}
      }

      function userReducer() {
        return 'bob';
      }

      let actions: Observable<any>;

      beforeEach(() => {
        actions = new Subject<any>();
        TestBed.configureTestingModule({
          providers: [TodoEffects, provideMockActions(() => actions)],
          imports: [StoreModule.forRoot({ user: userReducer })]
        });
      });

      it('should work', async done => {
        actions = of(
          { type: 'GET_TODOS', payload: {} },
          { type: 'GET_TODOS', payload: {} }
        );

        expect(await readAll(TestBed.get(TodoEffects).loadTodos)).toEqual([
          { type: 'TODOS', payload: { user: 'bob', todos: 'some todos' } },
          { type: 'TODOS', payload: { user: 'bob', todos: 'some todos' } }
        ]);

        done();
      });
    });

    describe('id', () => {
      type GetTodo = {
        type: 'GET_TODO';
        payload: { id: string };
      };

      @Injectable()
      class TodoEffects {
        @Effect()
        loadTodo = this.s.fetch<GetTodo>('GET_TODO', {
          id: (a, state) => a.payload.id,
          run: (a, state) =>
            of({ type: 'TODO', payload: a.payload }).pipe(delay(1)),
          onError: (a, e: any) => null
        });

        constructor(private s: DataPersistence<TodosState>) {}
      }

      function userReducer() {
        return 'bob';
      }

      let actions: Observable<any>;

      beforeEach(() => {
        actions = new Subject<any>();
        TestBed.configureTestingModule({
          providers: [TodoEffects, provideMockActions(() => actions)],
          imports: [StoreModule.forRoot({ user: userReducer })]
        });
      });

      it('should work', async done => {
        actions = of(
          { type: 'GET_TODO', payload: { id: 1, value: '1' } },
          { type: 'GET_TODO', payload: { id: 2, value: '2a' } },
          { type: 'GET_TODO', payload: { id: 2, value: '2b' } }
        );

        expect(await readAll(TestBed.get(TodoEffects).loadTodo)).toEqual([
          { type: 'TODO', payload: { id: 1, value: '1' } },
          { type: 'TODO', payload: { id: 2, value: '2b' } }
        ]);

        done();
      });
    });
  });

  describe('pessimisticUpdate', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({ providers: [DataPersistence] });
    });

    describe('successful', () => {
      @Injectable()
      class TodoEffects {
        @Effect()
        loadTodo = this.s.pessimisticUpdate<UpdateTodo>('UPDATE_TODO', {
          run: (a, state) => ({
            type: 'TODO_UPDATED',
            payload: { user: state.user, newTitle: a.payload.newTitle }
          }),
          onError: (a, e: any) => null
        });

        constructor(private s: DataPersistence<TodosState>) {}
      }

      function userReducer() {
        return 'bob';
      }

      let actions: Observable<any>;

      beforeEach(() => {
        actions = new Subject<any>();
        TestBed.configureTestingModule({
          providers: [TodoEffects, provideMockActions(() => actions)],
          imports: [StoreModule.forRoot({ user: userReducer })]
        });
      });

      it('should work', async done => {
        actions = of({
          type: 'UPDATE_TODO',
          payload: { newTitle: 'newTitle' }
        });

        expect(await readAll(TestBed.get(TodoEffects).loadTodo)).toEqual([
          {
            type: 'TODO_UPDATED',
            payload: { user: 'bob', newTitle: 'newTitle' }
          }
        ]);

        done();
      });
    });

    describe('`run` throws an error', () => {
      @Injectable()
      class TodoEffects {
        @Effect()
        loadTodo = this.s.pessimisticUpdate<UpdateTodo>('UPDATE_TODO', {
          run: (a, state) => {
            throw new Error('boom');
          },

          onError: (a, e: any) => ({
            type: 'ERROR',
            payload: { error: e }
          })
        });

        constructor(private s: DataPersistence<TodosState>) {}
      }

      function userReducer() {
        return 'bob';
      }

      let actions: Observable<any>;

      beforeEach(() => {
        actions = new Subject<any>();
        TestBed.configureTestingModule({
          providers: [TodoEffects, provideMockActions(() => actions)],
          imports: [StoreModule.forRoot({ user: userReducer })]
        });
      });

      it('should work', async done => {
        actions = of({
          type: 'UPDATE_TODO',
          payload: { newTitle: 'newTitle' }
        });

        const [a]: any = await readAll(TestBed.get(TodoEffects).loadTodo);

        expect(a.type).toEqual('ERROR');
        expect(a.payload.error.message).toEqual('boom');

        done();
      });
    });

    describe('`run` returns an observable that errors', () => {
      @Injectable()
      class TodoEffects {
        @Effect()
        loadTodo = this.s.pessimisticUpdate<UpdateTodo>('UPDATE_TODO', {
          run: (a, state) => {
            return throwError('boom');
          },

          onError: (a, e: any) => ({
            type: 'ERROR',
            payload: { error: e }
          })
        });

        constructor(private s: DataPersistence<TodosState>) {}
      }

      function userReducer() {
        return 'bob';
      }

      let actions: Observable<any>;

      beforeEach(() => {
        actions = new Subject<any>();
        TestBed.configureTestingModule({
          providers: [TodoEffects, provideMockActions(() => actions)],
          imports: [StoreModule.forRoot({ user: userReducer })]
        });
      });

      it('should work', async done => {
        actions = of({
          type: 'UPDATE_TODO',
          payload: { newTitle: 'newTitle' }
        });

        const [a]: any = await readAll(TestBed.get(TodoEffects).loadTodo);

        expect(a.type).toEqual('ERROR');
        expect(a.payload.error).toEqual('boom');

        done();
      });
    });
  });

  describe('optimisticUpdate', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({ providers: [DataPersistence] });
    });

    describe('`run` throws an error', () => {
      @Injectable()
      class TodoEffects {
        @Effect()
        loadTodo = this.s.optimisticUpdate<UpdateTodo>('UPDATE_TODO', {
          run: (a, state) => {
            throw new Error('boom');
          },

          undoAction: (a, e: any) => ({
            type: 'UNDO_UPDATE_TODO',
            payload: a.payload
          })
        });

        constructor(private s: DataPersistence<TodosState>) {}
      }

      function userReducer() {
        return 'bob';
      }

      let actions: Observable<any>;

      beforeEach(() => {
        actions = new Subject<any>();
        TestBed.configureTestingModule({
          providers: [TodoEffects, provideMockActions(() => actions)],
          imports: [StoreModule.forRoot({ user: userReducer })]
        });
      });

      it('should work', async done => {
        actions = of({
          type: 'UPDATE_TODO',
          payload: { newTitle: 'newTitle' }
        });

        const [a]: any = await readAll(TestBed.get(TodoEffects).loadTodo);

        expect(a.type).toEqual('UNDO_UPDATE_TODO');
        expect(a.payload.newTitle).toEqual('newTitle');

        done();
      });
    });
  });
});
