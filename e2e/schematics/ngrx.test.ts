import { checkFilesExist, cleanup, copyMissingPackages, newApp, ngNew, readFile, runCLI, updateFile } from '../utils';

describe('ngrx', () => {
  beforeEach(cleanup);

  it(
    'should work',
    () => {
      ngNew('--collection=@nrwl/schematics');
      newApp('myapp');
      copyMissingPackages();
      runCLI('generate ngrx app --module=apps/myapp/src/app/app.module.ts --root --collection=@nrwl/schematics');
      updateFile(
        'apps/myapp/src/app/+state/app.interfaces.ts',
        `
        export interface App {
          rootCount: number;
        }
        export interface AppState {
          readonly app: App;
        }
      `
      );

      updateFile(
        'apps/myapp/src/app/+state/app.init.ts',
        `
        import { App } from './app.interfaces';
        export const appInitialState: App = {
          rootCount: 0
        };
      `
      );

      updateFile(
        'apps/myapp/src/app/+state/app.reducer.spec.ts',
        `
        import { appReducer } from './app.reducer';
        import { appInitialState } from './app.init';
        import { App } from './app.interfaces';
        import * as app from './app.actions';
        
        describe('appReducer', () => {
          it('should work', () => {
            const state: App = {rootCount: 0};
            const action = new app.LoadSuccess({});
            const actual = appReducer(state, action);
            expect(actual).toEqual({rootCount: 0});
          });
        });
      `
      );

      runCLI('build');
      runCLI('test --single-run');
    },
    100000
  );
});
