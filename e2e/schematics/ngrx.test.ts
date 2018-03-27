import { newApp, newProject, runCLI } from '../utils';

describe('ngrx', () => {
  it(
    'should work',
    () => {
      newProject();
      newApp('myapp');
      runCLI(
        'generate ngrx app --module=apps/myapp/src/app/app.module.ts --root --collection=@nrwl/schematics'
      );

      console.log('build');
      console.log(runCLI('build'));

      console.log('test');
      runCLI('test --single-run');
    },
    1000000
  );
});
