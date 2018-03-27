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
        'apps/myapp/src/app/+state/app.reducer.spec.ts',
        `
        import { AppLoaded } from './app.actions';
        import { appReducer, initialState } from './app.reducer';
        
        describe('appReducer', () => {
          it('should work', () => {
            const action: AppLoaded = new AppLoaded({rootCount: 3});
            const actual = appReducer(initialState, action);
            expect(actual).toEqual({rootCount: 3});
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
