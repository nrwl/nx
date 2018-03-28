import { newApp, newProject, runCLI, updateFile } from '../utils';

describe('ngrx', () => {
  it(
    'should work',
    () => {
      newProject();
      newApp('myapp');
      runCLI(
        'generate ngrx app --module=apps/myapp/src/app/app.module.ts --root --collection=@nrwl/schematics'
      );
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
        export const initialState: App = {
          rootCount: 0
        };
      `
      );

      updateFile(
        'apps/myapp/src/app/+state/app.reducer.spec.ts',
        `
        import { App, AppState } from './app.interfaces';
        import { appReducer } from './app.reducer';
        import { AppLoaded } from './app.actions';
        import { initialState } from './app.init';
        
        describe('appReducer', () => {
          it('should work', () => {
            const action: AppLoaded = new AppLoaded({});
            const actual = appReducer(initialState, action);
            expect(actual).toEqual({rootCount: 0});
          });
        });
      `
      );

      runCLI('build');
      runCLI('test --single-run');
    },
    1000000
  );
});
