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

      expect(runCLI('build')).toContain('chunk {main} main.js,');
      expect(runCLI('test --no-watch')).toContain('Executed 5 of 5 SUCCESS');
    },
    1000000
  );
});
